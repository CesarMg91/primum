/**
 * Re-judge EXISTING model answers with another judge. It never calls the
 * evaluated model: it takes the transcripts stored in a results/*.json run,
 * passes them through the same `judgeCase` (same prompt, same fail-safe
 * defaults) with the judge given here, and re-scores them with `scoreCase`.
 *
 * Use: second-family judge (e.g. Gemini re-judging runs that Claude judged).
 *
 *   npm run rejudge -- --judge vertex:gemini-3.1-pro-preview \
 *     --run base=ollama-medgemma-4b-2026-06-13t23-22-40-962z.json \
 *     --run c3=ollama-primum-medgemma-c3-2026-06-15t01-02-17-053z.json \
 *     [--split test] [--limit N] [--only <caseId>] [--concurrency 4] \
 *     [--out results/juez-segunda-familia]
 *
 * Resumable: one JSONL line per finished case in <out>/cache-<judge>-<label>.jsonl;
 * re-running reuses finished cases. Each line keeps the judge's token usage so
 * the cost can be measured, not guessed. Transcripts are NOT copied (they stay
 * in the source run); each line carries `sourceRun` + `caseId` to join them.
 */
import "dotenv/config";
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, isAbsolute, basename } from "node:path";
import { createClient } from "./models";
import { loadCases, CASES_DIR } from "./loadCases";
import { judgeCase } from "./judge";
import { scoreCase, summarize } from "./score";
import { RESULTS_DIR } from "./report";
import type { CaseResult, RunSummary, TokenUsage } from "./types";

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

export type RejudgedCase = Omit<CaseResult, "transcript"> & {
  sourceRun: string;
  originalJudge: string;
  judge: string;
  judgeUsage: TokenUsage | null;
  judgeMs: number;
};

interface Args {
  judge: string;
  runs: { label: string; file: string }[];
  split?: "train" | "test" | "all";
  limit?: number;
  only?: string;
  concurrency: number;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const all = (flag: string) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]!] : []));
  const get = (flag: string) => all(flag)[0];
  const judge = get("--judge");
  const runs = all("--run").map((r) => {
    const eq = r.indexOf("=");
    const label = eq === -1 ? basename(r).replace(/\.json$/, "") : r.slice(0, eq);
    const f = eq === -1 ? r : r.slice(eq + 1);
    return { label, file: isAbsolute(f) ? f : resolve(RESULTS_DIR, f) };
  });
  if (!judge || runs.length === 0) {
    console.error(
      "Uso: npm run rejudge -- --judge <provider:model> --run <etiqueta>=<results/x.json> [--run ...]\n" +
        "     [--split test|train|all] [--limit N] [--only <id>] [--concurrency N] [--out <dir>]"
    );
    process.exit(1);
  }
  const out = get("--out") ?? process.env.PRIMUM_REJUDGE_OUT ?? resolve(RESULTS_DIR, "juez-segunda-familia");
  return {
    judge,
    runs,
    split: (get("--split") ?? process.env.PRIMUM_SPLIT ?? "test") as Args["split"],
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    only: get("--only"),
    concurrency: Math.max(1, Number(get("--concurrency") ?? 3)),
    out: isAbsolute(out) ? out : resolve(process.cwd(), out),
  };
}

