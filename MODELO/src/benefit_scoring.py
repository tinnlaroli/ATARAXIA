"""
Modelo de beneficio óptimo: puntúa destinos según alineación terapéutica con el perfil de estrés.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

_ROOT = Path(__file__).resolve().parent.parent
_BENEFIT_YAML = _ROOT / "data" / "wellness" / "benefit_profiles.yaml"

DIM_COLS = ["nivel_aislamiento", "restauracion_pasiva", "demanda_fisica"]


@lru_cache(maxsize=1)
def load_benefit_profiles() -> dict[str, Any]:
    with _BENEFIT_YAML.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def compute_benefit_scores(
    destinations: pd.DataFrame,
    perfil: str,
) -> np.ndarray:
    """
    Score 0-1 por destino: qué tan óptimo es para mitigar el perfil de estrés.
    """
    profiles = load_benefit_profiles()
    cfg = profiles.get(perfil) or profiles.get("Burnout", {})
    weights = cfg.get("weights") or {}
    cat_bonus = cfg.get("category_bonus") or {}
    cat_penalty = cfg.get("category_penalty") or {}

    scores = np.zeros(len(destinations), dtype=float)
    for idx, row in enumerate(destinations.itertuples(index=False)):
        row_d = row._asdict() if hasattr(row, "_asdict") else dict(zip(destinations.columns, row))
        s = 0.0
        for dim, w in weights.items():
            if dim not in row_d:
                continue
            val = float(row_d[dim])
            w = float(w)
            if dim == "demanda_fisica" and w < 0:
                s += abs(w) * (1.0 - val)
            else:
                s += w * val
        cat = str(row_d.get("categoria_principal", ""))
        s += float(cat_bonus.get(cat, 0.0))
        s += float(cat_penalty.get(cat, 0.0))
        scores[idx] = s

    lo, hi = float(scores.min()), float(scores.max())
    if hi > lo:
        scores = (scores - lo) / (hi - lo)
    else:
        scores = np.full_like(scores, 0.5)
    return scores


def profile_benefit_description(perfil: str) -> str:
    profiles = load_benefit_profiles()
    cfg = profiles.get(perfil) or {}
    return str(cfg.get("description", ""))
