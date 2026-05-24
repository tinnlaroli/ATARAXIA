# Figuras para paper — ATARAXIA Wellness

Generadas con `python scripts/generate_paper_figures.py` o el notebook `notebooks/wellness_model_evaluation.ipynb`.

### Entorno virtual (Windows)

En PowerShell, desde `MODELO/`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-paper.txt
python scripts\generate_paper_figures.py --quick
```

O ejecuta `.\scripts\setup_venv.ps1` y luego activa `.venv`.

> En Windows usa `python -m pip`, no `pip` suelto, si no está en el PATH.

| Archivo | Contenido |
|---------|-----------|
| `fig01_confusion_matrix` | Matriz de confusión (conteos + normalizada) |
| `fig02_per_class_metrics` | Precisión, recall y F1 por perfil |
| `fig03_class_distribution` | Balance de clases en entrenamiento |
| `fig04_aggregate_metrics` | Accuracy y macro-F1 global |
| `fig05_learning_curve` | Curva de aprendizaje (validación cruzada) |
| `fig06_real_data_projection` | Proyección con más evaluaciones reales |
| `fig07_recommendation_benefit` | Beneficio terapéutico por escenario |
| `fig08_feature_importance` | Importancia por permutación |
| `table_stress_metrics.tex` | Tabla lista para LaTeX |
| `evaluation_summary.json` | Resumen numérico |

En el paper, citar el protocolo: hold-out 20% estratificado, HistGradientBoosting calibrado, fusión sintético + real (peso ×3), pipeline híbrido con umbral de confianza 0.58.
