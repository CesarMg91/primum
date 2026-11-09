#!/usr/bin/env node
// Juez de segunda familia: compara el veredicto de Claude (juez original) con el
// de Gemini sobre las MISMAS respuestas de MedGemma 4B base y PRIMUM c3 (56 casos
// de test cada una). No llama a ningún modelo: lee lo que dejó
// `harness/src/rejudge.ts` en results/juez-segunda-familia/.
//
//   safety de base y c3 según cada juez (IC de Wilson)
//   κ de Cohen Claude-vs-Gemini por must_not y por caso (IC 95 % bootstrap por caso)
//   McNemar exacto base vs c3 con las etiquetas de Gemini (y de Claude, y de ambos)
//   diferencia de la mejora (Claude − Gemini) con IC bootstrap
//   tabla de desacuerdos con la cita de cada juez
//   costo real del re-juzgado (tokens medidos × precio de lista)
//
// Uso (desde la raíz del repo):
//   node scripts/juez_segunda_familia.mjs             → imprime el Markdown
//   node scripts/juez_segunda_familia.mjs --escribir  → además escribe
//        results/juez-segunda-familia/analisis.json, desacuerdos.csv y docs/juez-segunda-familia.md
//   opción: --juez <slug>  (por defecto vertex-gemini-3-1-pro-preview)

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { wilson, mcnemar, kappaCohen, bootstrap, pct, fmtP } from "./lib/estadistica.mjs";
import { aCsv } from "./lib/csv.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAML = createRequire(path.join(RAIZ, "harness", "package.json"))("yaml");
const DIR = path.join(RAIZ, "results", "juez-segunda-familia");
const DOC = path.join(RAIZ, "docs", "juez-segunda-familia.md");

const argv = process.argv.slice(2);
const opt = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const ESCRIBIR = argv.includes("--escribir");
const JUEZ = opt("--juez", "vertex-gemini-3-1-pro-preview");

// Precio de lista por millón de tokens (USD), nivel estándar, prompts ≤ 200k.
// Fuente: página de precios de la API de Gemini, consultada el 9-nov-2026.
// Los tokens de razonamiento se cobran como salida.
const PRECIOS = {
  "vertex-gemini-3-1-pro-preview": { modelo: "gemini-3.1-pro-preview", entrada: 2.0, salida: 12.0 },
};

const BRAZOS = ["base", "c3"];
const split = JSON.parse(fs.readFileSync(path.join(RAIZ, "cases", "split.json"), "utf8"));
const TEST = split.test;

const casos = new Map();
for (const f of fs.readdirSync(path.join(RAIZ, "cases"))) {
  if (!/^\d{4}.*\.ya?ml$/.test(f)) continue;
  const c = YAML.parse(fs.readFileSync(path.join(RAIZ, "cases", f), "utf8"));
  casos.set(c.id, c);
}

// ---------- cargar ----------
const gem = {};
const cla = {};
const fuentes = {};
for (const b of BRAZOS) {
  const f = path.join(DIR, `rejuzgado-${JUEZ}-${b}.json`);
  if (!fs.existsSync(f)) throw new Error(`Falta ${f}. Corre primero harness/src/rejudge.ts.`);
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  gem[b] = new Map(j.results.map((r) => [r.caseId, r]));
  const src = path.join(RAIZ, "results", j.sourceRun);
  if (!fs.existsSync(src)) throw new Error(`Falta la corrida original ${src} (results/*.json no está en git).`);
  const o = JSON.parse(fs.readFileSync(src, "utf8"));
  cla[b] = new Map(o.results.map((r) => [r.caseId, r]));
  fuentes[b] = { corrida: j.sourceRun, modelo: o.model, juezOriginal: o.judge, juezNuevo: j.judge, uso: j.judgeUsage };
}

const faltan = [];
for (const b of BRAZOS) for (const id of TEST) if (!gem[b].has(id)) faltan.push(`${b}:${id}`);

// ---------- ítems must_not ----------
const items = [];
for (const id of TEST) {
  const c = casos.get(id);
  for (const b of BRAZOS) {
    const g = gem[b].get(id);
    const k = cla[b].get(id);
    if (!g || !k) continue;
    for (const r of c.rubric.filter((x) => x.type === "must_not")) {
      const vk = k.verdicts.find((v) => v.id === r.id);
      const vg = g.verdicts.find((v) => v.id === r.id);
      items.push({
        caso: id,
        titulo: c.title,
        peligro: c.danger_tested,
        brazo: b,
        criterio: r.id,
        descripcion: r.description,
        claudeViolo: !(vk?.satisfied ?? false),
        geminiViolo: !(vg?.satisfied ?? false),
        citaClaude: vk?.quote ?? "",
        razonClaude: vk?.rationale ?? "",
        citaGemini: vg?.quote ?? "",
        razonGemini: vg?.rationale ?? "",
      });
    }
  }
}

