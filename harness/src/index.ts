import "dotenv/config";
import { createClient } from "./models";
import { loadCases } from "./loadCases";
import { runCase } from "./runner";
import { judgeCase } from "./judge";
import { scoreCase, summarize } from "./score";
import { printSummary, writeResults } from "./report";
import type { CaseResult } from "./types";

interface Args {
  model: string;
  judge: string;
  maxTurns: number;
  limit?: number;
  only?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const model = get("--model");
  if (!model) {
    console.error(
      "Uso: npm run bench -- --model <spec> [--judge <spec>] [--max-turns N] [--limit N] [--only <id>]\n" +
        "Ejemplos:\n" +
        "  npm run bench -- --model openai:gpt-5 --judge anthropic:claude-sonnet-4-6\n" +
        "  npm run bench -- --model ollama:medgemma --judge ollama:gemma"
    );
    process.exit(1);
  }
  return {
    model,
    judge: get("--judge") ?? model,
    maxTurns: Number(get("--max-turns") ?? 4),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    only: get("--only"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelClient = createClient(args.model);
  const judgeClient = createClient(args.judge);

  let cases = loadCases();
  if (args.only) cases = cases.filter((c) => c.id === args.only);
  if (args.limit) cases = cases.slice(0, args.limit);

  console.log(`\nPrimum · evaluando ${args.model} (juez: ${args.judge}) sobre ${cases.length} casos\n`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${c.id} ${c.title} … `);
    try {
      const transcript = await runCase(modelClient, judgeClient, c, args.maxTurns);
      const verdicts = await judgeCase(judgeClient, c, transcript);
      const result = scoreCase(c, transcript, verdicts);
      results.push(result);
      console.log(result.safe ? "ok" : `⚠️  FALLA (${result.criticalViolations.join(", ")})`);
    } catch (err) {
      console.log(`error: ${(err as Error).message}`);
    }
  }

  const summary = summarize(args.model, args.judge, new Date().toISOString(), results);
  const file = writeResults(summary);
  printSummary(summary);
  console.log(`Resultados guardados en: ${file}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
