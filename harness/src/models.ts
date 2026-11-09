import { execFileSync } from "node:child_process";
import type { ChatMessage, ModelClient, TokenUsage } from "./types";

/**
 * Parse a model spec into provider + model.
 * Accepts "provider:model" (e.g. "ollama:medgemma", "anthropic:claude-sonnet-4-6",
 * "vertex:gemini-3.1-pro-preview" for Gemini on Vertex AI with gcloud auth)
 * or a bare name whose provider is inferred (gpt* -> openai, claude* -> anthropic,
 * gemini* -> gemini).
 */
function parseSpec(spec: string): { provider: string; model: string } {
  const idx = spec.indexOf(":");
  if (idx !== -1) {
    return { provider: spec.slice(0, idx).toLowerCase(), model: spec.slice(idx + 1) };
  }
  const lower = spec.toLowerCase();
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3")) {
    return { provider: "openai", model: spec };
  }
  if (lower.startsWith("claude")) return { provider: "anthropic", model: spec };
  if (lower.startsWith("gemini")) return { provider: "gemini", model: spec };
  throw new Error(
    `No puedo inferir el proveedor de "${spec}". Usa el formato provider:model (ej. ollama:medgemma).`
  );
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (revisa tu .env).`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull a retry delay (ms) out of a provider's 429 body, if present. */
function parseRetryMs(body: string): number | null {
  const m1 = body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  if (m1) return Math.ceil(parseFloat(m1[1]!) * 1000);
  const m2 = body.match(/retry in ([\d.]+)s/i);
  if (m2) return Math.ceil(parseFloat(m2[1]!) * 1000);
  return null;
}

/** fetch() that waits out 429 rate limits (honoring the provider's retry hint) and retries. */
async function fetchWithRetry(
  url: string,
  init: Parameters<typeof fetch>[1],
  label: string,
  maxRetries = 6,
  timeoutMs = 300_000
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error(`${label}: timeout — sin respuesta en ${Math.round(timeoutMs / 1000)}s (¿modelo local atorado?).`);
      }
      // Transient network error ("fetch failed"): back off and retry.
      if (attempt >= maxRetries) {
        throw new Error(`${label}: fallo de red tras ${maxRetries} reintentos (${(e as Error).message}).`);
      }
      const waitMs = Math.min(30_000, 2000 * 2 ** attempt);
      console.error(`    ⏳ ${label}: error de red, reintentando en ${Math.ceil(waitMs / 1000)}s…`);
      await sleep(waitMs);
      continue;
    } finally {
      clearTimeout(timer);
    }

    // Success or a non-retryable status -> return as is.
    if (res.status !== 429 && res.status !== 529 && res.status < 500) return res;
    if (attempt >= maxRetries) return res; // give up; caller surfaces the error body

    if (res.status === 429) {
      const body = await res.text();
      // A daily-quota 429 won't recover by waiting (it resets on a daily cycle). Fail fast.
      if (/per\s*day|RequestsPerDay/i.test(body)) {
        throw new Error(
          `${label}: límite DIARIO del free tier agotado — usa otro modelo/proveedor o espera al reinicio diario.`
        );
      }
      const headerRa = res.headers.get("retry-after");
      const waitMs =
        (headerRa ? Number(headerRa) * 1000 : null) ??
        parseRetryMs(body) ??
        Math.min(60_000, 2000 * 2 ** attempt);
      console.error(`    ⏳ ${label}: cuota llena, esperando ${Math.ceil(waitMs / 1000)}s…`);
      await sleep(waitMs + 500);
    } else {
      // 529 overloaded / 5xx: transient server error, back off and retry.
      const waitMs = Math.min(30_000, 2000 * 2 ** attempt);
      console.error(`    ⏳ ${label}: servidor saturado (${res.status}), reintentando en ${Math.ceil(waitMs / 1000)}s…`);
      await sleep(waitMs);
    }
  }
}

/** Gemma's chat template requires strict user/assistant alternation and no
 * standalone system role. Our cases push several patient (user) turns in a row,
 * which the strict template rejects ("Conversation roles must alternate"). Fold
 * system into the first user turn and merge consecutive same-role turns — this
 * is what lenient templates do anyway, so output is equivalent. */
function gemmaNormalize(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let pendingSystem: string | null = null;
  for (const m of messages) {
    if (m.role === "system") {
      pendingSystem = pendingSystem ? `${pendingSystem}\n\n${m.content}` : m.content;
      continue;
    }
    let content = m.content;
    if (m.role === "user" && pendingSystem) {
      content = `${pendingSystem}\n\n${content}`;
      pendingSystem = null;
    }
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${content}`;
    else out.push({ role: m.role, content });
  }
  if (pendingSystem) {
    const last = out[out.length - 1];
    if (last && last.role === "user") last.content += `\n\n${pendingSystem}`;
    else out.push({ role: "user", content: pendingSystem });
  }
  return out;
}

function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

// --- OpenAI (and any OpenAI-compatible /chat/completions endpoint) ---
function openAICompatible(
  id: string,
  model: string,
  baseUrl: string,
  apiKey: string | null,
  extra: Record<string, unknown> = {},
  normalize = false,
  timeoutMs = 300_000
): ModelClient {
  return {
    id,
    async complete(messages) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
      const payload = normalize ? gemmaNormalize(messages) : messages;
      const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        // NOTE: some modern models (GPT-5.x) reject `temperature`; omit it for compatibility.
        body: JSON.stringify({ model, messages: payload, ...extra }),
      }, id, 6, timeoutMs);
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

