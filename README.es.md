# Primum 🩺

> 🌐 **Idioma:** Español · **[English](README.md)**

> *Primum non nocere* — "primero, no hacer daño."
>
> El primer benchmark abierto, **safety-first** y **agéntico** que mide si un modelo de lenguaje
> —incluido uno **local y gratis** como MedGemma/Gemma— es seguro para usarse en una
> **clínica real de habla hispana**.

[![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#estado)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![español](https://img.shields.io/badge/idioma-es--MX-green)](#)

**🌐 [Leaderboard en vivo](https://primumbench.org)** · **📦 [Repositorio](https://github.com/CesarMg91/primum)**

---

## Por qué existe

Los benchmarks médicos actuales tienen tres huecos documentados:

1. **No miden seguridad de verdad.** HealthBench (OpenAI) es el estándar, pero
   [la crítica](https://glassboxmedicine.com/2025/05/13/healthbench-does-not-evaluate-patient-safety/)
   es que la seguridad del paciente **no es un eje de su rúbrica** y no confronta alucinaciones.
2. **El español latinoamericano clínico está "underexplored".** Lo dice textual
   [PeruMedQA (2026)](https://arxiv.org/abs/2509.11517): *todos los LLMs rinden peor en español
   latino que en ibérico*. Los benchmarks existentes son QA estático o anglocéntricos.
3. **Los modelos locales ya compiten** (MedGemma-27b lideró PeruMedQA), pero nadie mide
   con rigor si es **seguro** usar un modelo gratis que corre en el consultorio.

Y hay una lección que ningún QA estático captura: cuando los mismos casos se evalúan de forma
**agéntica y secuencial** (como decisión clínica real), la precisión se desploma
—[AgentClinic, npj Digital Medicine 2026](https://www.nature.com/articles/s41746-026-02674-7)
reporta caídas de hasta 10×.

**Primum vive en esa intersección vacía:** seguridad primero + español mexicano/latino +
evaluación agéntica + incluye modelos locales.

## Qué mide

Cada caso prueba un **modo de falla peligroso** concreto (contraindicación, interacción,
dosis tóxica, falta de derivación a urgencias, alucinación de un fármaco) en un escenario
clínico realista en **español mexicano** (fármacos del cuadro básico, unidades, vías IMSS).

Reportamos dos ejes separados, siguiendo el consenso clínico (CSEDB):

- **Safety Score** — % de casos sin *ninguna* violación crítica (`must_not`). Una sola basta para reprobar.
- **Effectiveness Score** — % de criterios `must_do` / `should` satisfechos.

Un modelo puede ser *efectivo* y aun así *inseguro*. Primum los separa a propósito.

## Cómo funciona

```
cases/*.yaml  ──►  harness (agéntico)  ──►  modelo bajo prueba  ──►  juez (rúbrica)  ──►  results/*.json  ──►  leaderboard
```

- **Modelos bajo prueba:** frontier (GPT, Claude, Gemini) y locales vía Ollama (MedGemma, Gemma).
- **Juez:** LLM-as-judge contra la rúbrica de cada caso. Configurable — puedes usar un
  modelo frontier *o* un Gemma local como juez (el ángulo "cero costo").
- **Agéntico:** soporta turnos múltiples con paciente simulado, no solo pregunta-respuesta.

## El loop de auto-mejora

Primum no solo mide — **cierra la brecha**. Un adversario de IA genera los casos que rompen al
modelo local, un modelo frontier produce respuestas "de oro" verificadas por un panel de jueces,
y el modelo local se **afina con QLoRA** sobre ese corpus. El ciclo se repite.

Resultado (test adversarial honesto de 56 casos, juez Claude Opus 4.8): MedGemma 4B pasó de
**21.4%** de seguridad (base) a **~53%** (afinado) — más del doble, y sigue mejorando por ciclo.

## Quickstart

```powershell
cd harness
npm install
copy .env.example .env
```

Edita `.env` con tus llaves. Para correr un modelo local primero levanta Ollama:

```powershell
ollama pull medgemma
ollama serve
```

Corre el benchmark:

```powershell
npm run bench -- gemini:gemini-3.5-flash gemini:gemini-3.5-flash
npm run bench -- openai:gpt-5.5 anthropic:claude-opus-4-8
npm run bench -- ollama:medgemma anthropic:claude-opus-4-8
```

Los resultados quedan en `results/<modelo>-<fecha>.json` y alimentan el leaderboard.

## Estado

**Alpha.** Los casos pasan por **revisión clínica** antes de entrar al set oficial
(`review_status: reviewed`). El corpus crece por ciclo del loop adversarial.

## Cómo contribuir un caso

Copia `cases/_template.yaml`, llénalo y haz un PR. Cada caso necesita una **referencia clínica**
(guía, NOM, GPC) y pasa por revisión clínica. Ver [`cases/SCHEMA.md`](cases/SCHEMA.md).

## Licencia

MIT para el código. Los casos clínicos se publican bajo CC-BY-4.0 (atribución).
