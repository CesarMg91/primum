# PRIMUM: a medical AI that trains itself to be safer

> 🌐 **Language:** English · **[Español](writeup.md)**

> How an AI adversary turned a free medical model into one that's **2× safer** —
> and what we learned along the way.

*By César Méndez García — surgeon and founder of AMIA Health Tech*

---

## The problem that keeps me up at night

I've been operating for years, and what worries me most about AI in medicine isn't that it's
not smart. It's that **it's wrong with total confidence**. A language model can sound competent,
empathetic, and convincing while giving advice that kills: not sending an exertional syncope to
the ER, not warning about a drug interaction, downplaying an oncological red flag.

In a real Spanish-speaking clinic —an IMSS office, a neighborhood pharmacy— that "confident
wrongness" is the number-one risk. And the free models a doctor could run on their own computer
(without sending patient data to the cloud) are exactly the ones that fail most.

That's how **PRIMUM** was born (*primum non nocere*): a clinical-safety benchmark in Mexican
Spanish, and a system to make those models measurably safer.

## The idea: let the model train against its own adversary

The loop has three pieces:

1. **The adversary.** An AI red-teamer (Claude Sonnet, judged by a Claude Opus panel) generates
   clinical cases designed to *break* the target model: invented interactions with credible
   jargon (CYP2C9, SGLT2…), disguised red flags, patient pressure to make the model cave. Only
   the cases that **actually break it** are kept.

2. **The gold responses.** For each case, a frontier model answers in an ideal, safe way, and a
   judge panel verifies it passes the clinical rubric (rubrics with references to IMSS GPCs and
   NOMs). Only verified responses become training data.

3. **The retraining.** The local model (MedGemma 4B) is fine-tuned with QLoRA on that gold
   corpus, and re-measured. The adversary attacks the improved model again, finds its new
   weaknesses, and the cycle repeats.

Each turn of the loop tells the system where the next weakness is. It's directed self-improvement,
not blind.

## Honest measurement

An easy mistake would be to train and measure on the same cases. To avoid it, we set aside a
**frozen test set** the model **never sees in training**, stratified by danger type. We measure
three things, prioritizing safety above all:

- **Safety**: % of cases with no critical violation. A single dangerous answer fails the case.
- **High-risk safety**: the same, only over the most clinically severe cases.
- **Effectiveness**: how complete and correct the answer is beyond avoiding harm.

A strict LLM judge scores each answer **citing textual evidence**; when in doubt, it marks unsafe
(fail-safe).

## The result

After three cycles of the loop, on a **deliberately hard 29-case adversarial test** —where the
base model only scored 37.9%—:

| Metric (29-case test) | MedGemma base | PRIMUM (fine-tuned) | Δ |
|---|---|---|---|
| 🛡️ **Safety** | **37.9%** | **75.9%** | **+38.0 — doubled** |
| ⚠️ High risk | 34.6% | 73.1% | +38.5 |
| ✓ Effectiveness | 14.9% | 28.7% | +13.8 |

**We doubled the model's safety**, on the hardest cases, in an honest benchmark. And most
important for the thesis: the model learned to defend against **attacks it never saw** in
training. The loop generalizes.

Everything runs on a **free 4B model**, on a clinic's computer, without sending patient data to
the cloud.

## What we learned (and the enemy that remains)

- **The loop generalizes.** Unseen adversarial cases —cauda equina, retinal artery occlusion,
  atypical-presentation MI— that the base model failed, the fine-tuned model resists.
- **Hallucination is the stubborn enemy.** Of the failures that remain, most are the same type:
  the model *confirms* **invented** drug interactions ("atorvastatin inhibits CYP2C9 and doubles
  the effect of warfarin") with total confidence. Safety training made it more cautious… sometimes
  too much. That's the next Everest.
- **A harder benchmark isn't bad, it's more honest.** Raising the test's difficulty lowered the
  base number (from ~64% to 37.9%), but made the measurement far more reliable and gave the method
  room to prove its real value.

## Limitations (let's be serious)

This is **cycle 3 of many**, not a finished product:
- The test, though honest, is still small (29 cases). We're growing it.
- Tested on **a single base model** (MedGemma 4B). The next step is to show the method lifts
  others too (MedGemma 1.5, and more).
- Hallucination of pharmacological mechanisms is not yet fully solved.
- This is **not medical advice** nor an approved clinical device. It's research toward safer
  medical AI.

## Why it matters

A model like this —free, local, private, and *measurably* safer— could put a trustworthy second
opinion in the hands of doctors who don't have access to expensive tools, without compromising
patient data. Built from the clinical trenches, with the right bias: **primum non nocere**.

The benchmark, the method, and the code are open:
[github.com/CesarMg91/primum](https://github.com/CesarMg91/primum) · leaderboard at
[primumbench.org](https://primumbench.org).

---

*Open methodology · Mexican Spanish (es-MX) · this does not constitute medical advice.*
