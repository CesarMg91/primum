> **Nota para César (en español; se borra antes de enviar):**
> Esto es el esqueleto del preprint para medRxiv (Health Informatics), en inglés. Las cifras del
> juez LLM salen de `docs/cifras-reconciliadas.md` (corridas 56/56) y son reales. Todo lo que
> dice **[CIFRA PENDIENTE DEL ANCLAJE]** se llena con `anclaje-humano/calcular_anclaje.mjs`
> cuando termines de calificar; **la regla del plan decide el titular**: si κ ≥ 0.6 y McNemar
> humano p < 0.05, va la cifra del juez; si κ < 0.6, va la humana. Lo que dice **[CÉSAR: …]** es
> una decisión tuya (afiliación, coautor, conflictos de interés, ética). Lo que dice
> **[VERIFICAR]** hay que comprobarlo antes de enviar (sobre todo la posible fuga de 17 casos de
> test al oro, punto 10 de las cifras reconciliadas). Las referencias son sólo las que ya están
> en el repo; las del estado del arte del plan (§4.2) se agregan después de leer el texto
> completo de cada una. No inventé ningún resultado. Formato pensado para TRIPOD-LLM.

---

# PRIMUM: an open benchmark of conversational clinical safety in Mexican Spanish, with a human-anchored evaluation of a fine-tuned 4B local model

**César Méndez García**, MD, general surgeon¹ [CÉSAR: second rater as co-author?]

¹ Independent researcher, Mexico [CÉSAR: «Investigador independiente» o IMSS — decisión 3 del plan]

Correspondence: [CÉSAR: email]

**Keywords:** large language models; patient safety; benchmark; Spanish; LLM-as-judge; inter-rater agreement; fine-tuning; local models

---

## Abstract

**Background.** Medical benchmarks for large language models (LLMs) mostly measure knowledge
through static question answering, rarely isolate patient-safety failures, and seldom cover
Latin American Spanish. Small open models that could run offline in a clinic are the least
studied.

**Objective.** To build an open, safety-first benchmark of multi-turn clinical conversations in
Mexican Spanish, and to test whether a targeted fine-tuning loop improves the safety of a 4B
open medical model, anchoring the automated judge against blinded human ratings.

**Methods.** PRIMUM contains 154 synthetic cases, each probing one dangerous failure mode
(contraindication, interaction, dose, missed referral, hallucination, overreach, localization)
with a binary rubric; a single violated `must_not` criterion fails the case. A frozen test split
of 56 cases (53 high-risk, 42 multi-turn with a simulated patient) was held out. MedGemma 4B was
fine-tuned with QLoRA on judge-verified "gold" responses to training cases. Responses were scored
by an LLM judge (Claude Opus 4.8) that must quote the model's text. A surgeon and
[CÉSAR: colleague] rated all 112 test responses (56 base, 56 fine-tuned) blind to model and judge
verdict. We report safety with Wilson 95% CIs, paired McNemar tests, and Cohen's κ between judge
and humans.

**Results.** By the LLM judge, safety rose from 12/56 (21.4%; 95% CI 12.7–33.8) for the base
model to 30/56 (53.6%; 40.7–66.0) after fine-tuning (21 cases fixed, 3 broken; exact McNemar
p = 0.0003). Judge–human agreement was κ = [CIFRA PENDIENTE DEL ANCLAJE]. By human ratings,
safety was [CIFRA PENDIENTE DEL ANCLAJE] vs [CIFRA PENDIENTE DEL ANCLAJE]
(McNemar p = [CIFRA PENDIENTE DEL ANCLAJE]). Hallucination of drug mechanisms remained largely
unsolved (1/8 hallucination cases safe after fine-tuning vs 0/8 before, by the judge).

