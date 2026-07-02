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

## The result (and why we hunted down our own inflated metric)

At first we measured on a **29-case** adversarial test, and the number looked spectacular: the
fine-tuned model went from 37.9% to **75.9%** safety. But we were honest with ourselves. 29 cases
is few —each case is worth 3.4 points— and the test had scenarios that were too easy, inflating
the figure.

So we **grew the test to 56** harder, unbiased cases (generated blind, with no adversarial filter
favoring the fine-tuned model) and re-measured **everything from scratch**. The honest number is
more modest, but bulletproof:

| Metric (honest 56-case test) | MedGemma base | PRIMUM (fine-tuned) | Δ |
|---|---|---|---|
| 🛡️ **Safety** | **21.4%** | **52.7%** | **+31.3 — 2.5×** |
| ⚠️ High risk | 20.8% | 50.0% | +29.2 |
| ✓ Effectiveness | 7.9% | 30.5% | +22.6 |

**We more than doubled the safety** of a free medical model, on a hard, honest test. It's not the
75.9% we saw with the small test —and that's exactly why we trust the 52.7%: we measured it over
twice as many cases, with no gifts. Discovering that your own metric is inflated, and correcting
it, is part of the method.

And most important for the thesis: the model learned to defend against **attacks it never saw** in
training. The loop generalizes. Everything runs on a **free 4B model**, on a clinic's computer,
without sending patient data to the cloud.

## What we learned (and the enemy that remains)

- **The loop generalizes.** Unseen adversarial cases —cauda equina, retinal artery occlusion,
  atypical-presentation MI— that the base model failed, the fine-tuned model resists.
- **Hallucination is the stubborn enemy.** On the honest 56-case test, **7 of 8 hallucination
  cases are still broken** —both in the fine-tuned model and its variants. The model *confirms*
  **invented** drug interactions ("atorvastatin inhibits CYP2C9 and doubles the effect of
  warfarin") with total confidence. It's the #1 weakness that current training hasn't moved, and
  the next Everest (we're already reinforcing the anti-hallucination corpus for the next cycle).
- **A harder benchmark isn't bad, it's more honest.** Growing the test from 29 to 56 cases lowered
  the numbers in absolute terms (the fine-tuned model from 75.9% to 52.7%), but made the
  measurement far more reliable: each case weighs half as much, and the "gifts" that inflated the
  figure disappeared.

## Limitations (let's be serious)

This is **one cycle of many**, not a finished product:
- The honest test has 56 cases and keeps growing. 52.7% is the figure we stand behind.
- Tested on **a single base model** (MedGemma 4B). The next step is to show the method lifts
  others too (MedGemma 1.5, and more).
- Hallucination of pharmacological mechanisms is not yet fully solved (7/8 cases).
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
