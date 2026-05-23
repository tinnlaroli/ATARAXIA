"""
Evaluación offline del pipeline wellness: clasificador + calidad de recomendaciones.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from stress_classifier import StressProfileClassifier, PROFILE_LABELS_ES
from wellness_catalog import load_csv
from wellness_matchmaker import STRESS_PROFILES, recommend_wellness

_ROOT = Path(__file__).resolve().parent.parent
_REPORT_PATH = _ROOT / "models" / "wellness_eval_report.json"


def evaluate_classifier() -> dict:
    clf = StressProfileClassifier()
    if not clf.load():
        clf.train()
    return clf.metrics


def evaluate_recommendations(sample_per_profile: int = 30) -> dict:
    df = load_csv()
    clf = StressProfileClassifier()
    clf.load()

    cases = {
        "Burnout": (1, 2, 3, 2),
        "Fatiga_Fisica": (1, 4, 2, 2),
        "Hiperactividad_Ansiosa": (2, 2, 3, 3),
    }

    report: dict = {}
    for perfil, (q1, q2, q3, q4) in cases.items():
        pred, proba, conf = clf.predict(q1, q2, q3, q4)
        recs = recommend_wellness(df, pred, q1, q2, q3, q4, top_n=3, stress_confidence=conf)
        avg_benefit = sum(r["beneficio_optimo_pct"] for r in recs) / max(len(recs), 1)
        low_demand = all(r["demanda_fisica"] <= 0.5 for r in recs)
        report[perfil] = {
            "expected_profile": perfil,
            "predicted_profile": pred,
            "confidence": conf,
            "profile_label": PROFILE_LABELS_ES.get(pred, pred),
            "avg_beneficio_optimo_pct": round(avg_benefit, 1),
            "low_physical_demand": low_demand,
            "top_destinations": [r["nombre_lugar"] for r in recs],
        }
    return report


def run_full_eval() -> dict:
    out = {
        "classifier": evaluate_classifier(),
        "recommendation_scenarios": evaluate_recommendations(),
    }
    _REPORT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


if __name__ == "__main__":
    result = run_full_eval()
    print(json.dumps(result, indent=2, ensure_ascii=False))
