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
const N_COLEGA = 20; // 10 base + 10 c3, de 20 casos distintos
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

// Subconjunto del colega: 20 casos distintos, 10 con la respuesta base y 10 con la de c3.
const casosColega = barajar(split.test, prng(SEMILLA + 1)).slice(0, N_COLEGA);
const colegaPar = new Map(casosColega.map((id, i) => [id, i < N_COLEGA / 2 ? "base" : "c3"]));

const items = orden.map((x, i) => {
  const item = `R${String(i + 1).padStart(3, "0")}`;
  const palabras = x.turnos.map((t) => t.texto).join(" ").split(/\s+/).length;
  return {
    item,
    bloque: Math.floor(i / TAM_BLOQUE) + 1,
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
const estimacion = {
  supuestos: `${PALABRAS_POR_MIN} palabras/min + ${SEG_DECISION} s por decisión`,
  totalHoras: +(tTotal / 60).toFixed(1),
  porBloqueMin: tBloques.map((m) => Math.round(m)),
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
      items: Object.fromEntries(items.map((x) => [x.item, { caso: x.caso, colega: x.colega, ...x._clave }])),
    },
    null,
    1
  ) + "\n"
);

// 2. CSV (una fila por criterio must_not)
const filas = [["calificador", "item", "bloque", "colega", "caso", "titulo", "criterio_uid", "criterio", "contexto", "conversacion", "calificacion", "nota"]];
for (const x of publico) {
  const conv = x.turnos.map((t) => `${t.quien.toUpperCase()}: ${t.texto}`).join("\n\n");
  for (const k of x.criterios) {
    filas.push(["", x.item, x.bloque, x.colega ? "si" : "no", x.caso, x.titulo, k.uid, k.texto, x.contexto, conv, "", ""]);
  }
}
fs.writeFileSync(path.join(AQUI, "hoja-calificacion.csv"), aCsv(filas));

// 3. HTML autocontenido
const plantilla = fs.readFileSync(path.join(AQUI, "plantilla.html"), "utf8");
const datos = JSON.stringify({ meta, items: publico }).replace(/</g, "\\u003c");
if (!plantilla.includes("/*__DATOS__*/null")) throw new Error("plantilla.html sin el marcador /*__DATOS__*/null");
fs.writeFileSync(path.join(AQUI, "hoja-calificacion.html"), plantilla.replace("/*__DATOS__*/null", () => datos));

console.log(
  `Listo: ${meta.nItems} respuestas (${meta.nCriterios} criterios must_not), ${tBloques.length} bloques de ${TAM_BLOQUE}, ` +
    `${meta.nColega} para el colega.\nTiempo estimado (${estimacion.supuestos}): ${estimacion.totalHoras} h en total; ` +
    `bloques ${estimacion.porBloqueMin.join(", ")} min; colega ${estimacion.colegaMin} min. ` +
    `Mediana ${estimacion.palabrasMediana} palabras por respuesta.`
);
