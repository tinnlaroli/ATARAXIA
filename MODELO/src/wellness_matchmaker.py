"""
Matchmaking wellness: clasificación de estrés + beneficio óptimo + alineación vectorial.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from benefit_scoring import compute_benefit_scores, profile_benefit_description
from user_preferences import apply_preference_boost

STRESS_PROFILES = ("Burnout", "Fatiga_Fisica", "Hiperactividad_Ansiosa")

PROFILE_FILTERS: dict[str, dict[str, Any]] = {
    "Burnout": {
        "min_restauracion_pasiva": 0.55,
        "max_demanda_fisica": 0.45,
        "boost_categories": {"Retiro_Silencio", "Spa", "Termal"},
    },
    "Fatiga_Fisica": {
        "max_demanda_fisica": 0.38,
        "boost_categories": {"Termal", "Spa", "Lago"},
    },
    "Hiperactividad_Ansiosa": {
        "min_nivel_aislamiento": 0.45,
        "max_demanda_fisica": 0.55,
        "penalize_categories": {"Ecoturismo_Activo"},
        "boost_categories": {"Retiro_Silencio", "Bosque", "Montaña"},
    },
}

PROFILE_IDEAL: dict[str, np.ndarray] = {
    "Burnout": np.array([0.75, 0.90, 0.20]),
    "Fatiga_Fisica": np.array([0.55, 0.85, 0.15]),
    "Hiperactividad_Ansiosa": np.array([0.70, 0.75, 0.35]),
}

# Pesos del score final de recomendación
W_BENEFIT = 0.50
W_ALIGNMENT = 0.35
W_CONFIDENCE = 0.15


def _norm_q(value: int, lo: int, hi: int) -> float:
    if hi <= lo:
        return 0.5
    return float(value - lo) / float(hi - lo)


def build_user_vector(q1: int, q2: int, q3: int, q4: int, perfil: str) -> np.ndarray:
    base = PROFILE_IDEAL.get(perfil, PROFILE_IDEAL["Burnout"]).copy()
    q_signal = np.array([
        1.0 - _norm_q(q1, 1, 3),
        _norm_q(q3, 1, 3),
        1.0 - _norm_q(q2, 1, 4),
    ])
    blended = 0.60 * base + 0.40 * q_signal
    blended[2] = max(0.0, min(1.0, 1.0 - _norm_q(q2, 1, 4)))
    return blended


def _apply_filters(df: pd.DataFrame, perfil: str) -> pd.DataFrame:
    rules = PROFILE_FILTERS.get(perfil, {})
    out = df.copy()

    if "min_restauracion_pasiva" in rules:
        out = out[out["restauracion_pasiva"] >= rules["min_restauracion_pasiva"]]
    if "max_demanda_fisica" in rules:
        out = out[out["demanda_fisica"] <= rules["max_demanda_fisica"]]
    if "min_nivel_aislamiento" in rules:
        out = out[out["nivel_aislamiento"] >= rules["min_nivel_aislamiento"]]

    penalize = rules.get("penalize_categories") or set()
    if penalize:
        out = out[~out["categoria_principal"].isin(penalize)]

    if len(out) < 3:
        out = df.copy()
    return out.reset_index(drop=True)


def _dest_matrix(df: pd.DataFrame) -> np.ndarray:
    return df[["nivel_aislamiento", "restauracion_pasiva", "demanda_fisica"]].astype(float).values


def _diversify_top(
    df: pd.DataFrame,
    order: np.ndarray,
    top_n: int,
    max_per_category: int = 1,
) -> list[int]:
    """Evita repetir la misma categoría en el top (salvo si no hay alternativas)."""
    picked: list[int] = []
    cat_count: dict[str, int] = {}
    for idx in order:
        if len(picked) >= top_n:
            break
        cat = str(df.iloc[int(idx)]["categoria_principal"])
        if cat_count.get(cat, 0) >= max_per_category:
            continue
        picked.append(int(idx))
        cat_count[cat] = cat_count.get(cat, 0) + 1
    if len(picked) < top_n:
        for idx in order:
            if int(idx) not in picked:
                picked.append(int(idx))
            if len(picked) >= top_n:
                break
    return picked


def recommend_wellness(
    destinations: pd.DataFrame,
    perfil: str,
    q1: int,
    q2: int,
    q3: int,
    q4: int,
    top_n: int = 3,
    similarity: str = "cosine",
    stress_confidence: float | None = None,
    user_preferences: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if destinations.empty:
        return []

    filtered = _apply_filters(destinations, perfil)
    user_vec = build_user_vector(q1, q2, q3, q4, perfil).reshape(1, -1)
    dest_mat = _dest_matrix(filtered)

    if similarity == "pearson":
        user_c = user_vec - user_vec.mean()
        dest_c = dest_mat - dest_mat.mean(axis=1, keepdims=True)
        denom = np.linalg.norm(user_c) * np.linalg.norm(dest_c, axis=1)
        denom = np.where(denom == 0, 1e-9, denom)
        alignment = (dest_c @ user_c.T).ravel() / denom
    else:
        alignment = cosine_similarity(dest_mat, user_vec).ravel()

    alignment = np.clip(alignment, 0.0, 1.0)
    benefit = compute_benefit_scores(filtered, perfil)
    conf = float(stress_confidence) if stress_confidence is not None else 1.0

    final = W_BENEFIT * benefit + W_ALIGNMENT * alignment + W_CONFIDENCE * conf * 0.1
    final = apply_preference_boost(final, filtered, user_preferences, perfil)
    final = np.clip(final, 0.0, 1.0)

    if final.max() > 0:
        match_pct = (final / final.max()) * 100.0
        beneficio_pct = benefit * 100.0
    else:
        match_pct = np.zeros_like(final)
        beneficio_pct = np.zeros_like(final)

    order = np.argsort(-final)
    top_indices = _diversify_top(filtered, order, top_n)

    beneficio_desc = profile_benefit_description(perfil)
    results = []
    for rank, idx in enumerate(top_indices, start=1):
        row = filtered.iloc[int(idx)]
        results.append({
            "id_destino": str(row["id_destino"]),
            "nombre_lugar": str(row["nombre_lugar"]),
            "estado": str(row.get("estado") or ""),
            "categoria_principal": str(row["categoria_principal"]),
            "match_pct": round(float(match_pct[idx]), 1),
            "beneficio_optimo_pct": round(float(beneficio_pct[idx]), 1),
            "alineacion_pct": round(float(alignment[idx]) * 100.0, 1),
            "rank": rank,
            "nivel_aislamiento": float(row["nivel_aislamiento"]),
            "restauracion_pasiva": float(row["restauracion_pasiva"]),
            "demanda_fisica": float(row["demanda_fisica"]),
            "lat": float(row["lat"]) if pd.notna(row.get("lat")) else None,
            "lon": float(row["lon"]) if pd.notna(row.get("lon")) else None,
            "beneficio_descripcion": beneficio_desc,
        })
    return results
