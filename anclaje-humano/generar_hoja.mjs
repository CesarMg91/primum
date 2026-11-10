#!/usr/bin/env node
// Genera el paquete de calificación a ciegas del anclaje humano de PRIMUM.
//
// Para cada uno de los 56 casos de test toma la respuesta de MedGemma 4B base y la
// de PRIMUM c3 (las corridas completas 56/56), las revuelve con una semilla fija y
// escribe:
//   anclaje-humano/hoja-calificacion.html  página local autocontenida (localStorage + exportar CSV)
//   anclaje-humano/hoja-calificacion.csv   la misma hoja en CSV (para Sheets/Excel)
//   anclaje-humano/clave/clave.json        clave de desciframiento: qué modelo es cada respuesta
//                                          y el veredicto del juez. NO se abre hasta terminar.
//
// Muestra de César: 20 de los 56 casos, estratificados por `danger_tested` (asignación
// proporcional por resto mayor), con sus DOS respuestas: 40 ítems en 3 bloques (14, 13, 13),
// en un orden propio donde las dos respuestas de un caso quedan a ≥ 8 posiciones. La
// selección depende sólo del tipo de peligro y de la semilla, nunca de los veredictos.
// El colega califica 20 de esos 40 (10 respuestas base y 10 de c3, una por caso).
// El orden global R001–R112 no cambia: «Todas (112)» sigue disponible.
//
// Ni la página ni el CSV muestran qué modelo respondió ni el veredicto del juez.
// Es determinista: misma semilla + mismos results/*.json → mismos archivos.
//
// Uso (desde la raíz del repo):  node anclaje-humano/generar_hoja.mjs

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { prng, barajar } from "../scripts/lib/estadistica.mjs";
import { aCsv } from "../scripts/lib/csv.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const YAML = createRequire(path.join(RAIZ, "harness", "package.json"))("yaml");

export const SEMILLA = 20261109;
export const CORRIDAS = {
  base: "ollama-medgemma-4b-2026-06-13t23-22-40-962z.json",
  c3: "ollama-primum-medgemma-c3-2026-06-15t01-02-17-053z.json",
};
const TAM_BLOQUE = 28;
const N_CASOS_MUESTRA = 20; // × 2 respuestas = 40 ítems para César
const BLOQUES_MUESTRA = [14, 13, 13];
const N_COLEGA = 20; // 10 base + 10 c3, de los 20 casos de la muestra
const DISTANCIA_MIN = 8; // las dos respuestas del mismo caso, al menos a 8 posiciones
const PALABRAS_POR_MIN = 250; // lectura atenta de texto clínico en español
const SEG_DECISION = 40; // marcar y, si hace falta, anotar

