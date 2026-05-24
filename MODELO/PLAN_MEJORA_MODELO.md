# Plan de mejora del modelo wellness — ATARAXIA

**Fecha de registro:** 23 de mayo de 2026  
**Responsable técnico:** equipo ATARAXIA / MODELO  
**Estado del pipeline:** wellness (clasificador de estrés + matchmaker terapéutico)

---

## 1. Métricas actuales (línea base)

Fuente: `models/stress_profile_rf.meta.json`, `models/paper_figures/evaluation_summary.json`, evaluación offline mayo 2026.

### 1.1 Clasificador de perfil de estrés (hold-out 20%, HistGradientBoosting calibrado + híbrido en producción)

| Métrica | Valor | Notas |
|---------|-------|--------|
| **Accuracy (ML, test)** | **53,6%** | Por encima del azar (33% con 3 clases) |
| **Macro-F1 (ML, test)** | **53,3%** | KPI principal offline |
| **Accuracy (pipeline híbrido, test)** | **46,6%** | ML + reglas clínicas (umbral confianza 0,58) |
| **Macro-F1 (pipeline híbrido, test)** | **44,2%** | Lo que ve el usuario en app |
| **n_train** | 4 008 | Sintético + reales ponderados ×3 |
| **n_test** | 1 003 | |
| **Evaluaciones reales en BD** | **11** | Tabla `stress_assessment` — cuello de botella |
| **Destinos activos** | ~120 | `wellness_destination` / CSV |

### 1.2 F1 por perfil (test ML)

| Perfil | Precisión | Recall | F1 | Soporte (test) |
|--------|-----------|--------|-----|----------------|
| Burnout | 0,46 | 0,42 | 0,44 | 345 |
| Fatiga física | 0,58 | 0,68 | 0,63 | 333 |
| Hiperactividad ansiosa | 0,56 | 0,51 | 0,53 | 325 |

### 1.3 Matchmaker (escenarios canónicos Q1–Q4)

| Perfil esperado | Predicho | Confianza | Beneficio óptimo medio (top-3) |
|-----------------|----------|-----------|------------------------------|
| Burnout | Burnout | 1,00 | 76,4% |
| Fatiga física | Fatiga física | 0,55 | 93,7% |
| Hiperactividad ansiosa | Hiperactividad ansiosa | 0,93 | 72,8% |

### 1.4 Operación (30 días, si aplica)

| Métrica | Valor aprox. | Tabla |
|---------|--------------|--------|
| Sesiones de recomendación | Variable | `ml_recommendation_session` |
| CTR clicks en ítems | Por medir | `ml_recommendation_feedback` |
| **Encuesta post-resultado** | **0 → en despliegue** | `ml_session_satisfaction` (nueva) |

---

## 2. Diagnóstico (por qué los números no son “altos”)

1. **Datos casi 100% sintéticos** — el modelo aprende patrones del generador, no la variabilidad humana real.
2. **Solo 11 check-ins reales** — el retrain automático (peso ×3) apenas mueve el clasificador.
3. **Etiquetas difusas** — Burnout vs Fatiga se solapan; hiperactividad con peor F1 en algunos runs.
4. **Híbrido clínico** — mejora plausibilidad pero **baja** accuracy en test frente a ML puro.
5. **Sin ground truth de recomendación** hasta ahora — beneficio % del CSV ≠ “el usuario reservó y descansó”.

---

## 3. Implementado en esta iteración (23-may-2026)

### 3.1 Encuesta post-resultado (1 pregunta) → `session_id`

- **Pregunta:** *¿Este plan encaja con cómo te sientes ahora?* (escala 1–5)
- **API:** `POST /api/v2/ml/session-satisfaction`  
  Body: `{ "session_id": number, "fit_rating": 1-5 }`
- **BD:** tabla `ml_session_satisfaction` (única valoración por sesión, UPSERT)
- **UI:** `WellnessRecommendationsResult.tsx` (PLATAFORMA), tras ver destinos
- **Dashboard ML:** `GET /api/v2/ml/health` incluye `satisfaction_30d` (total, avg_rating, positive_count)

**Migración local:**

```powershell
Get-Content "API/migrations/002_ml_session_satisfaction.sql" | docker exec -i ataraxia-postgres psql -U postgres -d ataraxia
```

---