**Conclusions.** [CIFRA PENDIENTE DEL ANCLAJE — one sentence chosen by the decision rule:
either "targeted fine-tuning more than doubled judge-rated safety, and human raters confirmed
the improvement (κ = …)" or "the improvement seen by the LLM judge was [smaller/not confirmed]
under blinded human rating, so the human figure is reported as primary".] Even after
fine-tuning, the 4B model is far from safe enough for unsupervised clinical use.

---

## 1. Introduction

LLMs increasingly answer health questions directly from patients. The failure that matters most
clinically is not lack of knowledge but **confident unsafe advice**: not referring an exertional
syncope, missing a drug interaction, or confirming an invented pharmacological mechanism.

Three gaps motivate PRIMUM:

1. **Safety is rarely the primary axis.** Widely used medical benchmarks score helpfulness or
   accuracy; critiques of HealthBench point out that patient safety is not a separate axis of
   its rubric [1].
2. **Latin American clinical Spanish is underexplored.** PeruMedQA reports that LLMs perform
   worse on Latin American than on Iberian Spanish [2]; existing Spanish resources are
   multiple-choice QA, not conversational safety. [VERIFICAR: add the 2026 Spanish/multilingual
   benchmarks from the plan §4.2 after reading the full texts.]
3. **Sequential, agentic evaluation changes results.** When the same clinical content is
   presented as a sequential interaction, accuracy can drop by up to an order of magnitude [3].

Small open models (≈4B parameters) can run offline on an ordinary laptop, which is attractive
for privacy in low-resource clinics, yet whether they are *safe* is rarely measured.

**Contributions.** (i) An open benchmark of 154 synthetic multi-turn cases in Mexican Spanish
with binary, quote-grounded safety rubrics (CC BY 4.0). (ii) A frozen 56-case test split and a
reproducible harness. (iii) A targeted fine-tuning loop for a 4B open medical model.
(iv) A blinded human anchoring of the LLM judge, with κ and paired tests, which decides which
figure is reported as primary.

## 2. Methods

Reporting follows TRIPOD-LLM where applicable. [VERIFICAR: checklist as supplement.]

### 2.1 Cases

Each case is a YAML file (`cases/`, schema in `cases/schema.json`) with: specialty, risk level,
the failure mode tested (`danger_tested`), clinical references (Mexican clinical practice
guidelines [GPC], NOMs and product labels), the patient context, one or more patient turns,
optionally a **simulated-patient persona** that pressures, minimizes or insists, and a rubric.
Rubric criteria are `must_not` (critical; any violation fails the case), `must_do` and `should`
(weighted for effectiveness) (`rubric/safety-rubric.md`).

The corpus has 154 cases: 143 high-risk, 105 multi-turn, 104 marked `reviewed` by a clinician
and 50 `needs_clinical_review`. Cases were written by the author and, in later cycles, generated
by an adversarial LLM (Claude Sonnet, filtered by a Claude Opus panel) to target failures of the
model under test; only cases that broke the target model were kept for training.
[VERIFICAR: exact provenance count per cycle.] All cases are synthetic; no patient data were used.

### 2.2 Split

Cases were split by a stratified hold-out within each `danger_tested` group (`cases/split.json`).
The **test split has 56 cases** (53 high-risk; 42 multi-turn; 42 `reviewed`, 14 pending clinical
review) and was frozen before the later training cycles; 98 cases form the training split.
Test failure modes: missed referral 17, contraindication 11, interaction 8, hallucination 8,
dose 6, localization 4, overreach 2.

### 2.3 Harness and models

The harness (`harness/`, TypeScript) sends the patient turns to the model under test with a
neutral system prompt («Eres un asistente de salud por chat…»). If the case defines a persona,
an LLM plays the patient for up to 4 turns. Models under test were run locally through Ollama:
**MedGemma 4B** (`google/medgemma-4b-it`, v1; base) and **PRIMUM c3** (the same model after three
fine-tuning cycles), both quantized to GGUF. [VERIFICAR: quantization level of each GGUF and
decoding parameters.]

### 2.4 LLM judge

A judge model (Claude Opus 4.8) receives the patient context, the full conversation and the
criteria, and returns per-criterion verdicts. It must quote the model's words for every verdict;
without a supporting quote a criterion is not met, and for `must_not` any sign of the forbidden
behaviour, or of minimizing the risk, counts as a violation ("when in doubt, fail").
With a panel, ties fail on the safe side. All runs reported here used a **single judge**.

### 2.5 Fine-tuning loop

For each training case, a frontier model generated a reference ("gold") conversation that a panel
of LLM judges verified against the rubric (`dataset/gold.jsonl`, 115 verified conversations).
MedGemma 4B was fine-tuned with QLoRA (4-bit, LoRA rank 16, α 32, learning rate 2e-4, 3 epochs,
max sequence 4,096) on gold conversations restricted to training-split IDs
(`training/train_qlora.py`). Cycle 3 (c3) is the checkpoint evaluated here; c4, c5 and a weight
"soup" are reported in the supplement. [VERIFICAR: number of gold examples used for c3, and the
training log line confirming that test-split IDs were excluded — 17 test cases have gold
responses in `dataset/gold.jsonl`.]

### 2.6 Human anchoring (blinded)

For the 56 test cases × 2 models we presented 112 responses in random order (fixed seed
20261109; the two responses to a case separated by ≥8 positions), with case context, full
conversation and the `must_not` criterion, but **without model identity or judge verdict**
(`anclaje-humano/`). Each rater labeled each criterion as *violated*, *not violated* or
*uncertain*. The author rated all 112; a second physician [CÉSAR: specialty] rated a subset of 20
(10 base, 10 c3, 20 distinct cases). The decryption key was kept separate until rating was
complete.

### 2.7 Outcomes and statistics

- **Safety:** proportion of cases with no `must_not` violation; **high-risk safety** on
  `risk_level: high`; **effectiveness:** weighted proportion of `must_do`/`should` met.
- 95% CIs by the Wilson method. Base vs c3 compared on the same cases with the **exact McNemar
  test** (two-sided binomial on discordant pairs).
- **Cohen's κ** between judge and each human per criterion ("uncertain" excluded; sensitivity
  analyses count it as violated and as not violated), with 95% CIs by case-level bootstrap
  (2,000 resamples). κ between humans on the shared subset.
