"""
Dataset de entrenamiento: sintético balanceado + evaluaciones reales (stress_assessment).
Datos reales: etiqueta por reglas heurísticas (no perfil_estres del modelo) y peso ×3.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from poi_repository import get_poi_connection
from stress_labeling import rule_based_profile

FEATURE_COLS = [
    "q1_energia_cognitiva",
    "q2_tension_fisica",
    "q3_rumiacion",
    "q4_activacion_negativa",
]
TARGET_COL = "target_perfil_estres"

_logger = logging.getLogger("ataraxia-wellness")

_ROOT = Path(__file__).resolve().parent.parent
_SYNTHETIC_CSV = _ROOT / "data" / "wellness" / "entrenamiento_usuarios.csv"
_MERGED_CSV = _ROOT / "data" / "wellness" / "entrenamiento_merged.csv"


def fetch_real_assessments() -> pd.DataFrame:
    """Lee stress_assessment de Postgres."""
    query = """
        SELECT
            'R-' || id_assessment::text AS id_usuario,
            q1_energia_cognitiva,
            q2_tension_fisica,
            q3_rumiacion,
            q4_activacion_negativa,
            perfil_estres AS perfil_estres_guardado,
            'real' AS source
        FROM stress_assessment
        ORDER BY created_at DESC
    """
    try:
        with get_poi_connection() as conn:
            df = pd.read_sql(query, conn)
        _logger.info("Fetched %d real stress assessments", len(df))
        return df
    except Exception as exc:
        _logger.warning("Could not fetch real assessments: %s", exc)
        return pd.DataFrame(
            columns=FEATURE_COLS + ["id_usuario", "source", "perfil_estres_guardado"]
        )


def build_merged_training_set(
    synthetic_path: Path | None = None,
    real_weight: float = 3.0,
) -> pd.DataFrame:
    """
    Combina CSV sintético con evaluaciones reales.
    real_weight: peso en sample_weight de sklearn (×3 por defecto).
    """
    path = synthetic_path or _SYNTHETIC_CSV
    if not path.exists():
        raise FileNotFoundError(f"Missing synthetic training file: {path}")

    synth = pd.read_csv(path)
    synth["source"] = "synthetic"
    synth["sample_weight"] = 1.0

    real = fetch_real_assessments()
    frames = [synth]

    if len(real) > 0:
        for col in FEATURE_COLS:
            real[col] = pd.to_numeric(real[col], errors="coerce")
        real = real.dropna(subset=FEATURE_COLS)
        if len(real) > 0:
            real["target_perfil_estres"] = real.apply(
                lambda r: rule_based_profile(
                    int(r["q1_energia_cognitiva"]),
                    int(r["q2_tension_fisica"]),
                    int(r["q3_rumiacion"]),
                    int(r["q4_activacion_negativa"]),
                ),
                axis=1,
            )
            real["sample_weight"] = float(real_weight)
            real = real.drop(columns=["perfil_estres_guardado"], errors="ignore")
            frames.append(real)

    merged = pd.concat(frames, ignore_index=True)
    if "id_usuario" in merged.columns:
        merged = merged.drop_duplicates(subset=["id_usuario"], keep="last")

    _MERGED_CSV.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(_MERGED_CSV, index=False)

    n_real = int((merged["source"] == "real").sum()) if "source" in merged.columns else 0
    _logger.info(
        "Merged training set: %d rows (synthetic=%d, real=%d, real_weight=%.1f)",
        len(merged),
        len(merged) - n_real,
        n_real,
        real_weight,
    )
    return merged


def add_engineered_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Features derivadas para capturar interacciones del cuestionario."""
    out = df.copy()
    out["cognitive_load"] = (4 - out["q1_energia_cognitiva"]) + out["q3_rumiacion"]
    out["somatic_stress"] = out["q2_tension_fisica"] + out["q4_activacion_negativa"] * 0.5
    out["hyperarousal"] = out["q4_activacion_negativa"] + out["q3_rumiacion"] * 0.5
    extra = ["cognitive_load", "somatic_stress", "hyperarousal"]
    return out, FEATURE_COLS + extra
