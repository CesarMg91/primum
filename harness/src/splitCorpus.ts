// Deterministic stratified train/test split for the Primum corpus.
//
// Capa 2 honesty guard: we must measure the fine-tuned model on cases it was
// NEVER trained on, or any safety lift is illusory. This produces a fixed,
// reproducible ~20% hold-out test set, stratified by danger_tested so every
// danger type with enough examples is represented in test while still keeping
// training examples of it. Singletons / tiny groups (n<3) go entirely to train
// so the model can learn them.
//
// Rule: within each danger group sorted by id, every 5th case (0-based index
// === 2 mod 5) joins the test set. No RNG -> identical split on every run.
//
// Usage: npm run split   (writes cases/split.json)

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadCases, CASES_DIR } from "./loadCases";
import type { Case, DangerType } from "./types";

export interface CorpusSplit {
  rule: string;
  generatedFrom: number; // total corpus size at split time
  test: string[]; // case ids
  train: string[]; // case ids
  byDanger: Record<string, { total: number; test: number; train: number }>;
}

// 1-in-N hold-out. Default 1-in-5 (~20%); override via PRIMUM_HOLDOUT_MOD
// (e.g. 3 -> ~33%) to grow the test set for more reliable measurement.
const HOLDOUT_MOD = Number(process.env.PRIMUM_HOLDOUT_MOD ?? 5);
const HOLDOUT_OFFSET = 2; // pick the 3rd, 8th, ... (avoids always taking the first/last)

export function computeSplit(cases: Case[] = loadCases()): CorpusSplit {
  const byDanger = new Map<DangerType, Case[]>();
  for (const c of cases) {
    const g = byDanger.get(c.danger_tested) ?? [];
    g.push(c);
    byDanger.set(c.danger_tested, g);
  }

  const test: string[] = [];
  const train: string[] = [];
  const summary: CorpusSplit["byDanger"] = {};

  for (const [danger, group] of byDanger) {
    group.sort((a, b) => a.id.localeCompare(b.id));
    let t = 0;
    group.forEach((c, i) => {
      if (i % HOLDOUT_MOD === HOLDOUT_OFFSET) {
        test.push(c.id);
        t++;
      } else {
        train.push(c.id);
      }
    });
    summary[danger] = { total: group.length, test: t, train: group.length - t };
  }

  test.sort();
  train.sort();
  return {
    rule: `stratified hold-out: within each danger_tested group sorted by id, index % ${HOLDOUT_MOD} === ${HOLDOUT_OFFSET} -> test`,
    generatedFrom: cases.length,
    test,
    train,
    byDanger: summary,
  };
}

function main() {
  const split = computeSplit();
  const out = resolve(CASES_DIR, "split.json");
  writeFileSync(out, JSON.stringify(split, null, 2) + "\n", "utf8");

  const pct = ((split.test.length / split.generatedFrom) * 100).toFixed(1);
  console.log(`\nPrimum · split train/test`);
  console.log(`  Corpus:  ${split.generatedFrom} casos`);
  console.log(`  Test:    ${split.test.length} (${pct}%)  hold-out`);
  console.log(`  Train:   ${split.train.length}`);
  console.log(`  ──────────────────────────────`);
  for (const [d, s] of Object.entries(split.byDanger)) {
    console.log(`  ${d.padEnd(20)} total ${String(s.total).padStart(2)}  → test ${s.test}  train ${s.train}`);
  }
  console.log(`\n  Test ids: ${split.test.join(", ")}`);
  console.log(`  Escrito en: ${out}\n`);
}

main();
