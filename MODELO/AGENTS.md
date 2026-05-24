# AGENTS.md — ATARAXIA MODELO (Wellness)

## Resumen

Recomendador de **turismo de salud y bienestar** a nivel nacional (México):

1. **Random Forest clasificador** — Q1–Q4 (+ features derivadas) → perfil de estrés con confianza
2. **Beneficio óptimo** — `benefit_profiles.yaml` pondera restauración, aislamiento y demanda física por perfil
3. **Matchmaking híbrido** — 50% beneficio + 35% alineación vectorial + 15% confianza del clasificador; diversificación por categoría
4. **Catálogo** — `data/wellness/destinos_wellness.csv` + sync a PostgreSQL (`wellness_destination`)

No usa Yelp, CF ni LightFM. No hay modelos pre-entrenados públicos para Q1–Q4 → perfil wellness;
se usa **HistGradientBoosting calibrado** (sklearn) + **reglas heurísticas** como respaldo y
**peso ×3** en evaluaciones reales de `stress_assessment`.

## Comandos

```bash
# Generar catálogo y usuarios sintéticos
python MODELO/scripts/build_destinos_seed.py
python MODELO/scripts/generate_synthetic_users.py

# Entrenar clasificador
cd MODELO/src && python -m stress_classifier --train

# Sync catálogo → Postgres (stack levantado)
cd MODELO/src && python -m wellness_catalog --sync

# API local (Docker host)
# http://localhost:8100/docs

# Figuras para paper (PDF/PNG 300 dpi + tabla LaTeX)
python MODELO/scripts/generate_paper_figures.py
python MODELO/scripts/generate_paper_figures.py --quick   # sin curva de aprendizaje (~8 min menos)
# Jupyter: MODELO/notebooks/wellness_model_evaluation.ipynb
# Salida: MODELO/models/paper_figures/
```

## Endpoints (FastAPI, puerto interno 8000 → host 8100)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | `stress_model_loaded`, `destinations_count` |
| POST | `/recommend/{user_id}` | Body: `{ q1, q2, q3, q4, top_n?, similarity? }` |
| GET | `/metrics` | accuracy, macro_f1 del clasificador |
| POST | `/api/v2/ml/session-satisfaction` | Encuesta post-plan (fit_rating 1–5, por session_id) |
| GET | `/evaluate` | Informe offline (clasificador + matchmaking) |
| POST | `/train-stress` | Reentrena clasificador (sintético + real ×3 peso) |
| POST | `/sync-catalog` | UPSERT CSV → Postgres |

## Datos

| Archivo | Uso |
|---------|-----|
| `data/wellness/destinos_wellness.csv` | Catálogo (~180 destinos) |
| `data/wellness/entrenamiento_usuarios.csv` | 5000 usuarios sintéticos |
| `data/wellness/labeling_rules.yaml` | Reglas de etiquetado |
| `data/wellness/benefit_profiles.yaml` | Pesos de beneficio terapéutico por perfil |
| `models/stress_profile_rf.joblib` | Modelo entrenado |
| `models/stress_profile_rf.meta.json` | Métricas |
| `models/wellness_eval_report.json` | Evaluación offline |

## Módulos

| Archivo | Rol |
|---------|-----|
| `stress_classifier.py` | HistGradientBoosting calibrado + híbrido con reglas |
| `stress_labeling.py` | Etiquetas heurísticas (entrenamiento real + baja confianza) |
| `user_preferences.py` | Boost por `traveler_profile` en matchmaking |
| `benefit_scoring.py` | Score de beneficio óptimo por destino/perfil |
| `training_data.py` | Merge sintético + `stress_assessment`, features engineered |
| `wellness_matchmaker.py` | Beneficio + alineación + diversificación |
| `evaluate_wellness.py` | Métricas offline del pipeline |
| `wellness_catalog.py` | CSV ↔ Postgres |
| `api.py` | FastAPI wellness |
| `poi_repository.py` | Conexión Postgres |

## Variables de entorno

- `POI_DB_*` — Postgres (mismo que API)
- `WELLNESS_SYNC_DB=1` — sync al arranque
- `SKIP_MODEL_BOOT=1` — saltar carga (tests)

## Producción — bucle de mejora

1. Cliente llama `POST /api/v2/ml/recommend/:userId` (PLATAFORMA o MOBILE con JWT).
2. API persiste `stress_assessment` y programa reentrenamiento (`ML_AUTO_RETRAIN=1`, debounce 45s).
3. `POST /train-stress` fusiona sintético + reales (etiqueta por reglas, no predicción guardada).
4. Preferencias de `traveler_profile` se envían al matchmaker para personalizar destinos.

## Tests

```bash
cd MODELO && pytest tests/test_wellness.py -q
```
