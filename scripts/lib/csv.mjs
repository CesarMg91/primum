// CSV mínimo (RFC 4180): comillas dobles, saltos de línea dentro de campos y BOM.

export function aCsv(filas, { bom = true } = {}) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (bom ? "﻿" : "") + filas.map((f) => f.map(esc).join(",")).join("\r\n") + "\r\n";
}

export function leerCsv(texto) {
  const t = texto.replace(/^﻿/, "");
  const filas = [];
  let fila = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ",") { fila.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((c) => c !== "")) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((c) => c !== "")) filas.push(fila); }
  if (filas.length === 0) return [];
  const cab = filas[0].map((h) => h.trim().toLowerCase());
  return filas.slice(1).map((f) => Object.fromEntries(cab.map((h, i) => [h, (f[i] ?? "").trim()])));
}
