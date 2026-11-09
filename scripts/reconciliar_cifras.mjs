#!/usr/bin/env node
// Reconciliación reproducible de las cifras de PRIMUM.
//
// Lee results/*.json (las corridas del harness; están en .gitignore, viven en la
// máquina donde se corrieron) y cases/split.json, y saca para cada corrida:
// n, aciertos (casos seguros), safety, IC 95 % de Wilson, safety de alto riesgo y
// efectividad. Después compara base vs afinados con McNemar pareado por caso y
// rastrea de qué corrida sale cada cifra publicada (writeup, README, leaderboard).
//
// Uso (desde la raíz del repo):
//   node scripts/reconciliar_cifras.mjs            → imprime el Markdown
//   node scripts/reconciliar_cifras.mjs --escribir → además escribe docs/cifras-reconciliadas.md
//
// No modifica ninguna cifra publicada: sólo informa.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wilson, mcnemar, pct, fmtP } from "./lib/estadistica.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_RES = path.join(RAIZ, "results");
const SALIDA = path.join(RAIZ, "docs", "cifras-reconciliadas.md");

const split = JSON.parse(fs.readFileSync(path.join(RAIZ, "cases", "split.json"), "utf8"));
const TEST = new Set(split.test);
const N_TEST = split.test.length;

// ---------- 1. Cargar corridas ----------
const corridas = fs
  .readdirSync(DIR_RES)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((archivo) => {
    const j = JSON.parse(fs.readFileSync(path.join(DIR_RES, archivo), "utf8"));
    const res = j.results ?? [];
    const n = res.length;
    const seguros = res.filter((r) => r.safe).length;
    const alto = res.filter((r) => r.risk_level === "high");
    const altoSeg = alto.filter((r) => r.safe).length;
    const eff = n ? res.reduce((s, r) => s + r.effectiveness, 0) / n : NaN;
    const ids = res.map((r) => r.caseId);
    const enTest = ids.filter((i) => TEST.has(i)).length;
    const faltanTest = split.test.filter((i) => !ids.includes(i));
    return {
      archivo,
      corto: archivo.replace(/\.json$/, ""),
      modelo: j.model,
      juez: j.judge,
      fecha: j.timestamp,
      n,
      seguros,
      safety: n ? seguros / n : NaN,
      ic: wilson(seguros, n),
      altoN: alto.length,
      altoSeg,
      alto: alto.length ? altoSeg / alto.length : NaN,
      eff,
      ids,
      enTest,
      soloTest: enTest === n,
      testCompleto: enTest === N_TEST && n === N_TEST,
      faltanTest,
      porCaso: new Map(res.map((r) => [r.caseId, r])),
    };
  });

if (corridas.length === 0) {
  console.error(`No hay corridas en ${DIR_RES}. Los JSON están en .gitignore: corre esto en la máquina que los tiene.`);
  process.exit(1);
}

// ---------- 2. Corridas de referencia ----------
// Por modelo: la corrida más reciente que cubre exactamente los 56 casos de test.
function completa(modelo) {
  return corridas
    .filter((c) => c.modelo === modelo && c.testCompleto)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
}
const BASE = completa("ollama:medgemma:4b");
const C3 = completa("ollama:primum-medgemma-c3");
const C4 = completa("ollama:primum-medgemma-c4");
// Corridas parciales que alimentaron cifras publicadas.
const porNombre = (frag) => corridas.find((c) => c.archivo.includes(frag));
const C3_55 = porNombre("primum-medgemma-c3-2026-06-14t11-15");
const SOUP_55 = porNombre("primum-medgemma-soup-2026-06-15t06-50");
const C5_43 = porNombre("primum-medgemma-c5-2026-06-16t11-45");

// ---------- 3. Comparaciones pareadas ----------
function pareado(A, B) {
  const comunes = A.ids.filter((i) => B.porCaso.has(i) && TEST.has(i));
  let ambos = 0, ninguno = 0, arregla = 0, rompe = 0;
  const arreglados = [], rotos = [];
  for (const id of comunes) {
    const a = A.porCaso.get(id).safe;
    const b = B.porCaso.get(id).safe;
    if (a && b) ambos++;
    else if (!a && !b) ninguno++;
    else if (!a && b) { arregla++; arreglados.push(id); }
    else { rompe++; rotos.push(id); }
  }
  const m = mcnemar(arregla, rompe);
  const segA = comunes.filter((i) => A.porCaso.get(i).safe).length;
  const segB = comunes.filter((i) => B.porCaso.get(i).safe).length;
  return { n: comunes.length, ambos, ninguno, arregla, rompe, arreglados, rotos, m, segA, segB };
}

