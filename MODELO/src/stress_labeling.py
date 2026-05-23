"""
Etiquetado heurístico Q1–Q4 → perfil de estrés (reglas de dominio).
Usado en entrenamiento (evita circularidad con predicciones guardadas en BD)
y como respaldo cuando el ML tiene baja confianza.
"""
from __future__ import annotations

STRESS_PROFILES = ("Burnout", "Fatiga_Fisica", "Hiperactividad_Ansiosa")


def profile_scores(q1: int, q2: int, q3: int, q4: int) -> dict[str, float]:
    return {
        "Burnout": ((4 - q1) + q3 + q4) / 9.0,
        "Fatiga_Fisica": (q2 + (4 - q1) * 0.5) / 7.0 if q2 >= 3 else (q2 / 7.0) * 0.6,
        "Hiperactividad_Ansiosa": ((q4 + q3) * 0.5 + (4 - q2) * 0.3) / 6.0,
    }


def rule_based_profile(q1: int, q2: int, q3: int, q4: int) -> str:
    # Rumiación + activación elevadas sin tensión física dominante → hiperactividad ansiosa
    if q3 >= 3 and q4 >= 3 and q2 <= 3 and q1 >= 2:
        return "Hiperactividad_Ansiosa"
    # Tensión física alta con energía cognitiva baja → fatiga física
    if q2 >= 4 and q1 <= 2:
        return "Fatiga_Fisica"
    # Agotamiento cognitivo marcado
    if q1 == 1 and q3 >= 2 and q4 >= 2:
        return "Burnout"

    scores = profile_scores(q1, q2, q3, q4)
    return max(scores, key=scores.get)


def rule_confidence(q1: int, q2: int, q3: int, q4: int) -> float:
    """Separación entre el mejor y segundo perfil heurístico (0–1 aprox.)."""
    scores = sorted(profile_scores(q1, q2, q3, q4).values(), reverse=True)
    if len(scores) < 2:
        return 1.0
    gap = scores[0] - scores[1]
    return float(min(1.0, max(0.35, 0.35 + gap * 2.0)))
