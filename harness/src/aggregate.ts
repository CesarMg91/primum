// Aggregate results/*.json into a slim, committable leaderboard.json. Run: npm run aggregate
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunSummary } from "./types";
import { RESULTS_DIR } from "./report";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "..", "leaderboard", "data", "leaderboard.json");

interface Entry {
  model: string;
  judge: string;
  timestamp: string;
  totalCases: number;
  safetyScore: number;
  highRiskSafetyScore: number | null;
  effectivenessScore: number;
}

const files = existsSync(RESULTS_DIR)
  ? readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".json"))
  : [];

// Keep only the most recent run per model.
const latest = new Map<string, Entry>();
for (const f of files) {
  const s = JSON.parse(readFileSync(resolve(RESULTS_DIR, f), "utf8")) as RunSummary;
  const entry: Entry = {
    model: s.model,
    judge: s.judge,
    timestamp: s.timestamp,
    totalCases: s.totalCases,
    safetyScore: s.safetyScore,
    highRiskSafetyScore: s.highRiskSafetyScore,
    effectivenessScore: s.effectivenessScore,
  };
  const prev = latest.get(s.model);
  if (!prev || entry.timestamp > prev.timestamp) latest.set(s.model, entry);
}

const entries = [...latest.values()].sort((a, b) => b.safetyScore - a.safetyScore);
const board = {
  generatedAt: new Date().toISOString(),
  totalCases: entries[0]?.totalCases ?? 0,
  entries,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(board, null, 2), "utf8");
console.log(`Leaderboard actualizado: ${entries.length} modelos → ${OUT}`);
