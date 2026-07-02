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
    statSafety: "safety of the local model",
    statUpdated: "updated",
    problemH2: "The problem: free isn't safe",
    problemBody:
      "Frontier models are safe, but expensive and in the cloud. <strong>Free, local models</strong> —the ones a doctor could run in their own office without exposing patient data— fail exactly where it matters most.",
    bestFrontier: "Best frontier model",
    worstLocal: "Most unsafe “free” local model",
    loopH2: "The self-improvement loop",
    loopBody: (cycles: number, testCases: number) =>
      `An AI adversary attacks the model with the hardest cases, and it learns from every failure. Over ${cycles} cycles on an adversarial test of ${testCases} cases, MedGemma —free and local— <strong>doubled its safety</strong>.`,
    baseLabel: "MedGemma 4B (base)",
    primumLabel: "PRIMUM (fine-tuned)",
    casesH2: (n: number) => `The ${n} attacks, case by case`,
    casesBody:
      'Each case is a real clinical scenario. The left dot is the base model; the right one, PRIMUM. <span style="color:var(--green)">Green</span> = resisted the attack, <span style="color:var(--rose)">red</span> = broke it. Cells with a teal frame are the ones the loop <strong>fixed</strong>.',
    generalH2: "General model benchmark",
    generalBody: (total: number, date: string) =>
      `The full picture: frontier vs local models on the original corpus of ${total} cases (${date}). Shows where each model starts before any fine-tuning.`,
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
    footer: (n: number) =>
      `${n} cases · Mexican Spanish (es-MX) · open methodology in the <a href="https://github.com/CesarMg91/primum">repository</a>. Dimmed rows under “Cases” ran on a smaller set (not comparable). This is not medical advice.`,
    // Coliseo
    colKicker: "PRIMUM · THE COLOSSEUM",
    colTitle: "The guardian vs its adversary",
    colSub: (attacks: number, cycles: number) => `${attacks} real clinical attacks · ${cycles} cycles`,
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
    statSafety: "seguridad del modelo local",
    statUpdated: "actualizado",
    problemH2: "El problema: lo gratis no es seguro",
    problemBody:
      "Los modelos de frontera son seguros, pero caros y en la nube. Los modelos <strong>gratuitos y locales</strong> —los que un médico podría correr en su consultorio sin exponer datos del paciente— fallan justo donde más importa.",
    bestFrontier: "Mejor modelo de frontera",
    worstLocal: "Modelo local “gratis” más inseguro",
    loopH2: "El loop de auto-mejora",
    loopBody: (cycles: number, testCases: number) =>
      `Un adversario de IA ataca al modelo con los casos más difíciles, y este aprende de cada falla. En ${cycles} ciclos sobre un test adversarial de ${testCases} casos, MedGemma —gratis y local— <strong>dobló su seguridad</strong>.`,
    baseLabel: "MedGemma 4B (base)",
    primumLabel: "PRIMUM (afinado)",
    casesH2: (n: number) => `Los ${n} ataques, caso por caso`,
    casesBody:
      'Cada caso es un escenario clínico real. El punto izquierdo es el modelo base; el derecho, PRIMUM. <span style="color:var(--green)">Verde</span> = resistió el ataque, <span style="color:var(--rose)">rojo</span> = lo rompió. Las celdas con marco teal son las que el loop <strong>arregló</strong>.',
    generalH2: "Benchmark general de modelos",
    generalBody: (total: number, date: string) =>
      `La foto completa: frontera vs locales sobre el corpus original de ${total} casos (${date}). Muestra de dónde parte cada modelo antes de cualquier afinamiento.`,
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
    footer: (n: number) =>
      `${n} casos · español mexicano (es-MX) · metodología abierta en el <a href="https://github.com/CesarMg91/primum">repositorio</a>. Las filas atenuadas en “Casos” se corrieron sobre un set menor (no comparables). Esto no constituye consejo médico.`,
    // Coliseo
    colKicker: "PRIMUM · EL COLISEO",
    colTitle: "El guardián vs su adversario",
    colSub: (attacks: number, cycles: number) => `${attacks} ataques clínicos reales · ${cycles} ciclos`,
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
