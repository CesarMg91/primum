# Primum 🩺

> *Primum non nocere* — "primero, no hacer daño."
>
> El primer benchmark abierto, **safety-first** y **agéntico** que mide si un modelo de lenguaje
> —incluido uno **local y gratis** como MedGemma/Gemma— es seguro para usarse en una
> **clínica real de habla hispana**.

[![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#estado)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![español](https://img.shields.io/badge/idioma-es--MX-green)](#)

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

## Resultados preliminares

Evaluación con **Claude Opus 4.8 como juez** sobre casos de seguridad en español mexicano:

| Modelo | Tipo | Safety |
|---|---|---|
| Claude Opus 4.8 / Sonnet 4.6 | frontera | 100% |
| Gemma 4 (e4b) | local | 94.7% |
| Claude Haiku 4.5 | frontera | 92% |
| **MedGemma 4B** | **local (médico)** | **56%** |

Dos hallazgos:
- Los modelos de **frontera** son muy seguros; los **locales pequeños**, no necesariamente.
- **Contraintuitivo:** el modelo *afinado para medicina* (MedGemma) resultó **mucho menos seguro**
  que el *general* más nuevo (Gemma 4) — optimizó conocimiento clínico, no alineación de seguridad.

> Cifras preliminares (los modelos se corrieron sobre distintos subconjuntos durante el desarrollo).
> El leaderboard refleja los resultados vigentes.

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
npm run bench -- ollama:medgemma ollama:gemma
```

Los resultados quedan en `results/<modelo>-<fecha>.json` y alimentan el leaderboard.

## Desplegar el leaderboard (Vercel)

El leaderboard es una app Next.js en `leaderboard/`. Para publicarlo:

1. Sube este repo a GitHub.
2. En [Vercel](https://vercel.com): **Add New → Project** → importa el repo →
   **Root Directory: `leaderboard`** → **Deploy**.

Los datos vienen de `leaderboard/data/leaderboard.json`, que se regenera con
`npm run aggregate` (en `harness/`) y se versiona en git.

## Estado

**Alpha.** Los casos semilla en `cases/` son **ejemplos de canon de seguridad** marcados
`review_status: needs_clinical_review` — sirven para demostrar el formato y que el harness
corra end-to-end. **Los casos definitivos los valida y aporta personal clínico.**

## Cómo contribuir un caso

Copia `cases/_template.yaml`, llénalo y haz un PR. Cada caso necesita una **referencia clínica**
(guía, NOM, GPC) y pasa por revisión clínica antes de entrar al set oficial. Ver
[`cases/SCHEMA.md`](cases/SCHEMA.md).

## Licencia

MIT para el código. Los casos clínicos se publican bajo CC-BY-4.0 (atribución).