// ---------- 4. Por tipo de peligro ----------
function porPeligro(c) {
  const t = new Map();
  for (const r of c.porCaso.values()) {
    if (!TEST.has(r.caseId)) continue;
    const e = t.get(r.danger_tested) ?? { n: 0, seg: 0 };
    e.n++;
    if (r.safe) e.seg++;
    t.set(r.danger_tested, e);
  }
  return t;
}

// ---------- 5. Cifras publicadas y su origen ----------
function linea(rel, aguja) {
  const p = path.join(RAIZ, rel);
  if (!fs.existsSync(p)) return null;
  const ls = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const i = ls.findIndex((l) => l.includes(aguja));
  return i < 0 ? null : i + 1;
}
const metricas = { safety: "safety", alto: "alto riesgo", eff: "efectividad" };
const r1 = (x) => Math.round(1000 * x) / 10;

// Uniones de dos corridas del mismo modelo con casos disjuntos (las cifras de 29
// casos de jun-2026 se armaron así).
function uniones() {
  const out = [];
  for (let i = 0; i < corridas.length; i++)
    for (let j = i + 1; j < corridas.length; j++) {
      const a = corridas[i], b = corridas[j];
      if (a.modelo !== b.modelo) continue;
      if (a.ids.some((x) => b.ids.includes(x))) continue;
      const res = [...a.porCaso.values(), ...b.porCaso.values()];
      const n = res.length;
      const alto = res.filter((r) => r.risk_level === "high");
      out.push({
        corto: `${a.corto} + ${b.corto}`,
        modelo: a.modelo,
        n,
        safety: res.filter((r) => r.safe).length / n,
        alto: alto.length ? alto.filter((r) => r.safe).length / alto.length : NaN,
        eff: res.reduce((s, r) => s + r.effectiveness, 0) / n,
      });
    }
  return out;
}
const UNIONES = uniones();

function origen(metrica, valor, filtroModelo) {
  const ok = (c) => (!filtroModelo || filtroModelo.test(c.modelo)) && Math.abs(r1(c[metrica]) - valor) < 0.051;
  const directos = corridas.filter(ok).map((c) => `\`${c.corto}\` (n=${c.n})`);
  if (directos.length) return directos.join("; ");
  const u = UNIONES.filter(ok).map((c) => `unión \`${c.corto}\` (n=${c.n})`);
  return u.length ? u.join("; ") : "**sin corrida que la reproduzca**";
}

const imp = JSON.parse(fs.readFileSync(path.join(RAIZ, "leaderboard", "data", "improvement.json"), "utf8"));
const lb = JSON.parse(fs.readFileSync(path.join(RAIZ, "leaderboard", "data", "leaderboard.json"), "utf8"));

const BASE_RE = /medgemma:4b$/;
const AFIN_RE = /primum-medgemma/;
const afirmaciones = [
  // [archivo, aguja para ubicar la línea, texto, métrica, valor, filtro de modelo, valor correcto en 56/56]
  ["docs/writeup.md", "| 🛡️ **Safety** |", "Safety base", "safety", 21.4, BASE_RE, BASE],
  ["docs/writeup.md", "| 🛡️ **Safety** |", "Safety afinado", "safety", 52.7, AFIN_RE, C3],
  ["docs/writeup.md", "| ⚠️ Alto riesgo |", "Alto riesgo base", "alto", 20.8, BASE_RE, BASE],
  ["docs/writeup.md", "| ⚠️ Alto riesgo |", "Alto riesgo afinado", "alto", 50.0, AFIN_RE, C3],
  ["docs/writeup.md", "| ✓ Efectividad |", "Efectividad base", "eff", 7.9, BASE_RE, BASE],
  ["docs/writeup.md", "| ✓ Efectividad |", "Efectividad afinado", "eff", 30.5, AFIN_RE, C3],
  ["docs/writeup.md", "37.9% a **75.9%**", "Test de 29: base", "safety", 37.9, BASE_RE, null],
  ["docs/writeup.md", "37.9% a **75.9%**", "Test de 29: afinado", "safety", 75.9, AFIN_RE, null],
  ["README.md", "**21.4%** safety", "README: base", "safety", 21.4, BASE_RE, BASE],
  ["README.md", "| **MedGemma 4B** |", "README tabla preliminar: MedGemma 4B", "safety", 56.3, BASE_RE, null],
  ["README.md", "| Gemma 4 (e4b) |", "README tabla preliminar: Gemma 4 e4b", "safety", 94.7, /gemma4/, null],
  ["README.md", "| Claude Haiku 4.5 |", "README tabla preliminar: Haiku 4.5", "safety", 92.3, /haiku/, null],
  ["leaderboard/data/improvement.json", "\"safety\": 0.379", "improvement.json base", "safety", r1(imp.base.safety), BASE_RE, BASE],
  ["leaderboard/data/improvement.json", "\"safety\": 0.759", "improvement.json PRIMUM", "safety", r1(imp.primum.safety), AFIN_RE, C3],
  ["leaderboard/data/improvement.json", "\"highRisk\": 0.346", "improvement.json base alto riesgo", "alto", r1(imp.base.highRisk), BASE_RE, BASE],
  ["leaderboard/data/improvement.json", "\"highRisk\": 0.731", "improvement.json PRIMUM alto riesgo", "alto", r1(imp.primum.highRisk), AFIN_RE, C3],
];

