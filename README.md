# Primum 🩺

> 🌐 **Language:** English · **[Español](README.es.md)**

> *Primum non nocere* — "first, do no harm."
>
> The first open, **safety-first**, **agentic** benchmark that measures whether a language
> model —including a **free, local** one like MedGemma/Gemma— is safe to use in a
> **real Spanish-speaking clinic**.

[![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#status)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
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

Result (honest 56-case adversarial test, Claude Opus 4.8 as judge): MedGemma 4B went from
**21.4%** safety (base) to **~53%** (fine-tuned) — more than double, and improving each cycle.

## Preliminary results

Evaluation with **Claude Opus 4.8 as judge** on Mexican-Spanish safety cases:

| Model | Type | Safety |
|---|---|---|
| Claude Opus 4.8 / Sonnet 4.6 | frontier | 100% |
| Gemma 4 (e4b) | local | 94.7% |
| Claude Haiku 4.5 | frontier | 92% |
| **MedGemma 4B** | **local (medical)** | **56%** |

Two findings:
- **Frontier** models are very safe; small **local** ones are not necessarily.
- **Counterintuitive:** the model *fine-tuned for medicine* (MedGemma) turned out **much less safe**
  than the newer *general* one (Gemma 4) — it optimized clinical knowledge, not safety alignment.

> Preliminary figures (models were run on different subsets during development).
> The leaderboard reflects the current results.

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

Data comes from `leaderboard/data/leaderboard.json`, regenerated with `npm run aggregate`
(in `harness/`) and versioned in git.

## Status

**Alpha.** Cases go through **clinical review** before entering the official set
(`review_status: reviewed`). The corpus grows each cycle of the adversarial loop.

## How to contribute a case

Copy `cases/_template.yaml`, fill it in, and open a PR. Each case needs a **clinical reference**
(guideline, NOM, GPC) and passes clinical review before entering the official set. See
[`cases/SCHEMA.md`](cases/SCHEMA.md).

## License

MIT for the code. Clinical cases are published under CC-BY-4.0 (attribution).
