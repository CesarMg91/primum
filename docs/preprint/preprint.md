> **Nota para César (en español; se borra antes de enviar):**
> Esto es el esqueleto del preprint para medRxiv (Health Informatics), en inglés. Las cifras del
> juez LLM salen de `docs/cifras-reconciliadas.md` (corridas 56/56) y son reales. Todo lo que
> dice **[CIFRA PENDIENTE DEL ANCLAJE]** se llena con `anclaje-humano/calcular_anclaje.mjs`
> cuando termines de calificar; **la regla del plan decide el titular**: si κ ≥ 0.6 y McNemar
> humano p < 0.05, va la cifra del juez; si κ < 0.6, va la humana. Lo que dice **[CÉSAR: …]** es
> una decisión tuya (afiliación, coautor, conflictos de interés, ética). Lo que dice
> **[VERIFICAR]** hay que comprobarlo antes de enviar. La posible fuga de 17 casos de test ya se
> revisó con la historia de git (10-nov): muy probablemente no hubo; el texto lo dice como
> inferencia y reporta la cifra sin esos casos (§2.5, §3.4 y Limitaciones). Las referencias son sólo las que ya están
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
by an LLM judge (Claude Opus 4.8) that must quote the model's text. A surgeon rated a stratified
random sample of 40 test responses (20 cases × both models), and a second physician 20 of them,
blind to model and judge verdict. We report safety with Wilson 95% CIs, paired McNemar tests, and
Cohen's κ between judge and humans.

**Results.** By the LLM judge, safety rose from 12/56 (21.4%; 95% CI 12.7–33.8) for the base
model to 30/56 (53.6%; 40.7–66.0) after fine-tuning (21 cases fixed, 3 broken; exact McNemar
p = 0.0003). A second-family judge (Gemini) gave 17.9% → 50.0% (p = 0.0005; judge–judge
κ = 0.77). Judge–human agreement was κ = [CIFRA PENDIENTE DEL ANCLAJE]. By human ratings,
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
   accuracy; critiques of HealthBench [8] point out that patient safety is not a separate axis of
   its rubric [1]. CSEDB separates safety from effectiveness [6], but in Chinese clinical
   scenarios.
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

Reporting follows TRIPOD-LLM where applicable [7]. [VERIFICAR: checklist as supplement.]

### 2.1 Cases

Each case is a YAML file (`cases/`, schema in `cases/schema.json`) with: specialty, risk level,
the failure mode tested (`danger_tested`), clinical references (Mexican clinical practice
guidelines [GPC], NOMs and product labels), the patient context, one or more patient turns,
optionally a **simulated-patient persona** that pressures, minimizes or insists, and a rubric.
Rubric criteria are `must_not` (critical; any violation fails the case), `must_do` and `should`
(weighted for effectiveness) (`rubric/safety-rubric.md`).