// --- Anthropic Messages API ---
function anthropic(id: string, model: string): ModelClient {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  return {
    id,
    async complete(messages) {
      const { system, rest } = splitSystem(messages);
      const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          // NOTE: newer Anthropic models (Opus 4.8+) reject `temperature`; we omit it.
          model,
          // 4096: case generation and judge verdicts emit long JSON; 1024 truncated them.
          max_tokens: 4096,
          system: system || undefined,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      }, id);
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      return (data.content ?? []).map((b: any) => b.text ?? "").join("");
    },
  };
}

// --- Google Gemini ---
const emptyUsage = (): TokenUsage => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  thinkingTokens: 0,
  cachedTokens: 0,
});

/** Add a Gemini `usageMetadata` block to a running total. */
function addGeminiUsage(total: TokenUsage, meta: any): void {
  total.calls += 1;
  total.inputTokens += meta?.promptTokenCount ?? 0;
  total.outputTokens += meta?.candidatesTokenCount ?? 0;
  total.thinkingTokens += meta?.thoughtsTokenCount ?? 0;
  total.cachedTokens += meta?.cachedContentTokenCount ?? 0;
}

/** Same request body for AI Studio and Vertex (both speak generateContent). */
function geminiBody(messages: ChatMessage[], temperature: number | null): any {
  const { system, rest } = splitSystem(messages);
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = { contents };
  if (temperature !== null) body.generationConfig = { temperature };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return body;
}

const geminiText = (data: any): string =>
  (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => !p.thought)
    .map((p: any) => p.text ?? "")
    .join("");

function gemini(id: string, model: string): ModelClient {
  const apiKey = requireEnv("GOOGLE_API_KEY");
  const usage = emptyUsage();
  return {
    id,
    usage,
    async complete(messages) {
      const body = geminiBody(messages, 0);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }, id);
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      addGeminiUsage(usage, data.usageMetadata);
      return geminiText(data);
    },
  };
}

// --- Google Gemini on Vertex AI (OAuth token from gcloud, no API key on disk) ---
// Shared by every Vertex client of the process, so creating one client per case is cheap.
let vertexCachedToken: { value: string; at: number } | null = null;

function vertexToken(label: string): string {
  const fixed = process.env.VERTEX_ACCESS_TOKEN;
  if (fixed) return fixed;
  if (vertexCachedToken && Date.now() - vertexCachedToken.at < 45 * 60_000) return vertexCachedToken.value;
  const args = ["auth", "print-access-token"];
  if (process.env.VERTEX_ACCOUNT) args.push(`--account=${process.env.VERTEX_ACCOUNT}`);
  const value = execFileSync("gcloud", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32", // gcloud is a .cmd on Windows
  }).trim();
  if (!value) throw new Error(`${label}: gcloud no devolvió token.`);
  vertexCachedToken = { value, at: Date.now() };
  return value;
}

/**
 * Auth: VERTEX_ACCESS_TOKEN if set; otherwise `gcloud auth print-access-token`
 * with VERTEX_ACCOUNT (if set). The token lives only in memory and is refreshed
 * every 45 min. VERTEX_PROJECT is required on purpose: never fall back to
 * whatever project gcloud happens to have active. VERTEX_LOCATION defaults to
 * `global` (Gemini 3.x answers only there).
 *
 * Temperature is left at the provider default: Google advises against lowering
 * it on Gemini 3.x (reasoning models), and the Claude judge also runs with the
 * default (Opus 4.8 rejects `temperature`).
 */
function vertexGemini(id: string, model: string): ModelClient {
  const project = requireEnv("VERTEX_PROJECT");
  const location = process.env.VERTEX_LOCATION ?? "global";
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const usage = emptyUsage();
  const getToken = () => vertexToken(id);

  return {
    id,
    usage,
    async complete(messages) {
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(geminiBody(messages, null)),
      }, id);
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      addGeminiUsage(usage, data.usageMetadata);
      const text = geminiText(data);
      if (!text) {
        const reason = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "?";
        throw new Error(`${id}: respuesta vacía (finishReason ${reason}).`);
      }
      return text;
    },
  };
}

/** Build a ModelClient from a spec string. */
export function createClient(spec: string): ModelClient {
  const { provider, model } = parseSpec(spec);
  switch (provider) {
    case "openai":
      return openAICompatible(
        `openai:${model}`,
        model,
        "https://api.openai.com/v1",
        requireEnv("OPENAI_API_KEY")
      );
    case "anthropic":
      return anthropic(`anthropic:${model}`, model);
    case "gemini":
    case "google":
      return gemini(`gemini:${model}`, model);
    case "vertex":
      return vertexGemini(`vertex:${model}`, model);
    case "ollama": {
      const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
      // Cap output so small local models can't loop forever (the usual cause of "stuck").
      // normalize=true: fold system + merge consecutive turns for Gemma's strict template.
      // 420s timeout: this box has no usable GPU (Ollama runs 100% CPU at ~0.2s/token),
      // so a 1024-token generation can take ~3.5 min. 420s covers the slowest healthy call
      // without spurious timeouts, while still bounding a truly wedged request.
      return openAICompatible(`ollama:${model}`, model, `${host}/v1`, null, { max_tokens: 1024 }, true, 420_000);
    }
    default:
      throw new Error(`Proveedor desconocido: "${provider}".`);
  }
}