- For human-based safety, "uncertain" counts as violated (fail-safe).
- **Pre-specified decision rule:** if κ(judge, human) ≥ 0.6 and the human McNemar test gives
  p < 0.05, the judge figure is primary; if κ < 0.6, the human figure is primary and the judge is
  reported as a limitation.
- Scripts: `scripts/reconciliar_cifras.mjs`, `anclaje-humano/calcular_anclaje.mjs`.

## 3. Results

### 3.1 LLM-judge results (test split, 56/56)

| Model | Safe cases | Safety (95% CI) | High-risk safety | Effectiveness |
|---|---|---|---|---|
| MedGemma 4B (base) | 12/56 | 21.4% (12.7–33.8) | 11/53 (20.8%) | 7.9% |
| PRIMUM c3 | 30/56 | 53.6% (40.7–66.0) | 27/53 (50.9%) | 29.3% |

c3 fixed 21 cases and broke 3 (0069, 0123, 0124); exact McNemar p = 0.0003.

By failure mode (base → c3, safe/total): missed referral 5→12/17, interaction 1→5/8,
dose 0→4/6, contraindication 6→7/11, localization 0→1/4, hallucination 0→1/8, overreach 0→0/2.

### 3.2 Human anchoring

| | n | Agreement | κ (95% CI) |
|---|---|---|---|
| Judge vs rater 1 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |
| Judge vs rater 2 | 20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |
| Rater 1 vs rater 2 | 20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |

### 3.3 Safety by human rating

| Model | Safe cases | Safety (95% CI) |
|---|---|---|
| MedGemma 4B (base) | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |
| PRIMUM c3 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |

Fixed / broken: [CIFRA PENDIENTE DEL ANCLAJE]; exact McNemar p = [CIFRA PENDIENTE DEL ANCLAJE].
Outcome of the decision rule: [CIFRA PENDIENTE DEL ANCLAJE].

### 3.4 Sensitivity analyses

- Excluding the 17 test cases that have gold responses in the released gold file (n = 39),
  judge-rated safety was 7/39 (17.9%) for base and 18/39 (46.2%) for c3 (13 fixed, 2 broken;
  exact McNemar p = 0.0074). [VERIFICAR whether these cases entered training; see 2.5.]
- Other fine-tuning cycles (judge, 56/56): c4 29/56 (51.8%); c3 vs c4 McNemar p = 1.0.
- Human rating with "uncertain" counted as not violated: [CIFRA PENDIENTE DEL ANCLAJE].
- Disagreements between judge and humans, by failure mode: [CIFRA PENDIENTE DEL ANCLAJE].

## 4. Discussion

[Write after the anchoring. Points to cover, depending on the decision rule:]

- Targeted fine-tuning on a small, verified corpus moved a 4B model from about one in five to
  about one in two safe conversations by the judge; the confidence intervals are wide (56 cases;
  each case is 1.8 points).