The corpus has 154 cases: 143 high-risk, 105 multi-turn, 104 marked `reviewed` by a clinician
and 50 `needs_clinical_review`. By provenance (from the repository history): 72 initial cases
(0001–0072) [VERIFICAR: how many were written by the author and how many LLM-drafted and
author-edited]; 27 adversarial cases (cycles 2–4: 7, 12 and 8) generated by an LLM
(Claude Sonnet, filtered by a Claude Opus panel) and kept only if they broke the model under test,
all assigned to training; 27 test cases (0100–0126) generated without an adversarial filter, with
balanced failure modes, to enlarge the test split without selection bias; and 28 targeted training
cases (15 hallucination, 13 under-represented categories). All cases are synthetic; no patient
data were used.

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
**MedGemma 4B** [4] (`google/medgemma-4b-it`, v1; base, Ollama library tag `medgemma:4b`
[VERIFICAR: quantization of that tag]) and **PRIMUM c3** (the same model after three fine-tuning
cycles; merged and exported as GGUF Q8_0). The harness calls Ollama's OpenAI-compatible endpoint
with `max_tokens` 1,024 and does not set temperature; the c3 Modelfile sets temperature 0.6,
top-p 0.9 and a 4,096-token context [VERIFICAR: the base model's effective defaults].

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
(`training/train_qlora.py`). Each cycle starts from the base model, not from the previous
adapter. Cycle 3 (c3) is the checkpoint evaluated here; c4, c5 and a weight "soup" are reported in
the supplement.

*Training–test separation.* Seventeen cases now in the test split have gold responses in the
released gold file, because they were training cases in cycles 1–2 and moved to test when the
split was recomputed on 11 June 2026. The same commit added a filter that drops gold examples
whose IDs are not in the training split. The repository history indicates that c3 was trained
after that commit, on a clone of the repository that included the split file. At that point the
gold file had 79 conversations, of which 62 belonged to training IDs, so the filter would have
skipped exactly the 17 now-test cases. The training log from the cloud machine was not kept, so
this exclusion is inferred rather than logged; we therefore also report results without those 17
cases (§3.4).

### 2.6 Human anchoring (blinded)

Of the 112 test responses (56 cases × 2 models), the author rated a **random sample of 40**: 20
cases drawn by stratified random sampling on the failure mode (proportional allocation, largest
remainder; fixed seed), with **both** responses of each case, so the human comparison of base vs
c3 is paired. The sample was drawn from case metadata only, before any rating and without access
to judge verdicts. A second physician [CÉSAR: specialty] rated 20 of those 40 items (one response
per sampled case; 10 base, 10 c3). Responses were shown in random order (the two responses to a
case at least 8 positions apart) with case context, full conversation and the `must_not`
criterion, but **without model identity or judge verdict** (`anclaje-humano/`). Each rater labeled
each criterion as *violated*, *not violated* or *uncertain*. The decryption key was kept separate
until rating was complete. The sample size was reduced from the originally planned 112 to 40
for feasibility (rater time); this change and the decision rule below were fixed and committed to
the public repository before any rating began [CÉSAR: commit hash and date].

### 2.7 Outcomes and statistics

- **Safety:** proportion of cases with no `must_not` violation; **high-risk safety** on
  `risk_level: high`; **effectiveness:** weighted proportion of `must_do`/`should` met (the
  safety/effectiveness split follows CSEDB [6]).
- 95% CIs by the Wilson method. Base vs c3 compared on the same cases with the **exact McNemar
  test** (two-sided binomial on discordant pairs).
- **Cohen's κ** between judge and each human per criterion ("uncertain" excluded; sensitivity
  analyses count it as violated and as not violated), with 95% CIs by case-level bootstrap
  (2,000 resamples). κ between humans on the shared subset.
- For human-based safety, "uncertain" counts as violated (fail-safe).
- **Pre-specified decision rule (fixed before rating):** if κ(judge, author) on the 40-item sample
  is ≥ 0.6, the judge figure on all 56 cases is primary, with κ and the human figure on the sample
  as validation (the human McNemar test on 20 pairs is reported but, being underpowered, does not
  decide); if κ < 0.6, the human figure on the sample (20 paired cases) is primary and the judge is
  reported as a limitation.
- A second LLM judge from a different model family (Gemini 3.1 Pro, Vertex AI) re-scored all 112
  responses with the same prompt (`harness/src/rejudge.ts`, `scripts/juez_segunda_familia.mjs`);
  judge–judge κ is reported as a sensitivity analysis.
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
| Judge vs rater 1 | 40 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |
| Judge vs rater 2 | 20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |
| Rater 1 vs rater 2 | 20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE] |

### 3.3 Safety by human rating

On the 20 sampled cases (human rating vs judge on the same cases):

| Model | Safe cases, human | Safety, human (95% CI) | Safe cases, judge |
|---|---|---|---|
| MedGemma 4B (base) | [CIFRA PENDIENTE DEL ANCLAJE]/20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE]/20 |
| PRIMUM c3 | [CIFRA PENDIENTE DEL ANCLAJE]/20 | [CIFRA PENDIENTE DEL ANCLAJE] | [CIFRA PENDIENTE DEL ANCLAJE]/20 |

Fixed / broken: [CIFRA PENDIENTE DEL ANCLAJE]; exact McNemar p = [CIFRA PENDIENTE DEL ANCLAJE].
Outcome of the decision rule: [CIFRA PENDIENTE DEL ANCLAJE].

### 3.4 Sensitivity analyses

- Excluding the 17 test cases that have gold responses in the released gold file (n = 39),
  judge-rated safety was 7/39 (17.9%) for base and 18/39 (46.2%) for c3 (13 fixed, 2 broken;
  exact McNemar p = 0.0074). The improvement remains significant without any case that ever had a
  gold response (§2.5).
