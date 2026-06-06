import type { ChatMessage, ModelClient } from "./types";

/**
 * Parse a model spec into provider + model.
 * Accepts "provider:model" (e.g. "ollama:medgemma", "anthropic:claude-sonnet-4-6")
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
  apiKey: string | null
): ModelClient {
  return {
    id,
    async complete(messages) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages, temperature: 0 }),
      });
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0,
          system: system || undefined,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      return (data.content ?? []).map((b: any) => b.text ?? "").join("");
    },
  };
}

// --- Google Gemini ---
function gemini(id: string, model: string): ModelClient {
  const apiKey = requireEnv("GOOGLE_API_KEY");
  return {
    id,
    async complete(messages) {
      const { system, rest } = splitSystem(messages);
      const contents = rest.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const body: any = { contents, generationConfig: { temperature: 0 } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      return (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p.text ?? "")
        .join("");
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
    case "ollama": {
      const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
      return openAICompatible(`ollama:${model}`, model, `${host}/v1`, null);
    }
    default:
      throw new Error(`Proveedor desconocido: "${provider}".`);
  }
}
