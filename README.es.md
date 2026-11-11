# Primum 🩺

> 🌐 **Idioma:** Español · **[English](README.md)**

> *Primum non nocere* — "primero, no hacer daño."
>
> El primer benchmark abierto, **safety-first** y **agéntico** que mide si un modelo de lenguaje
> —incluido uno **local y gratis** como MedGemma/Gemma— es seguro para usarse en una
> **clínica real de habla hispana**.

[![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#estado)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![data: CC BY 4.0](https://img.shields.io/badge/datos-CC%20BY%204.0-lightgrey)](LICENSE-DATA)
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

## Resultados (test congelado, 56 casos)

El test son **56 casos adversariales congelados aparte de los 98 de entrenamiento**
(`cases/split.json`); ninguno se usó para afinar. Juez: **Claude Opus 4.8**. Una respuesta por caso.

| Modelo | Seguros | Safety | IC 95 % (Wilson) | Alto riesgo | Efectividad |
|---|---|---|---|---|---|
| MedGemma 4B (base) | 12/56 | **21.4 %** | 12.7–33.8 % | 11/53 = 20.8 % | 7.9 % |
| PRIMUM c3 (afinado, ciclo 3) | 30/56 | **53.6 %** | 40.7–66.0 % | 27/53 = 50.9 % | 29.3 % |

- **Mejora: +32.1 puntos (2.5×), IC 95 % 16.1 a 46.4** (bootstrap por caso).
- **Pareado por caso:** c3 arregla 21 casos y rompe 3 — **McNemar exacto p = 0.0003**.
- **Validación:** un juez de otra familia (Gemini 3.1 Pro, *preview*) sobre las mismas respuestas
  da **17.9 % → 50.0 %** (McNemar p = 0.0005); **κ entre jueces = 0.77** (IC 95 % 0.64–0.88).
  Detalle: [`docs/juez-segunda-familia.md`](docs/juez-segunda-familia.md).

Advertencias: los dos jueces son LLM (está en curso una calificación humana a ciegas); con 56 casos
cada caso vale 1.8 puntos y los intervalos son anchos; los ciclos posteriores (c4) no superaron a c3.
Diecisiete casos de test habían sido de entrenamiento antes de congelar la partición; la historia de
git sugiere que c3 se entrenó con el filtro anti-fuga (es una inferencia: el log del entrenamiento ya
no existe), y sin esos 17 casos el resultado se sostiene (n = 39: 17.9 % → 46.2 %, p = 0.0074). De dónde sale cada cifra:
[`docs/cifras-reconciliadas.md`](docs/cifras-reconciliadas.md).

## Corpus de desarrollo (historia, no comparable)

Antes de congelar el test, los modelos se corrieron sobre los primeros casos del corpus (0001–0050),
**casi todos usados después para entrenar**, cada uno sobre un subconjunto distinto. Esas cifras se
quedan sólo como historia; no son comparables con el test de arriba.

| Modelo | Tipo | Safety | n (casos) |
|---|---|---|---|
| Claude Opus 4.8 / Sonnet 4.6 | frontera | 100 % | 50 |
| Gemma 4 (e4b) | local | 94.7 % | 19 |
| Claude Haiku 4.5 | frontera | 92.3 % | 13 |
| MedGemma 4B | local (médico) | 56.3 % | 16 |

En ese corpus los modelos de frontera rondaron el 100 % y el afinado *médico* MedGemma se vio menos
seguro que el Gemma 4 *general*, más nuevo: es una observación de subconjuntos chicos y desiguales,
no un resultado del test. Un test anterior de 29 casos (37.9 % → 75.9 %) también queda superado: su
cifra del afinado juntaba dos corridas parciales. La tabla «corpus de desarrollo» del sitio
(`leaderboard/data/leaderboard.json`, n = 43–50 por modelo) es el mismo tipo de dato.

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

Las cifras del test en el sitio salen de `leaderboard/data/improvement.json`, generado con
`node scripts/cifras_sitio.mjs --escribir` (sólo agregados: no se publican veredictos por caso).
La tabla del corpus de desarrollo sale de `leaderboard/data/leaderboard.json` (`npm run aggregate`
en `harness/`).

## Estado

**Alpha.** Los casos pasan por **revisión clínica** antes de entrar al set oficial
(`review_status: reviewed`). El corpus crece por ciclo del loop adversarial.

## Cómo contribuir un caso

Copia `cases/_template.yaml`, llénalo y haz un PR. Cada caso necesita una **referencia clínica**
(guía, NOM, GPC) y pasa por revisión clínica. Ver [`cases/SCHEMA.md`](cases/SCHEMA.md).

## Licencia

MIT para el código ([`LICENSE`](LICENSE)). Los **datos** —casos clínicos y rúbricas (`cases/`),
respuestas de oro (`dataset/`) y hojas de calificación humana (`anclaje-humano/`)— se publican
bajo **CC BY 4.0** (atribución): ver [`LICENSE-DATA`](LICENSE-DATA). Todos los casos son sintéticos;
nada de esto es consejo médico.