- The largest gains were in missed referrals, interactions and dosing; **hallucinated drug
  mechanisms** (e.g., confirming an invented CYP interaction) remained almost entirely unsolved.
- Whether a single LLM judge from one model family can be trusted for safety labels:
  [CIFRA PENDIENTE DEL ANCLAJE: κ and the pattern of disagreements].
- A 54% safety rate is not acceptable for unsupervised clinical use; the contribution is the
  benchmark and the measurement method, not a deployable model.

## 5. Limitations

- **Single judge, single family.** Every automated verdict comes from one Claude model; the
  adversarial case generator, the simulated patient, the gold-verifying panel and the judge are
  all Claude models. This may favour a model trained on Claude-generated gold responses. A
  second-family judge is planned but not reported here.
- **Clinical review is incomplete.** 50 of 154 cases (14 of the 56 test cases) are still marked
  `needs_clinical_review`.
- **Small test set.** 56 cases give wide confidence intervals; failure-mode subgroups have 2–17
  cases and are descriptive only.
- **Human anchoring is limited:** [one or two raters]; the second rater saw 20 of 112 responses.
  [CIFRA PENDIENTE DEL ANCLAJE: final rater count and κ between humans.] Raters may recognise a
  model by style despite blinding.
- **Possible training contamination.** [VERIFICAR: 17 test cases have gold responses in the
  public gold file; the training script excludes test IDs only when the split file is present.]
- **One base model.** Only MedGemma 4B v1 was fine-tuned; generalisation to other open models is
  untested.
- **Synthetic conversations** do not capture all the variability of real patients; results do
  not transfer to clinical deployment.
- **Development figures.** Earlier figures on 29- and 50-case subsets (README and leaderboard)
  used different, partly training, cases and are superseded by the 56-case test results.

## 6. Ethics

All cases are synthetic and no patient data were used. [CÉSAR: if the human raters are
co-authors, they are not research subjects; otherwise state consent and the ethics committee
waiver — plan §6.] The work was carried out outside institutional working hours and without
institutional resources. [CÉSAR: confirm.] This is research only; neither the benchmark nor the
fine-tuned model is a medical device or medical advice.

**Use of AI tools.** LLMs generated adversarial cases, gold responses, simulated-patient turns and
judge verdicts as described in Methods, and assisted with code and drafting. The author reviewed
all content and is responsible for it. [CÉSAR: wording per medRxiv policy.]

## 7. Data and code availability

- Code (harness, scripts, leaderboard): https://github.com/CesarMg91/primum (MIT).
  [CÉSAR: Zenodo DOI of v1.0.]
- Data (cases, rubrics, split, gold responses, blinded rating sheets and human ratings):
  same repository under CC BY 4.0 (`LICENSE-DATA`). [CÉSAR: Hugging Face dataset URL and
  Croissant metadata; canary string; private test subset if adopted.]
- Model outputs and judge verdicts for the runs reported: [VERIFICAR: `results/*.json` are
  currently git-ignored; release the 56/56 runs used here.]
- Fine-tuned weights are not released in v1 pending review of the MedGemma (HAI-DEF) license.
- Live leaderboard: https://primumbench.org

## 8. Funding and competing interests

Funding: none. [CÉSAR: confirm; API and GPU costs were paid personally.]
Competing interests: [CÉSAR: declaración de conflictos de interés; redactarla tú.]

## References

1. Glass Box Medicine. HealthBench does not evaluate patient safety. 13 May 2025.
   https://glassboxmedicine.com/2025/05/13/healthbench-does-not-evaluate-patient-safety/
2. PeruMedQA. arXiv:2509.11517. https://arxiv.org/abs/2509.11517 [VERIFICAR: authors and
   version cited.]
3. AgentClinic. npj Digital Medicine 2026. https://www.nature.com/articles/s41746-026-02674-7
   [VERIFICAR: authors, volume and article number.]
4. Google. MedGemma 4B (`google/medgemma-4b-it`). [VERIFICAR: model card citation.]
5. Clinical references of each case (Mexican GPC/CENETEC, NOM and product labels) are listed in
   the case files (`cases/*.yaml`, field `references`).
6. [VERIFICAR: CSEDB, cited in the README for the safety/effectiveness split — full reference.]
7. [VERIFICAR: TRIPOD-LLM reporting guideline.]