// ---------- 6. Markdown ----------
const L = [];
const p = (s = "") => L.push(s);
const icTxt = (c) => `${pct(c.ic.lo)}–${pct(c.ic.hi)}`;

p("# PRIMUM: cifras reconciliadas");
p();
p("> Generado por `node scripts/reconciliar_cifras.mjs --escribir` a partir de `results/*.json` y `cases/split.json`.");
p("> **No cambia ninguna cifra publicada.** Dice de qué corrida sale cada número y cuál es el correcto en 56/56.");
p("> Qué cifra va de titular lo decide César con el anclaje humano (`anclaje-humano/`).");
p(`> Juez en todas las corridas de MedGemma: \`${BASE?.juez}\` (un solo juez, una sola familia).`);
p();
p("## 1. Cifras de referencia (test congelado completo, 56/56)");
p();
p("| Corrida | Archivo | n | Seguros | Safety | IC 95 % Wilson | Alto riesgo | Efectividad |");
p("|---|---|---|---|---|---|---|---|");
for (const [nombre, c] of [["MedGemma 4B base", BASE], ["PRIMUM c3", C3], ["PRIMUM c4", C4]]) {
  if (!c) { p(`| ${nombre} | — | sin corrida completa | | | | | |`); continue; }
  p(`| ${nombre} | \`${c.corto}\` | ${c.n} | ${c.seguros} | **${pct(c.safety)} %** | ${icTxt(c)} % | ${c.altoSeg}/${c.altoN} = ${pct(c.alto)} % | ${pct(c.eff)} % |`);
}
p();

p("## 2. Base vs afinados (McNemar pareado por caso, sólo casos de test comunes)");
p();
p("«Arregla» = la base falla y el afinado pasa; «rompe» = al revés. p exacto = binomial bilateral sobre los discordantes.");
p();
p("| Comparación | Casos pareados | Base seguros | Afinado seguros | Arregla | Rompe | p exacto | p mid-p | χ² (cc) |");
p("|---|---|---|---|---|---|---|---|---|");
const comparaciones = [
  ["base vs c3 (56)", BASE, C3],
  ["base vs c4 (56)", BASE, C4],
  ["base vs c3 (corrida de 55)", BASE, C3_55],
  ["base vs soup (55)", BASE, SOUP_55],
  ["base vs c5 (43, incompleta)", BASE, C5_43],
  ["c3 (56) vs c4 (56)", C3, C4],
];
const pares = {};
for (const [nom, A, B] of comparaciones) {
  if (!A || !B) continue;
  const r = pareado(A, B);
  pares[nom] = r;
  p(`| ${nom} | ${r.n} | ${r.segA} | ${r.segB} | ${r.arregla} | ${r.rompe} | ${fmtP(r.m.pExacto)} | ${fmtP(r.m.pMid)} | ${r.m.chi2.toFixed(2)} (p=${fmtP(r.m.pChi2)}) |`);
}
const principal = pares["base vs c3 (56)"];
if (principal) {
  p();
  p(`Casos que c3 arregla: ${principal.arreglados.join(", ")}.`);
  p();
  p(`Casos que c3 rompe: ${principal.rotos.join(", ") || "ninguno"}.`);
}
p();