- **Second-family judge (Gemini 3.1 Pro):** safety 10/56 (17.9%; 95% CI 10.0–29.8) for base and
  28/56 (50.0%; 37.3–62.7) for c3, exact McNemar p = 0.0005; the same +32.1-point improvement as
  with the Claude judge. Agreement between the two judges: κ = 0.77 (95% CI 0.64–0.88); 12 of 112
  verdicts disagree, 6 per model, with no sign that the Claude judge favours c3.
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

- **LLM judges.** The primary judge is a Claude model, and so are the adversarial case generator,
  the simulated patient and the gold-verifying panel, which could favour a model trained on
  Claude-generated gold responses. A second-family judge (Gemini) gave the same improvement and
  agreed substantially (κ = 0.77), which argues against a family bias, but both are LLMs.
- **Clinical review is incomplete.** 50 of 154 cases (14 of the 56 test cases) are still marked
  `needs_clinical_review`.
- **Small test set.** 56 cases give wide confidence intervals; failure-mode subgroups have 2–17
  cases and are descriptive only.
- **Human anchoring is limited:** a 40-item random sample (36% of responses) rated by the author
  and 20 items by a second physician, instead of all 112, for feasibility. κ is therefore estimated
  with a wide confidence interval and the human McNemar test (20 pairs) has low power; the change
  was fixed before rating. The author also built the benchmark, which may bias his ratings despite
  blinding. Raters may recognise a model by style. [CIFRA PENDIENTE DEL ANCLAJE: κ between humans.]
- **Training–test separation is inferred, not logged.** 17 test cases have gold responses in the
  public gold file. The repository history indicates they were filtered out of c3's training data
  (§2.5), but the cloud training log was not preserved. The sensitivity analysis without them
  (n = 39) still shows a significant improvement. The training script now refuses to run without the split
  file and writes a data manifest (used and skipped case IDs, file hashes) with every run.
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

1. Draelos R. HealthBench does not evaluate patient safety [Internet]. Glass Box Medicine; 2025
   May 13 [cited 2026 Nov 9]. Available from:
   https://glassboxmedicine.com/2025/05/13/healthbench-does-not-evaluate-patient-safety/
2. Carrillo-Larco RM, Lovón-Melgarejo J, Castillo-Cara M, Bravo-Rocca G. PeruMedQA:
   benchmarking large language models (LLMs) on Peruvian medical exams—dataset construction and
   evaluation. Med Sci Educ. 2026;36(4):1955-64. doi:10.1007/s40670-026-02692-w
3. Schmidgall S, Ziaei R, Harris C, Kim JW, Reis EP, Jopling J, et al. AgentClinic: a multimodal
   benchmark for tool-using clinical AI agents. NPJ Digit Med. 2026;9(1):499.
   doi:10.1038/s41746-026-02674-7
4. Sellergren A, Kazemzadeh S, Mahvar F, Kiraly A, Traverse M, Kohlberger T, et al. An open
   vision-language model for diverse medical applications. Nat Med. 2026;32(10):3695-704.
   doi:10.1038/s41591-026-04626-w (model used: `google/medgemma-4b-it`)
5. Clinical references of each case (Mexican GPC/CENETEC, NOM and product labels) are listed in
   the case files (`cases/*.yaml`, field `references`).
6. Wang S, Tang Z, Yang H, Gong Q, Gu T, Ma H, et al. A novel evaluation benchmark for medical
   LLMs illuminating safety and effectiveness in clinical domains. NPJ Digit Med. 2026;9(1):91.
   doi:10.1038/s41746-025-02277-8
7. Gallifant J, Afshar M, Ameen S, Aphinyanaphongs Y, Chen S, Cacciamani G, et al. The TRIPOD-LLM
   reporting guideline for studies using large language models. Nat Med. 2025;31(1):60-9.
   doi:10.1038/s41591-024-03425-5
8. Arora RK, Wei J, Hicks RS, Bowman P, Quiñonero-Candela J, Tsimpourlas F, et al. HealthBench:
   evaluating large language models towards improved human health. arXiv:2505.08775 [Preprint].
   2025. doi:10.48550/arXiv.2505.08775

*References verified against the publisher, arXiv or Crossref metadata on 9 Nov 2026. The
state-of-the-art references from the plan (§4.2) are added after reading their full texts.*
