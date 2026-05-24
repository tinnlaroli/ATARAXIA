#!/usr/bin/env python3
"""
Genera figuras PDF/PNG para paper científico — evaluación ATARAXIA wellness.

Uso (desde MODELO/):
  python scripts/generate_paper_figures.py
  python scripts/generate_paper_figures.py --retrain
  python scripts/generate_paper_figures.py --quick   # omite curva de aprendizaje (más rápido)

Salida: models/paper_figures/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from paper_evaluation import generate_all_figures  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Figuras para paper — modelo wellness ATARAXIA")
    parser.add_argument(
        "--retrain",
        action="store_true",
        help="Reentrenar clasificador antes de generar figuras",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Omitir curva de aprendizaje (la operación más lenta)",
    )
    args = parser.parse_args()

    out = generate_all_figures(retrain=args.retrain, skip_learning_curve=args.quick)
    print(f"\nFiguras guardadas en: {out}")
    print("Archivos generados:")
    for f in sorted(out.glob("fig*.*")):
        print(f"  - {f.name}")
    if (out / "table_stress_metrics.tex").exists():
        print(f"  - table_stress_metrics.tex")
    if (out / "evaluation_summary.json").exists():
        print(f"  - evaluation_summary.json")


if __name__ == "__main__":
    main()
