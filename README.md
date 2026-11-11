# Primum 🩺

> 🌐 **Language:** English · **[Español](README.es.md)**

> *Primum non nocere* — "first, do no harm."
>
> The first open, **safety-first**, **agentic** benchmark that measures whether a language
> model —including a **free, local** one like MedGemma/Gemma— is safe to use in a
> **real Spanish-speaking clinic**.

[![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#status)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey)](LICENSE-DATA)
[![language: es-MX](https://img.shields.io/badge/dataset-es--MX-green)](#)

**🌐 [Live leaderboard](https://primumbench.org)** · **📦 [Repository](https://github.com/CesarMg91/primum)**

---

## Why it exists

Today's medical benchmarks have three documented gaps:

1. **They don't really measure safety.** HealthBench (OpenAI) is the standard, but
   [the critique](https://glassboxmedicine.com/2025/05/13/healthbench-does-not-evaluate-patient-safety/)
   is that patient safety **is not an axis of its rubric** and it doesn't confront hallucinations.
2. **Clinical Latin-American Spanish is "underexplored."** Stated verbatim by
   [PeruMedQA (2026)](https://arxiv.org/abs/2509.11517): *all LLMs perform worse in Latin
   American Spanish than in Iberian Spanish*. Existing benchmarks are static QA or Anglocentric.
3. **Local models already compete** (MedGemma-27b led PeruMedQA), yet no one rigorously measures
   whether it is **safe** to use a free model running in the doctor's office.

And there's a lesson no static QA captures: when the same cases are evaluated
**agentically and sequentially** (like real clinical decision-making), accuracy collapses —
[AgentClinic, npj Digital Medicine 2026](https://www.nature.com/articles/s41746-026-02674-7)
reports drops of up to 10×.

**Primum lives in that empty intersection:** safety first + Mexican/Latin Spanish + agentic
evaluation + local models included.

## What it measures

Each case probes one concrete **dangerous failure mode** (contraindication, interaction,
toxic dose, missed referral to the ER, drug hallucination) in a realistic clinical scenario in
**Mexican Spanish** (formulary drugs, units, IMSS pathways).

We report two separate axes, following clinical consensus (CSEDB):

- **Safety Score** — % of cases with *no* critical violation (`must_not`). A single one fails the case.
- **Effectiveness Score** — % of `must_do` / `should` criteria satisfied.

A model can be *effective* and still *unsafe*. Primum separates them on purpose.

## How it works

```
cases/*.yaml  ──►  harness (agentic)  ──►  model under test  ──►  judge (rubric)  ──►  results/*.json  ──►  leaderboard
```

- **Models under test:** frontier (GPT, Claude, Gemini) and local via Ollama (MedGemma, Gemma).
- **Judge:** LLM-as-judge against each case's rubric. Configurable — you can use a frontier
  model *or* a local Gemma as the judge (the "zero-cost" angle).
- **Agentic:** supports multi-turn exchanges with a simulated patient, not just Q&A.

## The self-improvement loop

Primum doesn't just measure — it **closes the gap**. An AI adversary generates the cases that
break the local model, a frontier model produces "gold" responses verified by a judge panel,
and the local model is **fine-tuned with QLoRA** on that corpus. The cycle repeats.

## Results (frozen test set, 56 cases)

The test set is **56 adversarial cases frozen apart from the 98 training cases** (`cases/split.json`);
none of them was used to fine-tune. Judge: **Claude Opus 4.8**. One answer per case.

| Model | Safe | Safety | 95% CI (Wilson) | High risk | Effectiveness |
|---|---|---|---|---|---|
| MedGemma 4B (base) | 12/56 | **21.4%** | 12.7–33.8% | 11/53 = 20.8% | 7.9% |
| PRIMUM c3 (fine-tuned, cycle 3) | 30/56 | **53.6%** | 40.7–66.0% | 27/53 = 50.9% | 29.3% |

- **Gain: +32.1 points (2.5×), 95% CI 16.1 to 46.4** (bootstrap by case).
- **Paired by case:** c3 fixes 21 cases and breaks 3 — **exact McNemar p = 0.0003**.
- **Validation:** a judge from another family (Gemini 3.1 Pro, preview) scoring the same answers
  gives **17.9% → 50.0%** (McNemar p = 0.0005); **κ between judges = 0.77** (95% CI 0.64–0.88).
  Details: [`docs/juez-segunda-familia.md`](docs/juez-segunda-familia.md).

Caveats: both judges are LLMs (a blind human rating is in progress); with 56 cases each case is
worth 1.8 points and the intervals are wide; later cycles (c4) did not beat c3. Seventeen of the
test cases had been training cases before the split was frozen; the git history suggests c3 was
trained with the anti-leak filter (an inference: the training log is gone), and without those 17
cases the result holds (n = 39:
17.9% → 46.2%, p = 0.0074). Where every number comes from:
[`docs/cifras-reconciliadas.md`](docs/cifras-reconciliadas.md).

## Development corpus (history, not comparable)

Before the test set was frozen, models were run on the first cases of the corpus (0001–0050),
**most of which later became training cases**, each on a different subset. These numbers are
kept as history only; they are not comparable with the test set above.

| Model | Type | Safety | n (cases) |
|---|---|---|---|
| Claude Opus 4.8 / Sonnet 4.6 | frontier | 100% | 50 |
| Gemma 4 (e4b) | local | 94.7% | 19 |
| Claude Haiku 4.5 | frontier | 92.3% | 13 |
| MedGemma 4B | local (medical) | 56.3% | 16 |

On that corpus the frontier models were near 100% and the *medical* fine-tune MedGemma looked
less safe than the newer *general* Gemma 4 — an observation from small, uneven subsets, not a
test-set result. An earlier 29-case test (37.9% → 75.9%) is also superseded: its fine-tuned figure
merged two partial runs. The site's "development corpus" table (`leaderboard/data/leaderboard.json`,
n = 43–50 per model) is the same kind of data.

## Quickstart

```powershell
cd harness
npm install
copy .env.example .env
```

Edit `.env` with your keys. To run a local model, first start Ollama:

```powershell
ollama pull medgemma
ollama serve
```

Run the benchmark:

```powershell
npm run bench -- gemini:gemini-3.5-flash gemini:gemini-3.5-flash
npm run bench -- openai:gpt-5.5 anthropic:claude-opus-4-8
npm run bench -- ollama:medgemma anthropic:claude-opus-4-8
```

Results land in `results/<model>-<date>.json` and feed the leaderboard.

## Deploy the leaderboard (Vercel)

The leaderboard is a Next.js app in `leaderboard/`. To publish it:

1. Push this repo to GitHub.
2. On [Vercel](https://vercel.com): **Add New → Project** → import the repo →
   **Root Directory: `leaderboard`** → **Deploy**.

The headline test-set figures come from `leaderboard/data/improvement.json`, generated with
`node scripts/cifras_sitio.mjs --escribir` (aggregates only: no per-case verdicts are published).
The development-corpus table comes from `leaderboard/data/leaderboard.json`, regenerated with
`npm run aggregate` (in `harness/`). Both are versioned in git.

## Status

**Alpha.** Cases go through **clinical review** before entering the official set
(`review_status: reviewed`). The corpus grows each cycle of the adversarial loop.

## How to contribute a case

Copy `cases/_template.yaml`, fill it in, and open a PR. Each case needs a **clinical reference**
(guideline, NOM, GPC) and passes clinical review before entering the official set. See
[`cases/SCHEMA.md`](cases/SCHEMA.md).

## License

MIT for the code ([`LICENSE`](LICENSE)). The **data** —clinical cases and rubrics (`cases/`),
gold responses (`dataset/`) and human rating sheets (`anclaje-humano/`)— is released under
**CC BY 4.0** (attribution): see [`LICENSE-DATA`](LICENSE-DATA). All cases are synthetic;
none of this is medical advice.
