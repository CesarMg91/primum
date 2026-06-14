import "dotenv/config";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "./models";
import { loadCases, CASES_DIR } from "./loadCases";
import { runCase } from "./runner";
import { judgePanel } from "./judge";
import { scoreCase, summarize } from "./score";
import { printSummary, writeResults, RESULTS_DIR } from "./report";
import type { CaseResult } from "./types";

const cacheSlug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

/** Per-(model,split) incremental cache: one CaseResult per JSONL line, written as
 * each case finishes. Lets a slow CPU run survive reboots — re-running the same
 * command reloads finished cases and only runs the rest. */
function loadCache(file: string): Map<string, CaseResult> {
  const m = new Map<string, CaseResult>();
  if (!existsSync(file)) return m;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as CaseResult;
      m.set(r.caseId, r);
    } catch { /* skip a half-written line */ }
  }
  return m;
}

interface Args {
  model: string;
  judges: string[];
  maxTurns: number;
  limit?: number;
  only?: string;
  split?: "train" | "test" | "all";
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  // Collect positional args too: npm on Windows can strip `--model`/`--judge` flags,
  // so we also accept `bench -- <model> [judge]` positionally.
  const flags = new Set(["--model", "--judge", "--max-turns", "--limit", "--only", "--split"]);
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      if (flags.has(a)) i++; // skip this flag's value
      continue;
    }
    positionals.push(a);
  }

  const model = get("--model") ?? positionals[0];
  if (!model) {
    console.error(
      "Uso: npm run bench -- <model> [juez1] [juez2 ...] [--max-turns N] [--limit N] [--only <id>]\n" +
        "Ejemplos:\n" +
        "  npm run bench -- gemini:gemini-3.5-flash gemini:gemini-3.5-flash\n" +
        "  npm run bench -- openai:gpt-5.5 anthropic:claude-opus-4-8\n" +
        "  panel: npm run bench -- ollama:medgemma anthropic:claude-opus-4-8 openai:gpt-5.5"
    );
    process.exit(1);
  }
  // All positionals after the model are judges (panel). Fall back to --judge, then self.
  let judges = positionals.slice(1);
  if (judges.length === 0) {
    const j = get("--judge");
    judges = j ? [j] : [model];
  }
  return {
    model,
    judges,
    maxTurns: Number(get("--max-turns") ?? 4),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    only: get("--only"),
    // npm on Windows can swallow `--split`; allow PRIMUM_SPLIT env as a fallback.
    split: (get("--split") ?? process.env.PRIMUM_SPLIT) as Args["split"],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelClient = createClient(args.model);
  const judgeClients = args.judges.map(createClient);

  let cases = loadCases();
  if (args.split && args.split !== "all") {
    const splitPath = resolve(CASES_DIR, "split.json");
    if (!existsSync(splitPath)) {
      console.error(`No existe ${splitPath}. Corre 'npm run split' primero.`);
      process.exit(1);
    }
    const split = JSON.parse(readFileSync(splitPath, "utf8"));
    const ids = new Set(split[args.split] as string[]);
    cases = cases.filter((c) => ids.has(c.id));
  }
  if (args.only) cases = cases.filter((c) => c.id === args.only);
  if (args.limit) cases = cases.slice(0, args.limit);

  const splitLabel = args.split && args.split !== "all" ? ` [split ${args.split}]` : "";
  const judgeLabel = args.judges.length > 1 ? `panel: ${args.judges.join(", ")}` : args.judges[0];
  console.log(`\nPrimum · evaluando ${args.model} (juez ${judgeLabel}) sobre ${cases.length} casos${splitLabel}\n`);

  // Resumable cache: keyed by model + split so test/train and models don't collide.
  mkdirSync(RESULTS_DIR, { recursive: true });
  const cacheFile = resolve(RESULTS_DIR, `cache-${cacheSlug(args.model)}-${args.split ?? "all"}.jsonl`);
  const cache = loadCache(cacheFile);
  if (cache.size) console.log(`  ↻ reanudando: ${cache.size} casos ya en caché, corro los restantes.\n`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const cached = cache.get(c.id);
    if (cached) {
      results.push(cached);
      console.log(`  ${c.id} ${c.title} … ${cached.safe ? "ok" : "FALLA"} (caché)`);
      continue;
    }
    process.stdout.write(`  ${c.id} ${c.title} … `);
    try {
      const transcript = await runCase(modelClient, judgeClients[0]!, c, args.maxTurns);
      const verdicts = await judgePanel(judgeClients, c, transcript);
      const result = scoreCase(c, transcript, verdicts);
      results.push(result);
      appendFileSync(cacheFile, JSON.stringify(result) + "\n", "utf8"); // persist immediately
      console.log(result.safe ? "ok" : `⚠️  FALLA (${result.criticalViolations.join(", ")})`);
    } catch (err) {
      console.log(`error: ${(err as Error).message}`);
    }
  }

  const summary = summarize(args.model, args.judges.join("+"), new Date().toISOString(), results);
  const file = writeResults(summary);
  printSummary(summary);
  console.log(`Resultados guardados en: ${file}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
