"""
Clasificador de perfil de estrés: HistGradientBoosting calibrado + respaldo heurístico.
Entrena con dataset fusionado (sintético + stress_assessment real, peso ×3 en reales).
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split

from stress_labeling import profile_scores, rule_based_profile, rule_confidence

_logger = logging.getLogger("ataraxia-wellness")

_SRC = Path(__file__).resolve().parent
_ROOT = _SRC.parent
_DATA = _ROOT / "data" / "wellness"
_MODELS = _ROOT / "models"
_MODEL_PATH = _MODELS / "stress_profile_rf.joblib"
_META_PATH = _MODELS / "stress_profile_rf.meta.json"
_TRAIN_CSV = _DATA / "entrenamiento_usuarios.csv"

BASE_FEATURE_COLS = [
    "q1_energia_cognitiva",
    "q2_tension_fisica",
    "q3_rumiacion",
    "q4_activacion_negativa",
]
TARGET_COL = "target_perfil_estres"

# Por debajo de este umbral se prioriza la regla heurística (veracidad clínica)
HYBRID_CONFIDENCE_THRESHOLD = 0.58

PROFILE_LABELS_ES = {
    "Burnout": "Burnout (agotamiento cognitivo)",
    "Fatiga_Fisica": "Fatiga física",
    "Hiperactividad_Ansiosa": "Hiperactividad ansiosa",
}


class StressProfileClassifier:
    def __init__(self) -> None:
        self.model: CalibratedClassifierCV | None = None
        self.classes_: list[str] = []
        self.feature_cols: list[str] = BASE_FEATURE_COLS.copy()
        self.metrics: dict[str, Any] = {}

    def _prepare_df(self, df: pd.DataFrame) -> pd.DataFrame:
        from training_data import add_engineered_features

        out = df.copy()
        for col in BASE_FEATURE_COLS:
            out[col] = pd.to_numeric(out[col], errors="coerce")
        out = out.dropna(subset=BASE_FEATURE_COLS + [TARGET_COL])
        out, self.feature_cols = add_engineered_features(out)
        return out

    def train(
        self,
        csv_path: Path | None = None,
        test_size: float = 0.2,
        use_merged: bool = True,
        real_weight: float = 3.0,
    ) -> dict[str, Any]:
        if use_merged:
            from training_data import build_merged_training_set

            df = build_merged_training_set(csv_path or _TRAIN_CSV, real_weight=real_weight)
        else:
            path = csv_path or _TRAIN_CSV
            if not path.exists():
                raise FileNotFoundError(f"Training CSV not found: {path}")
            df = pd.read_csv(path)
            df["sample_weight"] = 1.0

        df = self._prepare_df(df)
        X = df[self.feature_cols].astype(float).values
        y = df[TARGET_COL].astype(str).values
        sw = df["sample_weight"].astype(float).values if "sample_weight" in df.columns else None

        n_real = int((df.get("source") == "real").sum()) if "source" in df.columns else 0

        X_train, X_test, y_train, y_test, sw_train, sw_test = train_test_split(
            X,
            y,
            sw if sw is not None else np.ones(len(y)),
            test_size=test_size,
            random_state=42,
            stratify=y,
        )

        base = HistGradientBoostingClassifier(
            max_depth=10,
            learning_rate=0.08,
            max_iter=250,
            min_samples_leaf=8,
            l2_regularization=0.5,
            random_state=42,
        )
        clf = CalibratedClassifierCV(base, method="sigmoid", cv=3, ensemble=True)
        clf.fit(X_train, y_train, sample_weight=sw_train)
        y_pred = clf.predict(X_test)

        acc = float(accuracy_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred, average="macro"))
        report = classification_report(y_test, y_pred, output_dict=True)

        self.model = clf
        self.classes_ = list(clf.classes_)
        self.metrics = {
            "accuracy": acc,
            "macro_f1": f1,
            "classification_report": report,
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "n_real_assessments": n_real,
            "n_features": len(self.feature_cols),
            "feature_cols": self.feature_cols,
            "model_type": "HistGradientBoosting+CalibratedClassifierCV",
            "hybrid_threshold": HYBRID_CONFIDENCE_THRESHOLD,
            "class_distribution": {
                str(k): int(v) for k, v in pd.Series(y).value_counts().items()
            },
        }

        _MODELS.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"model": clf, "feature_cols": self.feature_cols},
            _MODEL_PATH,
        )
        _META_PATH.write_text(json.dumps(self.metrics, indent=2), encoding="utf-8")
        _logger.info("Stress classifier saved: accuracy=%.3f macro_f1=%.3f real=%d", acc, f1, n_real)
        return self.metrics

    def load(self) -> bool:
        if not _MODEL_PATH.exists():
            return False
        payload = joblib.load(_MODEL_PATH)
        self.model = payload["model"]
        self.feature_cols = payload.get("feature_cols", BASE_FEATURE_COLS)
        self.classes_ = list(self.model.classes_)
        if _META_PATH.exists():
            self.metrics = json.loads(_META_PATH.read_text(encoding="utf-8"))
        return True

    def _feature_row(self, q1: int, q2: int, q3: int, q4: int) -> np.ndarray:
        row = {
            "q1_energia_cognitiva": q1,
            "q2_tension_fisica": q2,
            "q3_rumiacion": q3,
            "q4_activacion_negativa": q4,
        }
        df = pd.DataFrame([row])
        from training_data import add_engineered_features

        df, cols = add_engineered_features(df)
        return df[cols].astype(float).values

    def _hybrid_predict(
        self,
        q1: int,
        q2: int,
        q3: int,
        q4: int,
        ml_pred: str,
        proba_map: dict[str, float],
        ml_conf: float,
    ) -> tuple[str, dict[str, float], float, str]:
        rule = rule_based_profile(q1, q2, q3, q4)
        rule_conf = rule_confidence(q1, q2, q3, q4)
        scores = profile_scores(q1, q2, q3, q4)
        rule_score = scores[rule]
        ml_score = scores.get(ml_pred, 0.0)
        method = "ml"

        if ml_conf < HYBRID_CONFIDENCE_THRESHOLD or (rule_score - ml_score) >= 0.12:
            method = "rule_hybrid"
            pred = rule
            proba_map = {c: 0.08 for c in self.classes_}
            proba_map[rule] = max(0.55, rule_conf)
            remaining = 1.0 - proba_map[rule]
            others = [c for c in self.classes_ if c != rule]
            if others:
                share = remaining / len(others)
                for c in others:
                    proba_map[c] = share
            confidence = float(proba_map[rule])
        else:
            pred = ml_pred
            confidence = ml_conf
            if pred != rule and (rule_score - ml_score) >= 0.18:
                method = "rule_override"
                pred = rule
                confidence = max(confidence, rule_conf)

        return pred, proba_map, confidence, method

    def predict(self, q1: int, q2: int, q3: int, q4: int) -> tuple[str, dict[str, float], float]:
        if self.model is None and not self.load():
            rule = rule_based_profile(q1, q2, q3, q4)
            return rule, {rule: 1.0}, rule_confidence(q1, q2, q3, q4)

        X = self._feature_row(q1, q2, q3, q4)
        ml_pred = str(self.model.predict(X)[0])
        probs = self.model.predict_proba(X)[0]
        proba_map = {str(c): float(p) for c, p in zip(self.model.classes_, probs)}
        ml_conf = float(max(proba_map.values()))

        pred, proba_map, confidence, _method = self._hybrid_predict(
            q1, q2, q3, q4, ml_pred, proba_map, ml_conf
        )
        return pred, proba_map, confidence


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--no-merge", action="store_true", help="Solo CSV sintético")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    clf = StressProfileClassifier()
    if args.train:
        metrics = clf.train(use_merged=not args.no_merge)
        print(json.dumps(metrics, indent=2))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
