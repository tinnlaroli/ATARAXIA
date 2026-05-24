"""
Generación de figuras y tablas para paper científico — pipeline wellness ATARAXIA.
Ejecutar: python scripts/generate_paper_figures.py
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import learning_curve, train_test_split

from evaluate_wellness import run_full_eval
from stress_classifier import (
    PROFILE_LABELS_ES,
    HYBRID_CONFIDENCE_THRESHOLD,
    StressProfileClassifier,
    TARGET_COL,
)
from training_data import build_merged_training_set

_ROOT = Path(__file__).resolve().parent.parent
_FIG_DIR = _ROOT / "models" / "paper_figures"
_META_PATH = _ROOT / "models" / "stress_profile_rf.meta.json"
_REPORT_PATH = _ROOT / "models" / "wellness_eval_report.json"

# Paleta ATARAXIA (accesible en impresión)
COLORS = {
    "canvas": "#f3f7ee",
    "surface": "#d2e0c9",
    "primary": "#a9c7a1",
    "primary_deep": "#8caf84",
    "earth": "#b8a27e",
    "forest": "#505d4f",
    "burnout": "#8caf84",
    "fatiga": "#b8a27e",
    "hiper": "#6b786a",
}

CLASS_ORDER = ["Burnout", "Fatiga_Fisica", "Hiperactividad_Ansiosa"]
CLASS_LABELS_SHORT = {
    "Burnout": "Burnout",
    "Fatiga_Fisica": "Fatiga física",
    "Hiperactividad_Ansiosa": "Hiperactividad ansiosa",
}


def setup_matplotlib_style() -> None:
    plt.rcParams.update(
        {
            "figure.dpi": 120,
            "savefig.dpi": 300,
            "font.family": "sans-serif",
            "font.sans-serif": ["DejaVu Sans", "Arial", "Helvetica"],
            "font.size": 10,
            "axes.labelsize": 11,
            "axes.titlesize": 12,
            "legend.fontsize": 9,
            "xtick.labelsize": 9,
            "ytick.labelsize": 9,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "grid.alpha": 0.35,
            "grid.linestyle": "--",
        }
    )


def _ensure_dirs() -> Path:
    _FIG_DIR.mkdir(parents=True, exist_ok=True)
    return _FIG_DIR


def _save_fig(fig: plt.Figure, name: str) -> None:
    out = _ensure_dirs()
    for ext in ("png", "pdf"):
        fig.savefig(out / f"{name}.{ext}", bbox_inches="tight", facecolor="white")
    plt.close(fig)


def load_or_train_metrics(retrain: bool = False) -> dict[str, Any]:
    if retrain or not _META_PATH.exists():
        clf = StressProfileClassifier()
        metrics = clf.train(use_merged=True, real_weight=3.0)
    else:
        metrics = json.loads(_META_PATH.read_text(encoding="utf-8"))
    return metrics


def hybrid_test_predictions(clf: StressProfileClassifier) -> tuple[np.ndarray, np.ndarray]:
    """Predicciones en hold-out 20% con pipeline híbrido (producción)."""
    df = build_merged_training_set()
    df = clf._prepare_df(df)
    q_cols = [
        "q1_energia_cognitiva",
        "q2_tension_fisica",
        "q3_rumiacion",
        "q4_activacion_negativa",
    ]
    y = df[TARGET_COL].astype(str).values
    idx = np.arange(len(df))
    _, test_idx, _, y_test = train_test_split(
        idx, y, test_size=0.2, random_state=42, stratify=y
    )
    if clf.model is None:
        clf.load()

    preds = []
    for i in test_idx:
        row = df.iloc[i]
        pred, _, _ = clf.predict(
            int(row["q1_energia_cognitiva"]),
            int(row["q2_tension_fisica"]),
            int(row["q3_rumiacion"]),
            int(row["q4_activacion_negativa"]),
        )
        preds.append(pred)
    return y_test, np.array(preds)


def fig_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray) -> None:
    labels = [c for c in CLASS_ORDER if c in np.unique(np.concatenate([y_true, y_pred]))]
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    cm_norm = cm.astype(float) / np.maximum(cm.sum(axis=1, keepdims=True), 1)

    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2))
    disp_labels = [CLASS_LABELS_SHORT.get(l, l) for l in labels]

    ConfusionMatrixDisplay(cm, display_labels=disp_labels).plot(
        ax=axes[0], cmap="Greens", colorbar=False, values_format="d"
    )
    axes[0].set_title("(a) Matriz de confusión — conteos")
    axes[0].set_xlabel("Perfil predicho")
    axes[0].set_ylabel("Perfil real (reglas + test)")

    im = axes[1].imshow(cm_norm, cmap="YlGn", vmin=0, vmax=1)
    axes[1].set_xticks(range(len(labels)))
    axes[1].set_yticks(range(len(labels)))
    axes[1].set_xticklabels(disp_labels, rotation=25, ha="right")
    axes[1].set_yticklabels(disp_labels)
    for i in range(len(labels)):
        for j in range(len(labels)):
            axes[1].text(j, i, f"{cm_norm[i, j]:.0%}", ha="center", va="center", fontsize=9)
    axes[1].set_title("(b) Matriz normalizada por fila")
    axes[1].set_xlabel("Perfil predicho")
    fig.colorbar(im, ax=axes[1], fraction=0.046, pad=0.04)
    fig.suptitle(
        "Clasificador de estrés — hold-out 20% (pipeline híbrido ML + reglas clínicas)",
        fontsize=12,
        y=1.02,
    )
    fig.tight_layout()
    _save_fig(fig, "fig01_confusion_matrix")


def fig_per_class_metrics(metrics: dict[str, Any]) -> None:
    report = metrics.get("classification_report", {})
    rows = []
    for key in CLASS_ORDER:
        if key not in report:
            continue
        r = report[key]
        rows.append(
            {
                "profile": CLASS_LABELS_SHORT.get(key, key),
                "precision": r["precision"],
                "recall": r["recall"],
                "f1": r["f1-score"],
            }
        )
    if not rows:
        return

    df = pd.DataFrame(rows)
    x = np.arange(len(df))
    w = 0.25
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(x - w, df["precision"], width=w, label="Precisión", color=COLORS["primary"])
    ax.bar(x, df["recall"], width=w, label="Recall", color=COLORS["earth"])
    ax.bar(x + w, df["f1"], width=w, label="F1", color=COLORS["forest"])
    ax.set_xticks(x)
    ax.set_xticklabels(df["profile"])
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Puntuación")
    ax.set_title("Métricas por perfil de estrés (conjunto de test)")
    ax.legend(loc="lower right", ncol=3)
    for i, row in df.iterrows():
        ax.text(i, row["f1"] + 0.02, f"{row['f1']:.2f}", ha="center", fontsize=8)
    fig.tight_layout()
    _save_fig(fig, "fig02_per_class_metrics")


def fig_class_distribution(metrics: dict[str, Any]) -> None:
    dist = metrics.get("class_distribution", {})
    if not dist:
        return
    labels = [CLASS_LABELS_SHORT.get(k, k) for k in CLASS_ORDER if k in dist]
    values = [dist[k] for k in CLASS_ORDER if k in dist]
    colors = [COLORS["burnout"], COLORS["fatiga"], COLORS["hiper"]][: len(values)]

    fig, axes = plt.subplots(1, 2, figsize=(9, 3.8))
    axes[0].bar(labels, values, color=colors, edgecolor=COLORS["forest"], linewidth=0.6)
    axes[0].set_title("(a) Distribución de clases — entrenamiento fusionado")
    axes[0].set_ylabel("Nº de muestras")
    axes[0].tick_params(axis="x", rotation=15)

    axes[1].pie(
        values,
        labels=labels,
        autopct="%1.1f%%",
        colors=colors,
        startangle=90,
        textprops={"fontsize": 9},
    )
    axes[1].set_title("(b) Proporción relativa")
    n_real = metrics.get("n_real_assessments", 0)
    fig.suptitle(
        f"Balance del dataset (sintético + real ponderado ×3) · evaluaciones reales: {n_real}",
        y=1.02,
    )
    fig.tight_layout()
    _save_fig(fig, "fig03_class_distribution")


def fig_aggregate_metrics(metrics: dict[str, Any]) -> None:
    acc = metrics.get("accuracy", 0)
    f1 = metrics.get("macro_f1", 0)
    names = ["Accuracy", "Macro-F1"]
    vals = [acc, f1]

    fig, ax = plt.subplots(figsize=(5, 4))
    bars = ax.bar(names, vals, color=[COLORS["primary_deep"], COLORS["earth"]], width=0.5)
    ax.set_ylim(0, 1.0)
    ax.axhline(0.33, color="#ccc", linestyle=":", label="Azar (3 clases)")
    ax.set_ylabel("Puntuación")
    ax.set_title("Rendimiento global del clasificador")
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.1%}", ha="center", fontweight="bold")
    ax.legend()
    subtitle = (
        f"n_train={metrics.get('n_train', '—')} · n_test={metrics.get('n_test', '—')} · "
        f"umbral híbrido={metrics.get('hybrid_threshold', HYBRID_CONFIDENCE_THRESHOLD)}"
    )
    ax.text(0.5, -0.12, subtitle, transform=ax.transAxes, ha="center", fontsize=8, color=COLORS["forest"])
    fig.tight_layout()
    _save_fig(fig, "fig04_aggregate_metrics")


def fig_learning_curve(train_sizes: list[float] | None = None) -> None:
    """Curva de aprendizaje: macro-F1 vs tamaño del conjunto de entrenamiento."""
    if train_sizes is None:
        train_sizes = [0.2, 0.4, 0.6, 0.8, 1.0]

    clf = StressProfileClassifier()
    df = build_merged_training_set()
    df = clf._prepare_df(df)
    X = df[clf.feature_cols].astype(float).values
    y = df[TARGET_COL].astype(str).values
    sw = df["sample_weight"].astype(float).values if "sample_weight" in df.columns else None

    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import HistGradientBoostingClassifier

    base = HistGradientBoostingClassifier(
        max_depth=10,
        learning_rate=0.08,
        max_iter=250,
        min_samples_leaf=8,
        l2_regularization=0.5,
        random_state=42,
    )
    estimator = CalibratedClassifierCV(base, method="sigmoid", cv=3, ensemble=True)

    lc_kwargs: dict[str, Any] = dict(
        train_sizes=train_sizes,
        cv=3,
        scoring="f1_macro",
        n_jobs=1,
        shuffle=True,
        random_state=42,
    )
    try:
        sizes_abs, train_scores, test_scores = learning_curve(
            estimator, X, y, **lc_kwargs, fit_params={"sample_weight": sw}
        )
    except TypeError:
        sizes_abs, train_scores, test_scores = learning_curve(estimator, X, y, **lc_kwargs)

    train_mean = train_scores.mean(axis=1)
    train_std = train_scores.std(axis=1)
    test_mean = test_scores.mean(axis=1)
    test_std = test_scores.std(axis=1)

    fig, ax = plt.subplots(figsize=(6.5, 4))
    ax.fill_between(sizes_abs, train_mean - train_std, train_mean + train_std, alpha=0.2, color=COLORS["primary"])
    ax.fill_between(sizes_abs, test_mean - test_std, test_mean + test_std, alpha=0.2, color=COLORS["earth"])
    ax.plot(sizes_abs, train_mean, "o-", color=COLORS["primary_deep"], label="Entrenamiento (CV)")
    ax.plot(sizes_abs, test_mean, "s-", color=COLORS["earth"], label="Validación (CV)")
    ax.set_xlabel("Tamaño del conjunto de entrenamiento")
    ax.set_ylabel("Macro-F1")
    ax.set_title("Curva de aprendizaje — HistGradientBoosting calibrado")
    ax.legend(loc="lower right")
    fig.tight_layout()
    _save_fig(fig, "fig05_learning_curve")


def fig_real_data_projection(metrics: dict[str, Any]) -> None:
    """
    Proyección de macro-F1 al incorporar más evaluaciones reales.
    Combina punto actual + ajuste exponencial hacia asintota estimada.
    """
    n_real = int(metrics.get("n_real_assessments", 0))
    f1_now = float(metrics.get("macro_f1", 0.52))
    # Asintota teórica conservadora con más datos clínicos homogéneos
    f1_asymptote = min(0.78, f1_now + 0.22)
    k = 0.035  # tasa de saturación por evaluación real

    n_grid = np.array([0, 10, 25, 50, 100, 200, 500, 1000])
    projected = f1_asymptote - (f1_asymptote - f1_now) * np.exp(-k * np.maximum(n_grid - n_real, 0))
    projected[n_grid < n_real] = np.nan  # solo proyección hacia adelante desde hoy

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.axhline(1 / 3, color="#ccc", linestyle=":", label="Línea base (azar)")
    ax.plot(n_grid, projected, "--", color=COLORS["earth"], linewidth=2, label="Proyección macro-F1")
    ax.scatter([n_real], [f1_now], s=120, zorder=5, color=COLORS["forest"], label=f"Actual (n_real={n_real})")
    ax.annotate(
        f"{f1_now:.1%}",
        (n_real, f1_now),
        textcoords="offset points",
        xytext=(8, 8),
        fontsize=9,
        fontweight="bold",
    )
    ax.set_xlabel("Evaluaciones reales acumuladas (stress_assessment)")
    ax.set_ylabel("Macro-F1 estimado")
    ax.set_title("Proyección de rendimiento con datos clínicos en producción")
    ax.set_ylim(0.25, 0.85)
    ax.legend(loc="lower right")
    ax.text(
        0.02,
        0.02,
        "Modelo: F(n) = F∞ − (F∞ − F₀)·e^{-k·max(0,n−n₀)}\n"
        "Los datos reales se ponderan ×3 en reentrenamiento.",
        transform=ax.transAxes,
        fontsize=7.5,
        va="bottom",
        color=COLORS["forest"],
    )
    fig.tight_layout()
    _save_fig(fig, "fig06_real_data_projection")


def fig_recommendation_benefit(report_path: Path | None = None) -> None:
    path = report_path or _REPORT_PATH
    if not path.exists():
        run_full_eval()
    data = json.loads(path.read_text(encoding="utf-8"))
    scenarios = data.get("recommendation_scenarios", {})
    if not scenarios:
        return

    profiles = []
    benefits = []
    colors = []
    for key in CLASS_ORDER:
        if key not in scenarios:
            continue
        s = scenarios[key]
        profiles.append(CLASS_LABELS_SHORT.get(key, key))
        benefits.append(s["avg_beneficio_optimo_pct"])
        ok = s.get("expected_profile") == s.get("predicted_profile")
        colors.append(COLORS["primary_deep"] if ok else COLORS["earth"])

    fig, ax = plt.subplots(figsize=(6.5, 4))
    bars = ax.bar(profiles, benefits, color=colors, edgecolor=COLORS["forest"], linewidth=0.6)
    ax.set_ylabel("Beneficio terapéutico óptimo medio (%)")
    ax.set_title("Calidad de recomendaciones por escenario clínico (top-3 destinos)")
    ax.set_ylim(0, 100)
    for b, v in zip(bars, benefits):
        ax.text(b.get_x() + b.get_width() / 2, v + 1.5, f"{v:.1f}%", ha="center", fontsize=9)
    ax.text(
        0.5,
        -0.14,
        "Barras en verde: perfil predicho = esperado · Matchmaker: filtro por beneficio + similitud coseno",
        transform=ax.transAxes,
        ha="center",
        fontsize=8,
        color=COLORS["forest"],
    )
    fig.tight_layout()
    _save_fig(fig, "fig07_recommendation_benefit")


def fig_feature_importance(clf: StressProfileClassifier | None = None) -> None:
    from sklearn.inspection import permutation_importance

    clf = clf or StressProfileClassifier()
    if clf.model is None:
        clf.load()
    df = build_merged_training_set()
    df = clf._prepare_df(df)
    X = df[clf.feature_cols].astype(float).values
    y = df[TARGET_COL].astype(str).values
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    result = permutation_importance(
        clf.model, X_test, y_test, n_repeats=12, random_state=42, scoring="f1_macro", n_jobs=1
    )
    imp = result.importances_mean
    order = np.argsort(imp)
    labels = [clf.feature_cols[i].replace("_", "\n") for i in order]

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.barh(labels, imp[order], color=COLORS["primary"])
    ax.set_xlabel("Importancia por permutación (↓ macro-F1)")
    ax.set_title("Contribución de variables al clasificador")
    fig.tight_layout()
    _save_fig(fig, "fig08_feature_importance")


def export_latex_table(metrics: dict[str, Any]) -> Path:
    report = metrics.get("classification_report", {})
    lines = [
        r"\begin{table}[ht]",
        r"\centering",
        r"\caption{Métricas del clasificador de perfil de estrés (hold-out 20\%)}",
        r"\label{tab:stress-metrics}",
        r"\begin{tabular}{lrrrr}",
        r"\hline",
        r"Perfil & Precisión & Recall & F1 & Soporte \\",
        r"\hline",
    ]
    for key in CLASS_ORDER:
        if key not in report:
            continue
        r = report[key]
        name = CLASS_LABELS_SHORT.get(key, key).replace(" ", "~")
        lines.append(
            f"{name} & {r['precision']:.3f} & {r['recall']:.3f} & {r['f1-score']:.3f} & {int(r['support'])} \\\\"
        )
    lines.extend(
        [
            r"\hline",
            f"Accuracy & \\multicolumn{{3}}{{c}}{{{metrics.get('accuracy', 0):.3f}}} & "
            f"{int(report.get('macro avg', {}).get('support', 0))} \\\\",
            f"Macro-F1 & \\multicolumn{{3}}{{c}}{{{metrics.get('macro_f1', 0):.3f}}} & \\\\",
            r"\hline",
            r"\end{tabular}",
            r"\end{table}",
        ]
    )
    out = _ensure_dirs() / "table_stress_metrics.tex"
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def generate_all_figures(
    retrain: bool = False,
    skip_learning_curve: bool = False,
) -> Path:
    setup_matplotlib_style()
    metrics = load_or_train_metrics(retrain=retrain)
    run_full_eval()

    clf = StressProfileClassifier()
    clf.load()
    y_test, y_pred = hybrid_test_predictions(clf)

    fig_confusion_matrix(y_test, y_pred)
    fig_per_class_metrics(metrics)
    fig_class_distribution(metrics)
    fig_aggregate_metrics(metrics)
    if not skip_learning_curve:
        fig_learning_curve()
    fig_real_data_projection(metrics)
    fig_recommendation_benefit()
    fig_feature_importance(clf)
    tex_path = export_latex_table(metrics)

    summary = {
        "accuracy": metrics.get("accuracy"),
        "macro_f1": metrics.get("macro_f1"),
        "n_train": metrics.get("n_train"),
        "n_test": metrics.get("n_test"),
        "n_real_assessments": metrics.get("n_real_assessments"),
        "hybrid_test_accuracy": float(accuracy_score(y_test, y_pred)),
        "hybrid_test_macro_f1": float(f1_score(y_test, y_pred, average="macro")),
        "figures_dir": str(_FIG_DIR),
        "latex_table": str(tex_path),
    }
    summary_path = _ensure_dirs() / "evaluation_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return _FIG_DIR
