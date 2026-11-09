#!/usr/bin/env node
// Prueba de calcular_anclaje.mjs con calificaciones SIMULADAS (no son datos reales).
// Escribe los CSV simulados en un directorio temporal, nunca en calificaciones/.
//
// Uso: node anclaje-humano/prueba_simulada.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { prng } from "../scripts/lib/estadistica.mjs";
import { aCsv } from "../scripts/lib/csv.mjs";
import { calcular, leerCalificaciones, normalizar } from "./calcular_anclaje.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const clave = JSON.parse(fs.readFileSync(path.join(AQUI, "clave", "clave.json"), "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "primum-anclaje-"));

// Calificador simulado: copia al juez, voltea con prob. `volteo`, marca dudoso con prob. `dudoso`.
function simular(nombre, { volteo, dudoso, semilla, soloColega = false, etiquetas = "codigo" }) {
  const rnd = prng(semilla);
  const filas = [["calificador", "item", "criterio_uid", "calificacion", "nota", "fecha"]];
  for (const [item, x] of Object.entries(clave.items)) {
    if (soloColega && !x.colega) continue;
    for (const v of x.veredictos) {
      let violo = v.violo;
      if (rnd() < volteo) violo = !violo;
      let cal = violo ? "violo" : "no_violo";
      if (rnd() < dudoso) cal = "dudoso";
      if (etiquetas === "texto") cal = { violo: "Violó", no_violo: "No violó", dudoso: "Dudoso" }[cal];
      filas.push([nombre, item, v.uid, cal, cal.includes("ud") ? "simulado" : "", ""]);
    }
  }
  const f = path.join(tmp, `${nombre}.csv`);
  fs.writeFileSync(f, aCsv(filas));
  return f;
}

let ok = 0;
const caso = (n, fn) => { fn(); ok++; console.log(`✓ ${n}`); };

caso("normalizar acepta las variantes", () => {
  assert.equal(normalizar("Violó"), "violo");
  assert.equal(normalizar("No violó"), "no_violo");
  assert.equal(normalizar("no_violo"), "no_violo");
  assert.equal(normalizar(" DUDOSO "), "dudoso");
  assert.equal(normalizar(""), null);
});

caso("humano idéntico al juez → κ = 1 y misma cifra que el juez", () => {
  const a = simular("espejo", { volteo: 0, dudoso: 0, semilla: 1, etiquetas: "texto" });
  const { resumen: r } = calcular({ clave, porCal: leerCalificaciones([a]) });
  assert.equal(r.faltan, 0);
  assert.equal(r.kappa, 1);
  assert.equal(r.humano.sb, r.juez.sb);
  assert.equal(r.humano.sc, r.juez.sc);
  assert.equal(r.humano.arregla, r.juez.arregla);
  assert.equal(r.desacuerdos, 0);
  // Las cifras del juez deben ser las de la reconciliación: 12/56 y 30/56, 21 arregla y 3 rompe.
  assert.deepEqual([r.juez.sb, r.juez.nb, r.juez.sc, r.juez.nc, r.juez.arregla, r.juez.rompe], [12, 56, 30, 56, 21, 3]);
  assert.match(r.decision, /cifra del juez/);
});

caso("humano con 15 % de desacuerdo y 5 % dudosos + colega → κ intermedio y reporte completo", () => {
  const a = simular("cesar", { volteo: 0.15, dudoso: 0.05, semilla: 2 });
  const b = simular("colega", { volteo: 0.15, dudoso: 0.05, semilla: 3, soloColega: true });
  const { md, resumen: r } = calcular({ clave, porCal: leerCalificaciones([a, b]), principal: "cesar" });
  assert.ok(r.kappa > 0.4 && r.kappa < 0.95, `κ fuera de rango: ${r.kappa}`);
  assert.ok(r.kappaIC.lo <= r.kappa && r.kappa <= r.kappaIC.hi);
  assert.ok(r.kHH && r.kHH.k3.n === 20, "el colega debe compartir 20 ítems");
  assert.ok(r.desacuerdos > 0);
  for (const s of ["κ de Cohen", "κ entre humanos", "Regla de decisión", "Desacuerdos"]) assert.ok(md.includes(s), s);
  fs.writeFileSync(path.join(tmp, "reporte-simulado.md"), md);
});

caso("humano al azar → κ ≈ 0 y la regla manda la cifra humana", () => {
  const a = simular("azar", { volteo: 0.5, dudoso: 0, semilla: 4 });
  const { resumen: r } = calcular({ clave, porCal: leerCalificaciones([a]) });
  assert.ok(Math.abs(r.kappa) < 0.3, `κ = ${r.kappa}`);
  assert.match(r.decision, /HUMANA/);
});

caso("calificación incompleta → resultado preliminar", () => {
  const a = simular("parcial", { volteo: 0, dudoso: 0, semilla: 5, soloColega: true });
  const { resumen: r } = calcular({ clave, porCal: leerCalificaciones([a]) });
  assert.equal(r.faltan, 92);
  assert.match(r.decision, /PRELIMINAR/);
});

console.log(`\n${ok} pruebas en verde. CSV y reporte simulados en: ${tmp}`);
