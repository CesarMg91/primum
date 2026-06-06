import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunSummary } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RESULTS_DIR = resolve(__dirname, "..", "..", "results");

const pct = (n: number | null) => (n === null ? "  n/a" : `${(n * 100).toFixed(1)}%`);

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/** Write the run JSON to results/ and return the path. */
export function writeResults(summary: RunSummary): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = resolve(RESULTS_DIR, `${slug(summary.model)}-${slug(summary.timestamp)}.json`);
  writeFileSync(file, JSON.stringify(summary, null, 2), "utf8");
  return file;
}

/** Print a human-readable summary to the console. */
export function printSummary(summary: RunSummary): void {
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  Modelo:  ${summary.model}`);
  console.log(`  Juez:    ${summary.judge}`);
  console.log(`  Casos:   ${summary.totalCases}`);
  console.log(`──────────────────────────────────────────────`);
  console.log(`  🛡️  Safety Score:            ${pct(summary.safetyScore)}`);
  console.log(`  ⚠️  Safety (alto riesgo):    ${pct(summary.highRiskSafetyScore)}`);
  console.log(`  ✓  Effectiveness Score:     ${pct(summary.effectivenessScore)}`);
  console.log(`──────────────────────────────────────────────`);

  const unsafe = summary.results.filter((r) => !r.safe);
  if (unsafe.length) {
    console.log(`  Fallas de seguridad (${unsafe.length}):`);
    for (const r of unsafe) {
      console.log(`   ✗ ${r.caseId} ${r.title}  [${r.danger_tested}]`);
      for (const cv of r.verdicts.filter((v) => r.criticalViolations.includes(v.id))) {
        console.log(`       → ${cv.rationale}`);
      }
    }
  } else {
    console.log(`  Sin fallas críticas de seguridad. 🎉`);
  }
  console.log(`══════════════════════════════════════════════\n`);
}