## 4. Plan de mejora por fases

### Fase 1 — Datos y feedback (0–8 semanas) — **máxima prioridad**

| # | Acción | Objetivo | Métrica objetivo | Esfuerzo |
|---|--------|----------|------------------|----------|
| 1.1 | Desplegar encuesta `session_satisfaction` | ≥100 respuestas | `satisfaction_30d.total` ≥ 100 | Hecho código |
| 1.2 | Campaña beta turistas (demo + reales) | ≥200 `stress_assessment` | `n_real_assessments` ≥ 200 | Producto |
| 1.3 | Reentrenar semanal (`POST /ml/train`) | Incorporar reales | Macro-F1 ≥ **0,58** | Bajo |
| 1.4 | Panel dashboard: media encuesta + N | Monitoreo | avg_rating ≥ **3,8** | Bajo |
| 1.5 | Registrar clics en destinos (`POST /ml/feedback`) | Señal ranking | CTR ≥ **8%** | Medio |

### Fase 2 — Calidad de etiquetas (4–12 semanas)

| # | Acción | Objetivo | Métrica objetivo | Esfuerzo |
|---|--------|----------|------------------|----------|
| 2.1 | Revisión clínica 50 casos mal clasificados | Matriz de confusión | Reducir confusiones Burnout↔Fatiga 15% | Medio |
| 2.2 | Regenerar sintéticos alineados a distribución real | Menos sesgo | Balance clases ±5% | Medio |
| 2.3 | Doble etiqueta en lote piloto (reglas vs experto) | Cohen's κ | κ ≥ **0,65** | Alto |
| 2.4 | Correlacionar `fit_rating` con `match_pct` | Validar matchmaker | r ≥ **0,35** | Medio |

### Fase 3 — Modelo y arquitectura (8–16 semanas)

| # | Acción | Objetivo | Métrica objetivo | Esfuerzo |
|---|--------|----------|------------------|----------|
| 3.1 | A/B: solo ML vs híbrido vs solo reglas | Elegir producción | Mejor macro-F1 **y** avg encuesta | Medio |
| 3.2 | Ajustar umbral híbrido (0,58 → grid 0,50–0,70) | Optimizar trade-off | +3–5 pp macro-F1 híbrido | Bajo |
| 3.3 | Modelo jerárquico (agotamiento vs activación) | Perfiles difusos | Macro-F1 ≥ **0,62** | Alto |
| 3.4 | Usar `fit_rating` como peso de entrenamiento en matchmaker | Learning-to-rank ligero | NDCG humano piloto | Alto |

### Fase 4 — Producto y paper (continuo)

| # | Acción | Objetivo | Métrica objetivo | Esfuerzo |
|---|--------|----------|------------------|----------|
| 4.1 | Regenerar figuras paper tras cada hito | Documentación | Actualizar `PLAN_MEJORA_MODELO.md` | Bajo |
| 4.2 | Meta macro-F1 con 500+ reales | Modelo maduro | **0,65–0,72** | Largo plazo |
| 4.3 | Encuesta post-viaje (opcional) | Outcome real | NPS / “me ayudó a descansar” | Alto |

---

## 5. Metas numéricas resumidas

| Hito | Macro-F1 (híbrido) | Evaluaciones reales | Encuestas satisfacción |
|------|--------------------|---------------------|-------------------------|
| **Hoy (may-2026)** | ~0,44 | 11 | 0 |
| **8 semanas** | ≥ 0,55 | ≥ 150 | ≥ 80 |
| **6 meses** | ≥ 0,62 | ≥ 500 | ≥ 300, avg ≥ 3,8 |

---

## 6. Comandos útiles

```bash
# Reentrenar clasificador
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/v2/ml/train

# Salud ML (incluye satisfaction_30d)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/v2/ml/health

# Figuras paper
cd MODELO && .venv/Scripts/python.exe scripts/generate_paper_figures.py --quick

# Tests wellness
docker exec ataraxia-modelo pytest /app/tests/test_wellness.py -q
```

---

## 7. Registro de cambios en este documento

| Fecha | Cambio | Métricas tras cambio |
|-------|--------|----------------------|
| 2026-05-23 | Línea base + plan inicial + encuesta `ml_session_satisfaction` | Ver §1 |

*Actualizar esta tabla cada vez que se cierre una fase del plan.*
