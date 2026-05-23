#!/usr/bin/env python3
"""Genera entrenamiento_usuarios.csv balanceado por perfil (5k usuarios)."""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from stress_labeling import rule_based_profile  # noqa: E402

RULES_PATH = ROOT / "data" / "wellness" / "labeling_rules.yaml"
OUT_PATH = ROOT / "data" / "wellness" / "entrenamiento_usuarios.csv"
N_USERS = 5000
RNG = random.Random(42)

PROFILES = ["Burnout", "Fatiga_Fisica", "Hiperactividad_Ansiosa"]

# Distribuciones de respuestas condicionadas al perfil (más realistas)
PROFILE_Q_BIAS = {
    "Burnout": {
        "q1": {1: 0.45, 2: 0.40, 3: 0.15},
        "q2": {1: 0.25, 2: 0.35, 3: 0.30, 4: 0.10},
        "q3": {1: 0.10, 2: 0.35, 3: 0.55},
        "q4": {1: 0.20, 2: 0.45, 3: 0.35},
    },
    "Fatiga_Fisica": {
        "q1": {1: 0.35, 2: 0.45, 3: 0.20},
        "q2": {1: 0.05, 2: 0.15, 3: 0.45, 4: 0.35},
        "q3": {1: 0.30, 2: 0.45, 3: 0.25},
        "q4": {1: 0.35, 2: 0.40, 3: 0.25},
    },
    "Hiperactividad_Ansiosa": {
        "q1": {1: 0.25, 2: 0.50, 3: 0.25},
        "q2": {1: 0.35, 2: 0.40, 3: 0.20, 4: 0.05},
        "q3": {1: 0.15, 2: 0.35, 3: 0.50},
        "q4": {1: 0.10, 2: 0.35, 3: 0.55},
    },
}


def _sample_q(dist: dict[int, float]) -> int:
    keys = sorted(dist.keys())
    weights = [dist[k] for k in keys]
    return RNG.choices(keys, weights=weights, k=1)[0]


def main() -> None:
    with RULES_PATH.open(encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    noise_rate = float(rules.get("noise_rate", 0.08))
    per_profile = N_USERS // len(PROFILES)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    uid = 1

    for target_profile in PROFILES:
        bias = PROFILE_Q_BIAS[target_profile]
        for _ in range(per_profile):
            q1 = _sample_q(bias["q1"])
            q2 = _sample_q(bias["q2"])
            q3 = _sample_q(bias["q3"])
            q4 = _sample_q(bias["q4"])
            label = rule_based_profile(q1, q2, q3, q4)
            if RNG.random() < noise_rate:
                label = RNG.choice([p for p in PROFILES if p != label])
            else:
                label = target_profile if RNG.random() < 0.92 else label

            rows.append({
                "id_usuario": f"U-{uid:04d}",
                "q1_energia_cognitiva": q1,
                "q2_tension_fisica": q2,
                "q3_rumiacion": q3,
                "q4_activacion_negativa": q4,
                "target_perfil_estres": label,
            })
            uid += 1

    while len(rows) < N_USERS:
        p = RNG.choice(PROFILES)
        bias = PROFILE_Q_BIAS[p]
        rows.append({
            "id_usuario": f"U-{uid:04d}",
            "q1_energia_cognitiva": _sample_q(bias["q1"]),
            "q2_tension_fisica": _sample_q(bias["q2"]),
            "q3_rumiacion": _sample_q(bias["q3"]),
            "q4_activacion_negativa": _sample_q(bias["q4"]),
            "target_perfil_estres": p,
        })
        uid += 1

    header = list(rows[0].keys())
    with OUT_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)

    from collections import Counter
    dist = Counter(r["target_perfil_estres"] for r in rows)
    print(f"Wrote {len(rows)} users to {OUT_PATH}")
    print("Class distribution:", dict(dist))


if __name__ == "__main__":
    main()
