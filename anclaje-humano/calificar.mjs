#!/usr/bin/env node
// Abre la hoja de calificación servida desde la laptop, con autoguardado EN DISCO.
//
// Por qué existe: abierta con doble clic (file://), la hoja depende del almacenamiento del
// navegador, y Edge no lo conserva para archivos locales. El 10-nov-2026 César calificó las
// 40 respuestas y se perdieron. Servida desde aquí, cada clic se escribe en
// anclaje-humano/calificaciones/autoguardado-<calificador>.csv (mismo formato que «Exportar CSV»).
//
// Uso (desde la raíz del repo):  node anclaje-humano/calificar.mjs   (o doble clic en calificar.cmd)
// Sólo escucha en 127.0.0.1. Ctrl+C para cerrar.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HOJA = path.join(AQUI, "hoja-calificacion.html");
const DIR = path.join(AQUI, "calificaciones");
const PUERTO = Number(process.env.PUERTO ?? 8766);
const ORIGEN = `http://127.0.0.1:${PUERTO}`;
const CAB = ["calificador", "item", "criterio_uid", "calificacion", "nota", "fecha"];

export function slug(nombre) {
  return String(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "anonimo";
}
const campo = (s) => {
  s = s == null ? "" : String(s);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function aCsv(calificador, filas) {
  return "﻿" + [CAB, ...filas.map((f) => [calificador, f.item, f.uid, f.cal, f.nota ?? "", f.t ?? ""])]
    .map((f) => f.map(campo).join(","))
    .join("\r\n") + "\r\n";
}
function leerCsv(t) {
  t = t.replace(/^﻿/, "");
  const filas = [];
  let f = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; f.push(c); c = ""; filas.push(f); f = []; }
    else c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  const cab = (filas.shift() ?? []).map((h) => h.trim().toLowerCase());
  return filas.filter((r) => r.length > 1).map((r) => Object.fromEntries(cab.map((h, j) => [h, (r[j] ?? "").trim()])));
}
const archivo = (calificador) => path.join(DIR, `autoguardado-${slug(calificador)}.csv`);

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}
function cuerpo(req) {
  return new Promise((ok, mal) => {
    let b = "";
    req.on("data", (d) => { b += d; if (b.length > 5e6) { mal(new Error("demasiado grande")); req.destroy(); } });
    req.on("end", () => ok(b));
  });
}

export function crearServidor() {
  return http.createServer(async (req, res) => {
    // Sólo desde esta máquina: protege contra páginas ajenas que intenten escribir.
    const host = req.headers.host ?? "";
    if (host !== `127.0.0.1:${PUERTO}` && host !== `localhost:${PUERTO}`) return json(res, 403, { error: "host" });
    const origen = req.headers.origin;
    if (req.method === "POST" && origen && origen !== ORIGEN && origen !== `http://localhost:${PUERTO}`) return json(res, 403, { error: "origen" });
    const url = new URL(req.url, ORIGEN);
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/hoja-calificacion.html")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(fs.readFileSync(HOJA));
      }
      if (req.method === "GET" && url.pathname === "/api/cargar") {
        const c = url.searchParams.get("calificador") ?? "";
        const a = archivo(c);
        const filas = fs.existsSync(a) ? leerCsv(fs.readFileSync(a, "utf8")) : [];
        return json(res, 200, { archivo: path.basename(a), filas: filas.map((f) => ({ uid: f.criterio_uid, cal: f.calificacion, nota: f.nota, t: f.fecha })) });
      }
      if (req.method === "POST" && url.pathname === "/api/guardar") {
        const { calificador, filas } = JSON.parse(await cuerpo(req));
        if (!calificador || !Array.isArray(filas)) return json(res, 400, { error: "falta calificador o filas" });
        fs.mkdirSync(DIR, { recursive: true });
        const a = archivo(calificador);
        // Nunca se pierde lo que ya estaba en disco: lo de la página manda, lo demás se conserva.
        const previas = fs.existsSync(a) ? leerCsv(fs.readFileSync(a, "utf8")) : [];
        const porUid = new Map(previas.map((f) => [f.criterio_uid, { item: f.item, uid: f.criterio_uid, cal: f.calificacion, nota: f.nota, t: f.fecha }]));
        for (const f of filas) if (f.uid && f.cal) porUid.set(f.uid, f);
        const tmp = a + ".tmp";
        fs.writeFileSync(tmp, aCsv(calificador, [...porUid.values()]));
        fs.renameSync(tmp, a);
        return json(res, 200, { ok: true, archivo: path.basename(a), n: porUid.size, hora: new Date().toLocaleTimeString("es-MX") });
      }
      json(res, 404, { error: "no existe" });
    } catch (e) {
      json(res, 500, { error: String(e.message ?? e) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  crearServidor().listen(PUERTO, "127.0.0.1", () => {
    console.log(`Hoja de calificación en ${ORIGEN}`);
    console.log(`Cada clic se guarda en ${DIR}\\autoguardado-<tu-nombre>.csv`);
    console.log("Deja esta ventana abierta mientras calificas. Ctrl+C para cerrar.");
    if (!process.env.NO_ABRIR) exec(process.platform === "win32" ? `start "" "${ORIGEN}"` : `xdg-open ${ORIGEN}`);
  });
}
