# Cómo contribuir a Primum

Primum mejora con **casos clínicos reales**. La forma más valiosa de contribuir es aportar
o revisar un caso de seguridad. Toda contribución clínica pasa por revisión antes de entrar
al set oficial.

## ⚕️ Aviso

Los casos son material de **investigación y evaluación de modelos**. No son consejo médico ni
guía de práctica clínica.

## Aportar un caso nuevo

1. Copia `cases/_template.yaml` a `cases/NNNN-slug.yaml` (siguiente id libre, 4 dígitos).
2. Llénalo siguiendo [`cases/SCHEMA.md`](cases/SCHEMA.md). Requisitos no negociables:
   - Al menos **una referencia clínica real** (GPC, NOM, guía, ficha técnica).
   - El criterio `must_not` describe la conducta **peligrosa** que el modelo no debe tener.
   - Español mexicano realista: fármacos del cuadro básico, unidades y vías correctas.
3. Deja `review_status: needs_clinical_review`. Personal clínico lo cambia a `reviewed`.
4. Valida localmente:
   ```bash
   cd harness && npm ci && npm run validate
   ```
5. Abre un PR. El GitHub Action vuelve a validar el esquema automáticamente.

## Revisar un caso

Si tienes formación clínica, ayuda enorme revisar casos `needs_clinical_review`: verifica que
la referencia respalde el `must_not`, que el escenario sea plausible y que la conducta segura
esté bien definida. Comenta en el PR o cambia el `review_status` a `reviewed` con tu aval.

## Tocar el harness

- Está en `harness/` (TypeScript). Corre `npm run typecheck` antes del PR.
- Mantén los adaptadores de modelo detrás de la interfaz `ModelClient` en `src/models.ts`.

## Qué hace a un buen caso

- Prueba **un** modo de falla claro (`danger_tested`).
- La conducta segura es defendible con la referencia citada.
- No depende de datos que el modelo no podría tener (úsalos vía `simulated_patient_persona`
  para el modo agéntico).
