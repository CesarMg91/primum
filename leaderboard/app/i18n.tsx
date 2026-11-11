"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "es";

// All UI copy for both languages. Rich strings (with <strong>/<span>) are HTML
// and rendered via dangerouslySetInnerHTML — content is static, so it's safe.
// The clinical CASES stay in Spanish on purpose: Primum is a Spanish-language
// clinical-safety benchmark; only the presentation layer is translated.
export const dict = {
  en: {
    langName: "EN",
    otherLang: "ES",
    eyebrow: "Primum · primum non nocere",
    h1: "Clinical safety benchmark",
    tagline: "Is this AI model safe in a real Spanish-speaking clinic?",
    lede:
      "We measure <strong>safety before effectiveness</strong> in clinical scenarios in Mexican Spanish —including <strong>free, local models</strong> like MedGemma. And we go beyond measuring: an AI adversary trains the local model to close the gap. A single dangerous answer is enough to fail a case.",
    statCases: "clinical cases",
    statCycles: "self-improvement cycles",
    statSafety: "safety of the local model (test set)",
    statUpdated: "updated",
    problemH2: "The problem: free isn't safe",
    problemBody:
      "Frontier models are safe, but expensive and in the cloud. <strong>Free, local models</strong> —the ones a doctor could run in their own office without exposing patient data— fail exactly where it matters most.",
    bestFrontier: "Best frontier model",
    worstLocal: "Most unsafe “free” local model",
    loopH2: "The self-improvement loop",
    devNote: (min: number, max: number) =>
      `Development corpus (early cases, mostly used for training; n = ${min}–${max} per model). Not the test set: see the table below.`,
    loopBody: (cycles: number, testCases: number) =>
      `An AI adversary attacks the model with the hardest cases, and it learns from every failure. After ${cycles} cycles, on a frozen adversarial test of ${testCases} cases never used for training, MedGemma 4B —free and local— <strong>more than doubled its safety</strong>.`,
    baseLabel: "MedGemma 4B (base)",
    primumLabel: "PRIMUM c3 (fine-tuned)",
    safeOf: (k: number, n: number) => `${k}/${n} safe`,
    ci95: "95% CI",
    mcnemarLine: (p: number, fixed: number, broke: number, lo: string, hi: string) =>
      `Paired by case, the fine-tuned model fixes ${fixed} cases and breaks ${broke} (exact McNemar <strong>p = ${p}</strong>; 95% CI of the gain: ${lo} to ${hi} points). Judge: Claude Opus 4.8.`,
    secondJudgeLine: (b: string, c: string, p: number, k: string, lo: string, hi: string) =>
      `Validation: a judge from another family (Gemini 3.1 Pro) scoring the same answers gives <strong>${b} → ${c}</strong> (p = ${p}); agreement between judges <strong>κ = ${k}</strong> (95% CI ${lo}–${hi}).`,
    testNote: (test: number, train: number) =>
      `Test set: ${test} cases frozen apart from the ${train} training cases. Both judges are LLMs; a blind human rating is in progress. Aggregate figures only.`,
    generalH2: "Development corpus (not the test set)",
    generalBody: (min: number, max: number, date: string) =>
      `Early runs (${date}) on the first cases of the corpus, most of them later used for training, with a different subset per model (n = ${min}–${max}). Kept as history: not comparable with the test-set figures above.`,
    thModel: "Model",
    thSafety: "🛡️ Safety",
    thHighRisk: "⚠️ High risk",
    thEffect: "✓ Effectiveness",
    thCases: "Cases",
    badgeLocal: "LOCAL",
    badgeFrontier: "FRONTIER",
    judge: "judge",
    selfJudge: " · ⚠ self-judge",
    judgePanel: "judge panel",
    howSafetyH: "🛡️ Safety Score",
    howSafetyP: "% of cases with no critical violation. A single dangerous answer fails the case.",
    howHighH: "⚠️ High risk",
    howHighP: "Safety computed only over cases labeled as high clinical risk.",
    howEffectH: "✓ Effectiveness",
    howEffectP: "How complete and correct the answer is beyond avoiding harm.",
    howJudgeH: "⚖️ Impartial judge",
    howJudgeP: "A strict LLM-as-judge scores each answer citing textual evidence.",
    footer: (corpus: number, test: number) =>
      `${corpus} cases (${test} in the frozen test set) · Mexican Spanish (es-MX) · open methodology in the <a href="https://github.com/CesarMg91/primum">repository</a>. Dimmed rows under “Cases” ran on a smaller set (not comparable). This is not medical advice.`,
    // Coliseo
    colKicker: "PRIMUM · THE COLOSSEUM",
    colTitle: "The guardian vs its adversary",
    colSub: (attacks: number, cycles: number) => `${attacks} test attacks · ${cycles} cycles · illustration of the totals`,
    colSafety: "Safety",
    colResisted: "resisted",
    colBroke: "broke",
    colResistedTally: (r: number, t: number) => `resisted ${r}/${t}`,
    colPreparing: "Preparing the arena…",
  },
  es: {
    langName: "ES",
    otherLang: "EN",
    eyebrow: "Primum · primum non nocere",
    h1: "Benchmark de seguridad clínica",
    tagline: "¿Es seguro este modelo en una clínica real de habla hispana?",
    lede:
      "Medimos <strong>seguridad antes que efectividad</strong> en escenarios clínicos en español mexicano —incluyendo modelos <strong>locales y gratis</strong> como MedGemma. Y vamos más allá de medir: un adversario de IA entrena al modelo local para cerrar la brecha. Una sola respuesta peligrosa basta para reprobar un caso.",
    statCases: "casos clínicos",
    statCycles: "ciclos de auto-mejora",
    statSafety: "seguridad del modelo local (test)",
    statUpdated: "actualizado",
    problemH2: "El problema: lo gratis no es seguro",
    problemBody:
      "Los modelos de frontera son seguros, pero caros y en la nube. Los modelos <strong>gratuitos y locales</strong> —los que un médico podría correr en su consultorio sin exponer datos del paciente— fallan justo donde más importa.",
    bestFrontier: "Mejor modelo de frontera",
    worstLocal: "Modelo local “gratis” más inseguro",
    loopH2: "El loop de auto-mejora",
    devNote: (min: number, max: number) =>
      `Corpus de desarrollo (primeros casos, casi todos usados para entrenar; n = ${min}–${max} por modelo). No es el test: ver la tabla de abajo.`,
    loopBody: (cycles: number, testCases: number) =>
      `Un adversario de IA ataca al modelo con los casos más difíciles, y este aprende de cada falla. Tras ${cycles} ciclos, en un test adversarial congelado de ${testCases} casos que nunca se usaron para entrenar, MedGemma 4B —gratis y local— <strong>más que duplicó su seguridad</strong>.`,
    baseLabel: "MedGemma 4B (base)",
    primumLabel: "PRIMUM c3 (afinado)",
    safeOf: (k: number, n: number) => `${k}/${n} seguros`,
    ci95: "IC 95 %",
    mcnemarLine: (p: number, fixed: number, broke: number, lo: string, hi: string) =>
      `Pareado por caso, el afinado arregla ${fixed} casos y rompe ${broke} (McNemar exacto <strong>p = ${p}</strong>; IC 95 % de la mejora: ${lo} a ${hi} puntos). Juez: Claude Opus 4.8.`,
    secondJudgeLine: (b: string, c: string, p: number, k: string, lo: string, hi: string) =>
      `Validación: un juez de otra familia (Gemini 3.1 Pro) sobre las mismas respuestas da <strong>${b} → ${c}</strong> (p = ${p}); acuerdo entre jueces <strong>κ = ${k}</strong> (IC 95 % ${lo}–${hi}).`,
    testNote: (test: number, train: number) =>
      `Test: ${test} casos congelados aparte de los ${train} de entrenamiento. Los dos jueces son LLM; está en curso una calificación humana a ciegas. Sólo cifras agregadas.`,
    generalH2: "Corpus de desarrollo (no es el test)",
    generalBody: (min: number, max: number, date: string) =>
      `Corridas tempranas (${date}) sobre los primeros casos del corpus, casi todos usados después para entrenar, con un subconjunto distinto por modelo (n = ${min}–${max}). Se quedan como historia: no son comparables con las cifras del test de arriba.`,
    thModel: "Modelo",
    thSafety: "🛡️ Safety",
    thHighRisk: "⚠️ Alto riesgo",
    thEffect: "✓ Efectividad",
    thCases: "Casos",
    badgeLocal: "LOCAL",
    badgeFrontier: "FRONTERA",
    judge: "juez",
    selfJudge: " · ⚠ auto-juez",
    judgePanel: "panel de jueces",
    howSafetyH: "🛡️ Safety Score",
    howSafetyP: "% de casos sin ninguna violación crítica. Una sola respuesta peligrosa reprueba el caso.",
    howHighH: "⚠️ Alto riesgo",
    howHighP: "Safety calculado solo sobre los casos etiquetados como de alto riesgo clínico.",
    howEffectH: "✓ Efectividad",
    howEffectP: "Qué tan completa y correcta es la respuesta más allá de evitar el daño.",
    howJudgeH: "⚖️ Juez imparcial",
    howJudgeP: "Un LLM-as-judge estricto evalúa cada respuesta citando evidencia textual.",
    footer: (corpus: number, test: number) =>
      `${corpus} casos (${test} en el test congelado) · español mexicano (es-MX) · metodología abierta en el <a href="https://github.com/CesarMg91/primum">repositorio</a>. Las filas atenuadas en “Casos” se corrieron sobre un set menor (no comparables). Esto no constituye consejo médico.`,
    // Coliseo
    colKicker: "PRIMUM · EL COLISEO",
    colTitle: "El guardián vs su adversario",
    colSub: (attacks: number, cycles: number) => `${attacks} ataques del test · ${cycles} ciclos · ilustración del total`,
    colSafety: "Seguridad",
    colResisted: "resistió",
    colBroke: "rompió",
    colResistedTally: (r: number, t: number) => `resistidos ${r}/${t}`,
    colPreparing: "Preparando la arena…",
  },
} as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("primum-lang")) as Lang | null;
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);
  const set = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem("primum-lang", l); } catch {}
    try { document.documentElement.lang = l; } catch {}
  };
  return <LangContext.Provider value={{ lang, setLang: set }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: dict[lang] };
}

export function LangToggle() {
  const { lang, setLang } = useContext(LangContext);
  return (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === "en" ? "es" : "en")}
      aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
    >
      <span className={lang === "en" ? "on" : ""}>EN</span>
      <span className="sep">/</span>
      <span className={lang === "es" ? "on" : ""}>ES</span>
    </button>
  );
}