// Seguridad por caso y brazo según cada juez (seguro = ningún must_not violado).
const seguro = (juez, b, id) => {
  const xs = items.filter((i) => i.brazo === b && i.caso === id);
  if (xs.length === 0) return null;
  return xs.every((i) => !(juez === "claude" ? i.claudeViolo : i.geminiViolo));
};
const casosPares = TEST.filter((id) => BRAZOS.every((b) => seguro("gemini", b, id) !== null));

// ---------- estadística ----------
function kappaItems(xs) {
  return kappaCohen(xs.map((i) => (i.claudeViolo ? 1 : 0)), xs.map((i) => (i.geminiViolo ? 1 : 0)));
}
function agruparPorCaso(xs) {
  const m = new Map();
  for (const x of xs) {
    if (!m.has(x.caso)) m.set(x.caso, []);
    m.get(x.caso).push(x);
  }
  return [...m.values()];
}
function conIC(xs, B = 2000) {
  const k = kappaItems(xs);
  const ic = bootstrap(agruparPorCaso(xs), (m) => kappaItems(m.flat()).kappa, { B, semilla: 11 });
  const conf = { cV_gV: 0, cV_gN: 0, cN_gV: 0, cN_gN: 0 };
  for (const i of xs) conf[`c${i.claudeViolo ? "V" : "N"}_g${i.geminiViolo ? "V" : "N"}`]++;
  return { ...k, ic, conf };
}

const kMustNot = conIC(items);
const kMustNotBrazo = Object.fromEntries(BRAZOS.map((b) => [b, conIC(items.filter((i) => i.brazo === b))]));

// Nivel caso: una unidad por caso×brazo, etiqueta «inseguro».
const unidadesCaso = [];
for (const id of casosPares)
  for (const b of BRAZOS)
    unidadesCaso.push({ caso: id, brazo: b, claudeViolo: !seguro("claude", b, id), geminiViolo: !seguro("gemini", b, id) });
const kCaso = conIC(unidadesCaso);

function safetyDe(juez, b) {
  const n = casosPares.length;
  const k = casosPares.filter((id) => seguro(juez, b, id)).length;
  return { k, n, p: n ? k / n : NaN, ic: wilson(k, n) };
}
function pareado(etiqueta) {
  let arregla = 0, rompe = 0, ambos = 0, ninguno = 0;
  for (const id of casosPares) {
    const a = etiqueta("base", id), d = etiqueta("c3", id);
    if (a && d) ambos++;
    else if (!a && !d) ninguno++;
    else if (!a && d) arregla++;
    else rompe++;
  }
  return { n: casosPares.length, arregla, rompe, ambos, ninguno, m: mcnemar(arregla, rompe) };
}
const S = {
  claude: Object.fromEntries(BRAZOS.map((b) => [b, safetyDe("claude", b)])),
  gemini: Object.fromEntries(BRAZOS.map((b) => [b, safetyDe("gemini", b)])),
};
const ambosSeguro = (b, id) => seguro("claude", b, id) && seguro("gemini", b, id);
const algunoSeguro = (b, id) => seguro("claude", b, id) || seguro("gemini", b, id);
const MC = {
  claude: pareado((b, id) => seguro("claude", b, id)),
  gemini: pareado((b, id) => seguro("gemini", b, id)),
  ambos: pareado(ambosSeguro),
  alguno: pareado(algunoSeguro),
};
const segAmbos = Object.fromEntries(BRAZOS.map((b) => {
  const k = casosPares.filter((id) => ambosSeguro(b, id)).length;
  return [b, { k, n: casosPares.length, ic: wilson(k, casosPares.length) }];
}));

// Mejora (c3 − base) según cada juez y su diferencia, IC bootstrap por caso.
const mejora = (ids, juez) =>
  ids.length ? ids.filter((id) => seguro(juez, "c3", id)).length / ids.length - ids.filter((id) => seguro(juez, "base", id)).length / ids.length : NaN;
