#!/usr/bin/env python3
"""
Inserta evaluaciones de ejemplo en stress_assessment (desarrollo / demo).
Uso: docker exec ataraxia-modelo python /app/scripts/seed_stress_assessments.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from poi_repository import get_poi_connection
from stress_labeling import rule_based_profile

SAMPLES = [
    (2, 1, 1, 1, 2),
    (1, 4, 2, 2, 2),
    (1, 3, 3, 2, 2),
    (2, 2, 3, 3, 2),
    (3, 2, 2, 2, 2),
    (1, 4, 3, 3, 2),
    (2, 3, 2, 2, 2),
    (1, 2, 2, 1, 2),
]


def main() -> None:
    with get_poi_connection() as conn:
        with conn.cursor() as cur:
            for q1, q2, q3, q4, user_id in SAMPLES:
                perfil = rule_based_profile(q1, q2, q3, q4)
                cur.execute(
                    """
                    INSERT INTO stress_assessment
                      (user_id, q1_energia_cognitiva, q2_tension_fisica,
                       q3_rumiacion, q4_activacion_negativa, perfil_estres)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (user_id, q1, q2, q3, q4, perfil),
                )
        conn.commit()
    print(f"Inserted {len(SAMPLES)} demo stress_assessment rows for user_id=2")


if __name__ == "__main__":
    main()
