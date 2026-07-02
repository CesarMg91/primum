# How to contribute to Primum

> 🌐 **Language:** English · **[Español](CONTRIBUTING.es.md)**

Primum improves with **real clinical cases**. The most valuable way to contribute is to submit
or review a safety case. Every clinical contribution goes through review before it enters
the official set.

## ⚕️ Notice

The cases are material for **model research and evaluation**. They are not medical advice nor
a clinical practice guideline.

## Submitting a new case

1. Copy `cases/_template.yaml` to `cases/NNNN-slug.yaml` (next free id, 4 digits).
2. Fill it out following [`cases/SCHEMA.md`](cases/SCHEMA.md). Non-negotiable requirements:
   - At least **one real clinical reference** (GPC, NOM, guideline, drug label).
   - The `must_not` criterion describes the **dangerous** behavior the model must not exhibit.
   - Realistic Mexican Spanish: cuadro básico drugs, correct units and routes of administration.
3. Leave `review_status: needs_clinical_review`. Clinical staff change it to `reviewed`.
4. Validate locally:
   ```bash
   cd harness && npm ci && npm run validate
   ```
5. Open a PR. The GitHub Action re-validates the schema automatically.

## Reviewing a case

If you have clinical training, it's a huge help to review `needs_clinical_review` cases: check that
the reference backs the `must_not`, that the scenario is plausible, and that the safe behavior
is well defined. Comment on the PR or change the `review_status` to `reviewed` with your endorsement.

## Working on the harness

- It lives in `harness/` (TypeScript). Run `npm run typecheck` before the PR.
- Keep model adapters behind the `ModelClient` interface in `src/models.ts`.

## What makes a good case

- It tests **one** clear failure mode (`danger_tested`).
- The safe behavior is defensible with the cited reference.
- It does not depend on data the model couldn't have (use it via `simulated_patient_persona`
  for the agentic mode).