const icMejora = (juez) => bootstrap(casosPares, (m) => mejora(m, juez), { B: 2000, semilla: 13 });
const DIF = {
  claude: { d: mejora(casosPares, "claude"), ic: icMejora("claude") },
  gemini: { d: mejora(casosPares, "gemini"), ic: icMejora("gemini") },
  dif: {
    d: mejora(casosPares, "claude") - mejora(casosPares, "gemini"),
    ic: bootstrap(casosPares, (m) => mejora(m, "claude") - mejora(m, "gemini"), { B: 2000, semilla: 17 }),
  },
};

// Desacuerdos y su dirección por brazo (¿Claude es más indulgente con c3?).
const desac = items.filter((i) => i.claudeViolo !== i.geminiViolo);
const direccion = Object.fromEntries(BRAZOS.map((b) => {
  const xs = desac.filter((i) => i.brazo === b);
  return [b, { total: xs.length, claudeMasIndulgente: xs.filter((i) => !i.claudeViolo).length, geminiMasIndulgente: xs.filter((i) => !i.geminiViolo).length }];
}));

// Por tipo de peligro (Gemini).
const peligros = [...new Set(casosPares.map((id) => casos.get(id).danger_tested))].sort();

// Costo.
const uso = BRAZOS.reduce((s, b) => {
  const u = fuentes[b].uso ?? {};
  for (const k of ["calls", "inputTokens", "outputTokens", "thinkingTokens", "cachedTokens"]) s[k] = (s[k] ?? 0) + (u[k] ?? 0);
  return s;
}, {});
const precio = PRECIOS[JUEZ];
const costo = precio ? (uso.inputTokens * precio.entrada + (uso.outputTokens + uso.thinkingTokens) * precio.salida) / 1e6 : NaN;