function loadCache(file: string): Map<string, RejudgedCase> {
  const m = new Map<string, RejudgedCase>();
  if (!existsSync(file)) return m;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as RejudgedCase;
      m.set(r.caseId, r);
    } catch { /* half-written line */ }
  }
  return m;
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]!);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = new Map(loadCases().map((c) => [c.id, c]));
  let allowed: Set<string> | null = null;
  if (args.split && args.split !== "all") {
    const split = JSON.parse(readFileSync(resolve(CASES_DIR, "split.json"), "utf8"));
    allowed = new Set(split[args.split] as string[]);
  }
  mkdirSync(args.out, { recursive: true });
  console.log(`\nPrimum · re-juzgando con ${args.judge} (sin regenerar respuestas) → ${args.out}\n`);

  for (const run of args.runs) {
    if (!existsSync(run.file)) throw new Error(`No existe ${run.file}`);
    const src = JSON.parse(readFileSync(run.file, "utf8")) as RunSummary;
    let todo = src.results.filter((r) => !allowed || allowed.has(r.caseId));
    if (args.only) todo = todo.filter((r) => r.caseId === args.only);
    todo.sort((a, b) => a.caseId.localeCompare(b.caseId));
    if (args.limit) todo = todo.slice(0, args.limit);

    const cacheFile = resolve(args.out, `cache-${slug(args.judge)}-${slug(run.label)}.jsonl`);
    const cache = loadCache(cacheFile);
    console.log(`  [${run.label}] ${basename(run.file)} · modelo ${src.model} · juez original ${src.judge} · ${todo.length} casos (${cache.size} en caché)`);

    await pool(todo, args.concurrency, async (orig) => {
      if (cache.has(orig.caseId)) return;
      const c = cases.get(orig.caseId);
      if (!c) throw new Error(`Caso ${orig.caseId} no está en cases/`);
      // One client per case so its token count belongs to this case only.
      const judge = createClient(args.judge);
      const t0 = Date.now();
      try {
        const verdicts = await judgeCase(judge, c, orig.transcript);
        const scored = scoreCase(c, orig.transcript, verdicts);
        const { transcript: _omit, ...rest } = scored;
        const line: RejudgedCase = {
          ...rest,
          sourceRun: basename(run.file),
          originalJudge: src.judge,
          judge: judge.id,
          judgeUsage: judge.usage ? { ...judge.usage } : null,
          judgeMs: Date.now() - t0,
        };
        appendFileSync(cacheFile, JSON.stringify(line) + "\n", "utf8");
        cache.set(orig.caseId, line);
        const u = line.judgeUsage;
        const tok = u ? ` · ${u.inputTokens} in / ${u.outputTokens} out / ${u.thinkingTokens} thinking` : "";
        console.log(`    ${orig.caseId} ${line.safe ? "ok" : `FALLA (${line.criticalViolations.join(", ")})`} [Claude: ${orig.safe ? "ok" : "FALLA"}]${tok}`);
      } catch (err) {
        console.log(`    ${orig.caseId} error: ${(err as Error).message.slice(0, 300)}`);
      }
    });

    // Summary for this arm (only the cases in scope that finished).
    const done = todo.map((r) => cache.get(r.caseId)).filter((x): x is RejudgedCase => Boolean(x));
    const asResults = done.map((d) => ({ ...d, transcript: [] })) as CaseResult[];
    const summary = summarize(src.model, args.judge, new Date().toISOString(), asResults);
    const usage = done.reduce(
      (s, d) => {
        const u = d.judgeUsage;
        if (u) {
          s.calls += u.calls; s.inputTokens += u.inputTokens; s.outputTokens += u.outputTokens;
          s.thinkingTokens += u.thinkingTokens; s.cachedTokens += u.cachedTokens;
        }
        return s;
      },
      { calls: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cachedTokens: 0 } as TokenUsage
    );
    const outFile = resolve(args.out, `rejuzgado-${slug(args.judge)}-${slug(run.label)}.json`);
    writeFileSync(
      outFile,
      JSON.stringify(
        {
          ...summary,
          results: done,
          label: run.label,
          sourceRun: basename(run.file),
          originalJudge: src.judge,
          casesInScope: todo.length,
          judgeUsage: usage,
          note: "Transcripts omitted; join with sourceRun by caseId.",
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(
      `  [${run.label}] ${done.length}/${todo.length} re-juzgados · safety ${(summary.safetyScore * 100).toFixed(1)}% ` +
        `(${done.filter((d) => d.safe).length}/${done.length}) · tokens ${usage.inputTokens} in / ${usage.outputTokens} out / ${usage.thinkingTokens} thinking → ${basename(outFile)}\n`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
