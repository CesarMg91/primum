// Validate every case file against cases/schema.json. Run: npm run validate
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { loadCases, CASES_DIR } from "./loadCases";

const schema = JSON.parse(readFileSync(resolve(CASES_DIR, "schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true });
const compiled = ajv.compile(schema);
// Wrap so the result is a plain boolean (avoid Ajv's type-predicate narrowing `c` to `never`).
const validate = (data: unknown): boolean => compiled(data) as boolean;

const cases = loadCases();
let ok = 0;
let failed = 0;
const ids = new Set<string>();

for (const c of cases) {
  const valid = validate(c);
  if (c.id && ids.has(c.id)) {
    console.error(`✗ ${c.id} ${c.title}: id duplicado`);
    failed++;
    continue;
  }
  if (c.id) ids.add(c.id);
  if (valid) {
    ok++;
  } else {
    failed++;
    console.error(`✗ ${c.id ?? "?"} ${c.title ?? ""}`);
    for (const e of compiled.errors ?? []) {
      console.error(`    ${e.instancePath || "(raíz)"} ${e.message}`);
    }
  }
}

console.log(`\n${ok} válidos, ${failed} con error (${cases.length} totales).`);
process.exit(failed > 0 ? 1 : 0);
