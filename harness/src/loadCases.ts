import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Case } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CASES_DIR = resolve(__dirname, "..", "..", "cases");

/** Load every case file in cases/, skipping the template and non-yaml files. */
export function loadCases(dir: string = CASES_DIR): Case[] {
  const files = readdirSync(dir)
    .filter((f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"))
    .sort();
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), "utf8");
    const parsed = parse(raw) as Case;
    if (!parsed?.id) throw new Error(`Caso sin id: ${f}`);
    return parsed;
  });
}