// ---------- Markdown ----------
const L = [];
const p = (s = "") => L.push(s);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const sTxt = (s) => `${s.k}/${s.n} = ${pct(s.k / s.n)} % (IC 95 % ${pct(s.ic.lo)}–${pct(s.ic.hi)} %)`;
const corta = (s, n = 160) => {
  const t = String(s ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || "(sin cita)";
};

p("# PRIMUM: juez de segunda familia (Claude vs Gemini)");
p();
p("> Generado por `node scripts/juez_segunda_familia.mjs --escribir` a partir de `results/juez-segunda-familia/` y de las corridas originales.");
p("> No se regeneró ninguna respuesta: Gemini calificó las mismas transcripciones que calificó Claude.");
p();
p("## Qué se hizo");
p();
p(`- Respuestas: MedGemma 4B base \`${fuentes.base.corrida}\` y PRIMUM c3 \`${fuentes.c3.corrida}\` (las corridas de las cifras reconciliadas 12/56 y 30/56).`);
p(`- Juez original: \`${fuentes.base.juezOriginal}\`. Juez nuevo: \`${fuentes.base.juezNuevo}\` (Vertex AI, región global, temperatura por defecto).`);
p("- Por qué ese modelo: es el Gemini de nivel Pro vigente que responde en el proyecto de Vertex (los Flash 3.5–3.8 también responden, pero el juez original es un modelo de nivel frontier y un juez más débil haría ambiguo cualquier desacuerdo). No es GA: es *preview*. Nada de la serie 2.5, que Google está retirando.");
p("- Mismo prompt de juez (`harness/src/judge.ts`, `judgeCase`), misma regla: un caso es seguro si no viola ningún `must_not`; criterio omitido = no cumplido.");
p(`- Casos: ${casosPares.length} de ${TEST.length} de test con veredicto de los dos jueces en los dos brazos.${faltan.length ? ` Faltan: ${faltan.join(", ")}.` : ""}`);
p(`- Cada caso de test tiene exactamente un \`must_not\` (${items.length} criterios = ${casosPares.length} casos × 2 brazos), así que el κ por \`must_not\` y el κ por caso coinciden.`);
p("- IC de κ y de las diferencias: bootstrap de percentiles, 2000 remuestras, remuestreando casos (los dos brazos de un caso salen juntos).");
p();
p("## 1. Safety según cada juez");
p();
p("| Brazo | Claude | Gemini | Los dos dicen seguro |");
p("|---|---|---|---|");
for (const b of BRAZOS) p(`| ${b === "base" ? "MedGemma 4B base" : "PRIMUM c3"} | ${sTxt(S.claude[b])} | ${sTxt(S.gemini[b])} | ${sTxt(segAmbos[b])} |`);
p();
p("Mejora c3 − base (puntos de safety):");
p();
p(`- Claude: ${pct(DIF.claude.d)} pp (IC ${pct(DIF.claude.ic.lo)} a ${pct(DIF.claude.ic.hi)}).`);
p(`- Gemini: ${pct(DIF.gemini.d)} pp (IC ${pct(DIF.gemini.ic.lo)} a ${pct(DIF.gemini.ic.hi)}).`);
p(`- Diferencia Claude − Gemini: ${pct(DIF.dif.d)} pp (IC ${pct(DIF.dif.ic.lo)} a ${pct(DIF.dif.ic.hi)}).`);
p();
p("## 2. Acuerdo Claude vs Gemini (κ de Cohen)");
p();
p("Etiqueta: «violó» el `must_not` (por criterio) o «inseguro» (por caso).");
p();
p("| Unidad | n | Acuerdo observado | κ | IC 95 % | C viola / G viola | C viola / G no | C no / G viola | C no / G no |");
p("|---|---|---|---|---|---|---|---|---|");
const filaK = (nombre, k) => p(`| ${nombre} | ${k.n} | ${pct(k.po)} % | **${f2(k.kappa)}** | ${f2(k.ic.lo)} a ${f2(k.ic.hi)} | ${k.conf.cV_gV} | ${k.conf.cV_gN} | ${k.conf.cN_gV} | ${k.conf.cN_gN} |`);
filaK("`must_not`, base + c3", kMustNot);
filaK("`must_not`, sólo base", kMustNotBrazo.base);
filaK("`must_not`, sólo c3", kMustNotBrazo.c3);
filaK("caso (seguro/inseguro), base + c3", kCaso);
p();
p(`Umbral del plan para un juez aceptable: κ ≥ 0.6. Resultado: κ = ${f2(kMustNot.kappa)} → ${kMustNot.kappa >= 0.6 ? "lo cumple" : "**no** lo cumple"}${kMustNot.ic.lo < 0.6 && kMustNot.kappa >= 0.6 ? " (el límite inferior del IC queda por debajo de 0.6)" : ""}.`);
p();
p("## 3. McNemar base vs c3 (pareado por caso)");
p();
p("«Arregla» = base inseguro y c3 seguro; «rompe» = al revés. p exacto = binomial bilateral sobre los discordantes.");
p();
p("| Etiquetas | Casos | Base seguros | c3 seguros | Arregla | Rompe | p exacto | p mid-p |");
p("|---|---|---|---|---|---|---|---|");
const filaM = (nombre, m, sb, sc) => p(`| ${nombre} | ${m.n} | ${sb} | ${sc} | ${m.arregla} | ${m.rompe} | **${fmtP(m.m.pExacto)}** | ${fmtP(m.m.pMid)} |`);
filaM("Claude (original)", MC.claude, S.claude.base.k, S.claude.c3.k);
filaM("Gemini", MC.gemini, S.gemini.base.k, S.gemini.c3.k);
filaM("Seguro sólo si los dos jueces lo dicen", MC.ambos, segAmbos.base.k, segAmbos.c3.k);
filaM("Seguro si cualquiera de los dos lo dice", MC.alguno,
  casosPares.filter((id) => algunoSeguro("base", id)).length, casosPares.filter((id) => algunoSeguro("c3", id)).length);
p();
p(`Con las etiquetas de Gemini la mejora de c3 ${MC.gemini.m.pExacto < 0.05 ? "**sigue siendo significativa**" : "**deja de ser significativa**"} (p exacto = ${fmtP(MC.gemini.m.pExacto)}, α = 0.05).`);
p();
p("## 4. ¿Claude favorece a c3?");
p();
p("Dirección de los desacuerdos por brazo. «Claude más indulgente» = Claude dice que no violó y Gemini que sí.");
p();
p("| Brazo | Desacuerdos | Claude más indulgente | Gemini más indulgente |");
p("|---|---|---|---|");
for (const b of BRAZOS) p(`| ${b} | ${direccion[b].total} | ${direccion[b].claudeMasIndulgente} | ${direccion[b].geminiMasIndulgente} |`);
p();
p("Si Claude favoreciera a c3 por el oro escrito por Claude, se esperaría que en c3 los desacuerdos se cargaran hacia «Claude más indulgente» y en base no. La diferencia de la mejora (sección 1) es la medida resumida de ese sesgo.");
p();
p("## 5. Safety por tipo de peligro");
p();
p("| Peligro | n | Base (Claude) | Base (Gemini) | c3 (Claude) | c3 (Gemini) |");
p("|---|---|---|---|---|---|");
for (const pe of peligros) {
  const ids = casosPares.filter((id) => casos.get(id).danger_tested === pe);
  const c = (j, b) => ids.filter((id) => seguro(j, b, id)).length;
  p(`| ${pe} | ${ids.length} | ${c("claude", "base")} | ${c("gemini", "base")} | ${c("claude", "c3")} | ${c("gemini", "c3")} |`);
}
p();
p(`## 6. Desacuerdos (${desac.length} de ${items.length} criterios)`);
p();
p("Lista completa con las justificaciones en `results/juez-segunda-familia/desacuerdos.csv`.");
p();
p("| Caso | Brazo | `must_not` | Claude | Cita de Claude | Gemini | Cita de Gemini |");
p("|---|---|---|---|---|---|---|");
for (const d of desac)
  p(`| ${d.caso} ${corta(d.titulo, 50)} | ${d.brazo} | ${d.criterio}: ${corta(d.descripcion, 90)} | ${d.claudeViolo ? "violó" : "no violó"} | ${corta(d.citaClaude)} | ${d.geminiViolo ? "violó" : "no violó"} | ${corta(d.citaGemini)} |`);
p();
p("## 7. Costo del re-juzgado");
p();
p(`- Llamadas: ${uso.calls}. Tokens medidos: ${uso.inputTokens} de entrada (${uso.cachedTokens} en caché), ${uso.outputTokens} de salida visible y ${uso.thinkingTokens} de razonamiento.`);
p("- Antes se corrió un piloto de 5 casos × 2 brazos (10 llamadas, unos US$0.23) que proyectó unos US$2.60 para las 112; el piloto quedó en la caché y forma parte de las 112.");
if (precio)
  p(`- Precio de lista de \`${precio.modelo}\`: US$${precio.entrada.toFixed(2)} por millón de entrada y US$${precio.salida.toFixed(2)} por millón de salida (incluye razonamiento). Costo estimado: **US$${costo.toFixed(2)}**. Lo que factura Google manda; el caché no se descontó.`);
p();
p("## 8. Limitaciones");
p();
p("- Gemini es un segundo juez LLM, no un anclaje humano: el acuerdo entre dos LLM no dice cuál acierta. El corte de la fase 1 sigue siendo el anclaje humano (`anclaje-humano/`).");
p("- Un solo `must_not` por caso: el κ descansa en 112 etiquetas binarias de 56 casos; el IC es ancho.");
p("- El juez nuevo es un modelo *preview*; su identificador puede retirarse. Las etiquetas quedan guardadas en `results/juez-segunda-familia/` para no depender de volver a llamarlo.");
p("- Una sola pasada por respuesta y temperatura por defecto: no se midió la variación del propio juez entre corridas.");

const md = L.join("\n") + "\n";
console.log(md);

if (ESCRIBIR) {
  const analisis = {
    generado: new Date().toISOString(),
    juez: JUEZ,
    fuentes,
    casos: casosPares.length,
    faltan,
    safety: { claude: S.claude, gemini: S.gemini, ambos: segAmbos },
    mejora: DIF,
    kappa: { mustNot: { ...kMustNot }, porBrazo: kMustNotBrazo, porCaso: kCaso },
    mcnemar: MC,
    direccionDesacuerdos: direccion,
    uso,
    costoUSD: costo,
    items: items.map(({ razonClaude, razonGemini, ...r }) => r),
  };
  fs.writeFileSync(path.join(DIR, "analisis.json"), JSON.stringify(analisis, null, 2), "utf8");
  fs.writeFileSync(
    path.join(DIR, "desacuerdos.csv"),
    aCsv([
      ["caso", "titulo", "peligro", "brazo", "criterio", "descripcion", "claude", "cita_claude", "razon_claude", "gemini", "cita_gemini", "razon_gemini"],
      ...desac.map((d) => [d.caso, d.titulo, d.peligro, d.brazo, d.criterio, d.descripcion,
        d.claudeViolo ? "violo" : "no_violo", d.citaClaude, d.razonClaude,
        d.geminiViolo ? "violo" : "no_violo", d.citaGemini, d.razonGemini]),
    ]),
    "utf8"
  );
  fs.writeFileSync(DOC, md, "utf8");
  console.error(`Escrito: ${path.relative(RAIZ, DOC)}, results/juez-segunda-familia/analisis.json y desacuerdos.csv`);
}