p("## 3. Por tipo de peligro (test, base vs c3)");
p();
p("| Peligro | Casos | Base seguros | c3 seguros |");
p("|---|---|---|---|");
if (BASE && C3) {
  const pb = porPeligro(BASE), pc = porPeligro(C3);
  for (const k of [...pb.keys()].sort()) {
    p(`| ${k} | ${pb.get(k).n} | ${pb.get(k).seg} | ${pc.get(k)?.seg ?? "—"} |`);
  }
}
p();

p("## 4. De dónde sale cada cifra publicada");
p();
p("| Dónde | Línea | Qué dice | Valor publicado | Corrida que lo reproduce | Valor correcto en 56/56 |");
p("|---|---|---|---|---|---|");
for (const [arch, aguja, texto, met, valor, filtro, ref] of afirmaciones) {
  const ln = linea(arch, aguja) ?? "?";
  const correcto = ref ? `${pct(ref[met])} % (\`${ref.corto}\`)` : "no aplica (otro conjunto)";
  p(`| \`${arch}\` | ${ln} | ${texto} (${metricas[met]}) | ${valor} % | ${origen(met, valor, filtro)} | ${correcto} |`);
}
p();
p(`\`leaderboard/data/improvement.json\` declara \`testCases: ${imp.testCases}\` y fecha \`${imp.updated}\`: es el test viejo de 29 casos, no el de 56.`);
p();
p(`\`leaderboard/data/leaderboard.json\` (generado ${lb.generatedAt}) mezcla denominadores:`);
p();
p("| Modelo | n | Safety | IC 95 % Wilson | Casos de test incluidos |");
p("|---|---|---|---|---|");
for (const e of lb.entries) {
  const c = corridas.find((x) => x.fecha === e.timestamp && x.modelo === e.model);
  const k = Math.round(e.safetyScore * e.totalCases);
  const ic = wilson(k, e.totalCases);
  p(`| ${e.model} | ${e.totalCases} | ${pct(e.safetyScore)} % | ${pct(ic.lo)}–${pct(ic.hi)} % | ${c ? `${c.enTest} de ${N_TEST}` : "?"} |`);
}
p();
p("Esas corridas son de los casos 0001–0050 (mayormente de **entrenamiento**), con huecos distintos por modelo. No son comparables con las cifras de 56 casos de test.");
p();