// ---------- datos ----------
const split = JSON.parse(fs.readFileSync(path.join(RAIZ, "cases", "split.json"), "utf8"));
const casos = new Map();
for (const f of fs.readdirSync(path.join(RAIZ, "cases"))) {
  if (!/^\d{4}.*\.ya?ml$/.test(f)) continue;
  const c = YAML.parse(fs.readFileSync(path.join(RAIZ, "cases", f), "utf8"));
  casos.set(c.id, c);
}
const corrida = (brazo) => {
  const p = path.join(RAIZ, "results", CORRIDAS[brazo]);
  if (!fs.existsSync(p)) throw new Error(`Falta ${p}. Los results/*.json no están en git: corre esto en la máquina que los tiene.`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return new Map(j.results.map((r) => [r.caseId, { ...r, juez: j.judge }]));
};
const res = { base: corrida("base"), c3: corrida("c3") };

// ---------- ítems ----------
const crudos = [];
for (const id of split.test) {
  const c = casos.get(id);
  if (!c) throw new Error(`Caso ${id} no encontrado en cases/`);
  for (const brazo of ["base", "c3"]) {
    const r = res[brazo].get(id);
    if (!r) throw new Error(`La corrida ${brazo} no tiene el caso ${id}`);
    const turnos = r.transcript
      .filter((m) => m.role !== "system")
      .map((m) => ({ quien: m.role === "user" ? "Paciente" : "Asistente", texto: m.content }));
    const criterios = c.rubric.filter((k) => k.type === "must_not");
    crudos.push({ caso: id, brazo, c, r, turnos, criterios });
  }
}

// Orden: barajar con semilla y repetir hasta que las dos respuestas de un caso queden separadas.
const rnd = prng(SEMILLA);
let orden;
for (let intento = 0; intento < 5000; intento++) {
  orden = barajar(crudos, rnd);
  const pos = new Map();
  let ok = true;
  orden.forEach((x, i) => {
    if (pos.has(x.caso) && i - pos.get(x.caso) < DISTANCIA_MIN) ok = false;
    pos.set(x.caso, i);
  });
  if (ok) break;
}

/** Menor distancia entre las dos respuestas de un mismo caso en una lista ordenada. */
function distanciaMinima(lista) {
  const pos = new Map();
  let min = Infinity;
  lista.forEach((x, i) => {
    if (pos.has(x.caso)) min = Math.min(min, i - pos.get(x.caso));
    pos.set(x.caso, i);
  });
  return min;
}

// Muestra de César: 20 casos estratificados por danger_tested, asignación proporcional por
// resto mayor. Sólo depende del tipo de peligro y de la semilla (nunca de los veredictos).
// Con prng(SEMILLA + 2): primero se baraja el orden de los estratos (desempate de restos
// iguales) y luego, estrato por estrato en orden alfabético, se barajan sus casos y se toma la cuota.
const estratos = new Map();
for (const id of [...split.test].sort()) {
  const d = casos.get(id).danger_tested;
  if (!d) throw new Error(`El caso ${id} no tiene danger_tested`);
  if (!estratos.has(d)) estratos.set(d, []);
  estratos.get(d).push(id);
}
const N_TEST = split.test.length;
const rndMuestra = prng(SEMILLA + 2);
const nombresEstratos = [...estratos.keys()].sort();
const desempate = new Map(barajar(nombresEstratos, rndMuestra).map((d, i) => [d, i]));
const cuotas = new Map(nombresEstratos.map((d) => [d, Math.floor((N_CASOS_MUESTRA * estratos.get(d).length) / N_TEST)]));
const restos = nombresEstratos
  // resto exacto en enteros (20·n mod 56): sin empates falsos por punto flotante
  .map((d) => ({ d, resto: (N_CASOS_MUESTRA * estratos.get(d).length) % N_TEST }))
  .sort((a, b) => b.resto - a.resto || desempate.get(a.d) - desempate.get(b.d));
let faltanCuota = N_CASOS_MUESTRA - [...cuotas.values()].reduce((s, n) => s + n, 0);
for (const { d } of restos) {
  if (faltanCuota <= 0) break;
  cuotas.set(d, cuotas.get(d) + 1);
  faltanCuota--;
}
const casosMuestra = [];
for (const d of nombresEstratos) casosMuestra.push(...barajar(estratos.get(d), rndMuestra).slice(0, cuotas.get(d)));
if (casosMuestra.length !== N_CASOS_MUESTRA) throw new Error(`La muestra tiene ${casosMuestra.length} casos, no ${N_CASOS_MUESTRA}`);
const enMuestra = new Set(casosMuestra);
const muestraPorEstrato = Object.fromEntries(
  [...nombresEstratos]
    .sort((a, b) => estratos.get(b).length - estratos.get(a).length || a.localeCompare(b))
    .map((d) => [d, { test: estratos.get(d).length, muestra: cuotas.get(d) }])
);

// Orden propio de la muestra: barajado con prng(SEMILLA + 3), repetido hasta que las dos
// respuestas de cada caso queden a ≥ DISTANCIA_MIN posiciones.
const rndOrdenMuestra = prng(SEMILLA + 3);
const crudosMuestra = orden.filter((x) => enMuestra.has(x.caso));
let ordenMuestra = null;
let intentosMuestra = 0;
while (intentosMuestra < 200000) {
  intentosMuestra++;
  const cand = barajar(crudosMuestra, rndOrdenMuestra);
  if (distanciaMinima(cand) >= DISTANCIA_MIN) { ordenMuestra = cand; break; }
}
if (!ordenMuestra) throw new Error(`No encontré un orden de la muestra con distancia ≥ ${DISTANCIA_MIN} en ${intentosMuestra} intentos`);
const posMuestra = new Map(ordenMuestra.map((x, i) => [x, i + 1]));
const bloqueDePos = (p) => {
  let acum = 0;
  for (let b = 0; b < BLOQUES_MUESTRA.length; b++) {
    acum += BLOQUES_MUESTRA[b];
    if (p <= acum) return b + 1;
  }
  throw new Error(`Posición ${p} fuera de los bloques de la muestra`);
};

// Subconjunto del colega: los 20 casos de la muestra, 10 con la respuesta base y 10 con la de c3.
// Así cada ítem del colega también lo califica César.
const casosColega = barajar([...casosMuestra].sort(), prng(SEMILLA + 1)).slice(0, N_COLEGA);
const colegaPar = new Map(casosColega.map((id, i) => [id, i < N_COLEGA / 2 ? "base" : "c3"]));

const items = orden.map((x, i) => {
  const item = `R${String(i + 1).padStart(3, "0")}`;
  const palabras = x.turnos.map((t) => t.texto).join(" ").split(/\s+/).length;
  const om = posMuestra.get(x) ?? null;
  return {
    item,
    bloque: Math.floor(i / TAM_BLOQUE) + 1,
    muestra: om !== null,
    ordenMuestra: om,
    bloqueMuestra: om === null ? null : bloqueDePos(om),
    colega: colegaPar.get(x.caso) === x.brazo,
    caso: x.caso,
    titulo: x.c.title,
    especialidad: x.c.specialty,
    contexto: (x.c.patient?.context ?? "").trim(),
    turnos: x.turnos,
    criterios: x.criterios.map((k) => ({ uid: `${item}-${k.id}`, id: k.id, texto: k.description })),
    palabras,
    _clave: {
      brazo: x.brazo,
      archivo: CORRIDAS[x.brazo],
      juez: x.r.juez,
      veredictos: x.criterios.map((k) => {
        const v = x.r.verdicts.find((y) => y.id === k.id);
        return {
          uid: `${item}-${k.id}`,
          criterio: k.id,
          violo: !(v?.satisfied ?? false), // must_not: satisfied=true → no violó
          cita: v?.quote ?? "",
          razon: v?.rationale ?? "",
        };
      }),
      seguroSegunJuez: x.r.safe,
    },
  };
});

// ---------- estimación de tiempo ----------
const minutos = (lista) => lista.reduce((s, x) => s + x.palabras / PALABRAS_POR_MIN + SEG_DECISION / 60, 0);
const tTotal = minutos(items);
const tBloques = [...new Set(items.map((x) => x.bloque))].map((b) => minutos(items.filter((x) => x.bloque === b)));
const tColega = minutos(items.filter((x) => x.colega));
const deMuestra = items.filter((x) => x.muestra);
const tMuestra = minutos(deMuestra);
const tBloquesMuestra = BLOQUES_MUESTRA.map((_, b) => minutos(deMuestra.filter((x) => x.bloqueMuestra === b + 1)));
const estimacion = {
  supuestos: `${PALABRAS_POR_MIN} palabras/min + ${SEG_DECISION} s por decisión`,
  totalHoras: +(tTotal / 60).toFixed(1),
  porBloqueMin: tBloques.map((m) => Math.round(m)),
  muestra: {
    totalHoras: +(tMuestra / 60).toFixed(1),
    totalMin: Math.round(tMuestra),
    porBloqueMin: tBloquesMuestra.map((m) => Math.round(m)),
  },
  colegaMin: Math.round(tColega),
  palabrasMediana: (() => {
    const p = items.map((x) => x.palabras).sort((a, b) => a - b);
    return p[Math.floor(p.length / 2)];
  })(),
};

// ---------- salidas ----------
const publico = items.map(({ _clave, ...x }) => x);
const meta = {
  version: 1,
  semilla: SEMILLA,
  generado: new Date().toISOString().slice(0, 10),
  nItems: items.length,
  nCriterios: items.reduce((s, x) => s + x.criterios.length, 0),
  nColega: items.filter((x) => x.colega).length,
  nMuestra: deMuestra.length,
  nCasosMuestra: N_CASOS_MUESTRA,
  bloquesMuestra: BLOQUES_MUESTRA,
  distanciaMinMuestra: distanciaMinima(ordenMuestra),
  muestraPorEstrato,
  tamBloque: TAM_BLOQUE,
  estimacion,
};

// 1. Clave (aparte)
fs.mkdirSync(path.join(AQUI, "clave"), { recursive: true });
fs.writeFileSync(
  path.join(AQUI, "clave", "clave.json"),
  JSON.stringify(
    {
      aviso: "CLAVE DE DESCIFRAMIENTO. No abrir hasta terminar de calificar. La usa calcular_anclaje.mjs.",
      semilla: SEMILLA,
      corridas: CORRIDAS,
      muestra: { nItems: deMuestra.length, nCasos: N_CASOS_MUESTRA, porEstrato: muestraPorEstrato },
      items: Object.fromEntries(
        items.map((x) => [x.item, { caso: x.caso, muestra: x.muestra, ordenMuestra: x.ordenMuestra, colega: x.colega, ...x._clave }])
      ),
    },
    null,
    1
  ) + "\n"
);

// 2. CSV (una fila por criterio must_not)
const filas = [["calificador", "item", "bloque", "muestra", "orden_muestra", "colega", "caso", "titulo", "criterio_uid", "criterio", "contexto", "conversacion", "calificacion", "nota"]];
for (const x of publico) {
  const conv = x.turnos.map((t) => `${t.quien.toUpperCase()}: ${t.texto}`).join("\n\n");
  for (const k of x.criterios) {
    filas.push(["", x.item, x.bloque, x.muestra ? "si" : "no", x.ordenMuestra ?? "", x.colega ? "si" : "no", x.caso, x.titulo, k.uid, k.texto, x.contexto, conv, "", ""]);
  }
}
fs.writeFileSync(path.join(AQUI, "hoja-calificacion.csv"), aCsv(filas));

// 3. HTML autocontenido
const plantilla = fs.readFileSync(path.join(AQUI, "plantilla.html"), "utf8");
const datos = JSON.stringify({ meta, items: publico }).replace(/</g, "\\u003c");
if (!plantilla.includes("/*__DATOS__*/null")) throw new Error("plantilla.html sin el marcador /*__DATOS__*/null");
fs.writeFileSync(path.join(AQUI, "hoja-calificacion.html"), plantilla.replace("/*__DATOS__*/null", () => datos));

const em = estimacion.muestra;
const estratosTxt = Object.entries(muestraPorEstrato).map(([d, v]) => `${d} ${v.test}→${v.muestra}`).join(", ");
console.log(
  `Listo: ${meta.nItems} respuestas (${meta.nCriterios} criterios must_not), ${tBloques.length} bloques de ${TAM_BLOQUE}.\n` +
    `Muestra de César: ${meta.nMuestra} ítems de ${N_CASOS_MUESTRA} casos, bloques de ${BLOQUES_MUESTRA.join("/")}; ` +
    `distancia mínima entre las dos respuestas de un caso: ${meta.distanciaMinMuestra} (${intentosMuestra} barajados).\n` +
    `Por estrato (test → muestra): ${estratosTxt}.\n` +
    `Colega: ${meta.nColega} ítems, todos dentro de la muestra.\n` +
    `Tiempo estimado (${estimacion.supuestos}): muestra ${em.totalHoras} h (${em.totalMin} min), bloques ${em.porBloqueMin.join(", ")} min; ` +
    `colega ${estimacion.colegaMin} min; las 112, ${estimacion.totalHoras} h. Mediana ${estimacion.palabrasMediana} palabras por respuesta.`
);
