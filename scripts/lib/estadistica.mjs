// Estadística mínima y sin dependencias para PRIMUM.
// La usan scripts/reconciliar_cifras.mjs y anclaje-humano/calcular_anclaje.mjs.

/** IC de Wilson (sin corrección de continuidad). z = 1.96 → 95 %. */
export function wilson(k, n, z = 1.959963984540054) {
  if (n === 0) return { lo: NaN, hi: NaN };
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / den;
  const media = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { lo: Math.max(0, centro - media), hi: Math.min(1, centro + media) };
}

/** log C(n, k) con logaritmos para no desbordar. */
function logComb(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/** P(X <= k) con X ~ Binomial(n, 1/2). */
function binomCdfHalf(k, n) {
  let s = 0;
  for (let i = 0; i <= k; i++) s += Math.exp(logComb(n, i) - n * Math.LN2);
  return Math.min(1, s);
}

/**
 * McNemar pareado. b = discordantes a favor de B (A falla, B pasa),
 * c = discordantes a favor de A (A pasa, B falla).
 * Devuelve p exacto (binomial bilateral), p mid-p y chi² con corrección de continuidad.
 */
export function mcnemar(b, c) {
  const n = b + c;
  if (n === 0) return { b, c, n, pExacto: 1, pMid: 1, chi2: 0, pChi2: 1 };
  const k = Math.min(b, c);
  const pExacto = Math.min(1, 2 * binomCdfHalf(k, n));
  const pPunto = Math.exp(logComb(n, k) - n * Math.LN2);
  const pMid = Math.min(1, 2 * (binomCdfHalf(k, n) - 0.5 * pPunto));
  const chi2 = (Math.abs(b - c) - 1) ** 2 / n;
  return { b, c, n, pExacto, pMid, chi2, pChi2: chi2SurvivalDf1(chi2) };
}

/** P(chi²₁ > x) = erfc(sqrt(x/2)). */
function chi2SurvivalDf1(x) {
  return erfc(Math.sqrt(x / 2));
}

function erfc(x) {
  // Numerical Recipes, error < 1.2e-7.
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * κ de Cohen para dos listas de etiquetas (cualquier categoría).
 * Devuelve también el acuerdo observado y el esperado.
 */
export function kappaCohen(a, b) {
  if (a.length !== b.length) throw new Error("kappaCohen: longitudes distintas");
  const n = a.length;
  if (n === 0) return { kappa: NaN, po: NaN, pe: NaN, n };
  const cats = [...new Set([...a, ...b])];
  let acuerdo = 0;
  const ca = new Map();
  const cb = new Map();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) acuerdo++;
    ca.set(a[i], (ca.get(a[i]) ?? 0) + 1);
    cb.set(b[i], (cb.get(b[i]) ?? 0) + 1);
  }
  const po = acuerdo / n;
  let pe = 0;
  for (const k of cats) pe += ((ca.get(k) ?? 0) / n) * ((cb.get(k) ?? 0) / n);
  const kappa = pe === 1 ? (po === 1 ? 1 : NaN) : (po - pe) / (1 - pe);
  return { kappa, po, pe, n };
}

/** PRNG determinista (mulberry32). */
export function prng(semilla) {
  let s = semilla >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates con un PRNG dado. No modifica la entrada. */
export function barajar(lista, rnd) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * IC por bootstrap de percentiles, remuestreando unidades (p. ej. casos).
 * `estadistico(muestra)` recibe la lista remuestreada y devuelve un número.
 */
export function bootstrap(unidades, estadistico, { B = 2000, semilla = 1, alfa = 0.05 } = {}) {
  const rnd = prng(semilla);
  const vals = [];
  const n = unidades.length;
  for (let r = 0; r < B; r++) {
    const m = new Array(n);
    for (let i = 0; i < n; i++) m[i] = unidades[Math.floor(rnd() * n)];
    const v = estadistico(m);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((x, y) => x - y);
  if (vals.length === 0) return { lo: NaN, hi: NaN, validos: 0 };
  const q = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))];
  return { lo: q(alfa / 2), hi: q(1 - alfa / 2), validos: vals.length };
}

export const pct = (x, d = 1) => (Number.isFinite(x) ? (100 * x).toFixed(d) : "—");
export const fmtP = (p) => (p < 0.0001 ? p.toExponential(1) : p.toFixed(4));