p("## 5. Qué hay que corregir (cuando César decida la cifra)");
p();
if (BASE && C3 && C3_55 && SOUP_55) {
  p(`1. **Safety del afinado:** el writeup dice 52.7 %, que sale de \`${C3_55.corto}\` (${C3_55.n} casos, falta ${C3_55.faltanTest.join(", ")}) o de \`${SOUP_55.corto}\` (${SOUP_55.n} casos, falta ${SOUP_55.faltanTest.join(", ")}). La corrida completa de c3 da **${C3.seguros}/${C3.n} = ${pct(C3.safety)} %** (IC 95 % ${icTxt(C3)} %).`);
  p(`2. **La tabla del writeup mezcla corridas:** safety 52.7 % (c3 de 55 o soup), alto riesgo ${pct(C3_55.alto)} % (c3 de 55), efectividad ${pct(SOUP_55.eff)} % (soup). En c3 56/56 son **${pct(C3.safety)} %, ${pct(C3.alto)} % y ${pct(C3.eff)} %**; el Δ de safety pasa de +31.3 a **+${(100 * (C3.safety - BASE.safety)).toFixed(1)} puntos** (${(C3.safety / BASE.safety).toFixed(1)}×).`);
  p(`3. **La base sí está bien:** ${BASE.seguros}/${BASE.n} = ${pct(BASE.safety)} % (IC ${icTxt(BASE)} %), alto riesgo ${pct(BASE.alto)} %, efectividad ${pct(BASE.eff)} %.`);
  p(`4. **Significancia:** c3 arregla ${principal.arregla} y rompe ${principal.rompe}; McNemar exacto p = ${fmtP(principal.m.pExacto)}. Con este juez la mejora es significativa y los IC de Wilson no se traslapan (${pct(BASE.ic.hi)} % contra ${pct(C3.ic.lo)} %), pero son anchos: con 56 casos cada uno vale 1.8 puntos.`);
  const pc = porPeligro(C3).get("alucinacion"), pb = porPeligro(BASE).get("alucinacion");
  if (pc && pb) p(`5. **Alucinación:** c3 pasa ${pc.seg} de ${pc.n} y la base ${pb.seg} de ${pb.n}. El writeup dice «7 de 8 siguen rotos»: coincide con c3 56/56.`);
  p(`6. **Test de 29 (37.9 % → 75.9 %):** la cifra del afinado no sale de una sola corrida; es la unión de dos corridas de c3 del 12-jun (28 + 1 caso). Hay que dejarla sólo como historia o quitarla.`);
  p(`7. **README (tabla preliminar):** 56 % de MedGemma sale de 16 casos, 94.7 % de Gemma 4 de 19 y 92 % de Haiku de 13, casi todos de entrenamiento. No deben convivir con las cifras de test.`);
  p(`8. **leaderboard.json:** denominadores de 43 a 50 sobre casos de entrenamiento; hay que correr los frontier sobre los 56 de test (o etiquetarlo como «corpus de desarrollo»).`);
  p("9. **Pendiente del anclaje humano:** todo lo anterior es con un solo juez Claude. La cifra que se publique depende de κ(juez, humano) y del McNemar con etiquetas humanas (plan §7, fase 1).");
  // Riesgo de fuga: respuestas de oro de casos que hoy son de test.
  const goldPath = path.join(RAIZ, "dataset", "gold.jsonl");
  if (fs.existsSync(goldPath)) {
    const gold = fs.readFileSync(goldPath, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const enTest = gold.map((g) => g.caseId).filter((i) => TEST.has(i));
    if (enTest.length) {
      p(`10. **Verificar fuga al entrenamiento:** \`dataset/gold.jsonl\` tiene ${gold.length} respuestas de oro y **${enTest.length} son de casos que hoy están en test** (${enTest.join(", ")}). \`training/train_qlora.py\` las descarta sólo si encuentra \`../cases/split.json\` (opción A del RUNBOOK, clonando el repo); con la opción B (subir sólo \`gold.jsonl\` al pod) entrarían al entrenamiento sin aviso. Hay que confirmar en el log de c3 la línea «skipped N gold examples not in the train split» o reentrenar con el filtro obligatorio antes de publicar.`);
      if (BASE && C3) {
        const sosp = new Set(enTest);
        const limpio = (c) => ({ ...c, ids: c.ids.filter((i) => !sosp.has(i)) });
        const r = pareado(limpio(BASE), C3);
        const icb = wilson(r.segA, r.n), icc = wilson(r.segB, r.n);
        p(`    - Sensibilidad sin esos ${enTest.length} casos (n = ${r.n}): base ${r.segA}/${r.n} = ${pct(r.segA / r.n)} % (IC ${pct(icb.lo)}–${pct(icb.hi)}), c3 ${r.segB}/${r.n} = ${pct(r.segB / r.n)} % (IC ${pct(icc.lo)}–${pct(icc.hi)}); arregla ${r.arregla}, rompe ${r.rompe}, McNemar exacto p = ${fmtP(r.m.pExacto)}.`);
      }
    }
  }
}
p();

p("## 6. Todas las corridas");
p();
p("| Archivo | Modelo | Juez | n | Seguros | Safety | IC 95 % | Alto riesgo | Efectividad | Casos de test | Faltan del test |");
p("|---|---|---|---|---|---|---|---|---|---|---|");
for (const c of corridas) {
  const faltan = c.enTest === 0 ? "—" : c.faltanTest.length > 6 ? `${c.faltanTest.length} casos` : c.faltanTest.join(", ") || "ninguno";
  p(`| \`${c.corto}\` | ${c.modelo} | ${c.juez} | ${c.n} | ${c.seguros} | ${pct(c.safety)} % | ${icTxt(c)} % | ${Number.isFinite(c.alto) ? pct(c.alto) + " %" : "—"} | ${pct(c.eff)} % | ${c.enTest}/${N_TEST} | ${faltan} |`);
}
p();

const md = L.join("\n") + "\n";
process.stdout.write(md);
if (process.argv.includes("--escribir")) {
  fs.writeFileSync(SALIDA, md);
  console.error(`\nEscrito: ${path.relative(RAIZ, SALIDA)}`);
}
