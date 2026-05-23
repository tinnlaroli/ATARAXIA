"""Tests del pipeline wellness ATARAXIA."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from wellness_catalog import load_csv, REQUIRED_COLS
from wellness_matchmaker import recommend_wellness, STRESS_PROFILES
from stress_classifier import StressProfileClassifier
from training_data import FEATURE_COLS


@pytest.fixture
def catalog_df():
    return load_csv()


def test_catalog_has_minimum_rows(catalog_df):
    assert len(catalog_df) >= 100


def test_catalog_numeric_ranges(catalog_df):
    for col in ("nivel_aislamiento", "restauracion_pasiva", "demanda_fisica"):
        assert catalog_df[col].between(0, 1).all()


def test_synthetic_training_file_exists():
    path = Path(__file__).resolve().parents[1] / "data" / "wellness" / "entrenamiento_usuarios.csv"
    assert path.exists()
    df = pd.read_csv(path)
    assert len(df) >= 4000
    assert set(FEATURE_COLS + ["target_perfil_estres"]).issubset(df.columns)


def test_classifier_train_and_predict():
    clf = StressProfileClassifier()
    metrics = clf.train()
    assert metrics["accuracy"] >= 0.40
    assert metrics["macro_f1"] >= 0.38
    perfil, proba, conf = clf.predict(1, 4, 2, 2)
    assert perfil in STRESS_PROFILES
    assert abs(sum(proba.values()) - 1.0) < 0.01
    assert 0 < conf <= 1.0


def test_matchmaker_returns_top3(catalog_df):
    recs = recommend_wellness(
        catalog_df, "Fatiga_Fisica", 1, 4, 2, 2, top_n=3, stress_confidence=0.9,
    )
    assert len(recs) == 3
    assert all(0 <= r["match_pct"] <= 100 for r in recs)
    assert all(r["demanda_fisica"] <= 0.5 for r in recs)
    assert all("beneficio_optimo_pct" in r for r in recs)
    categories = {r["categoria_principal"] for r in recs}
    assert len(categories) >= 2


def test_rule_labeling_consistency():
    from stress_labeling import rule_based_profile

    assert rule_based_profile(1, 4, 2, 2) == "Fatiga_Fisica"
    assert rule_based_profile(1, 2, 3, 2) == "Burnout"
    assert rule_based_profile(2, 2, 3, 3) == "Hiperactividad_Ansiosa"


def test_benefit_scoring_range(catalog_df):
    from benefit_scoring import compute_benefit_scores
    scores = compute_benefit_scores(catalog_df, "Burnout")
    assert len(scores) == len(catalog_df)
    assert scores.min() >= 0 and scores.max() <= 1.0
