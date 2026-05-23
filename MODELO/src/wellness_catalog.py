"""
Catálogo wellness: CSV versionado + sync PostgreSQL + lectura en runtime.
"""
from __future__ import annotations

import argparse
import csv
import logging
import os
from pathlib import Path
from typing import Any

import pandas as pd

from poi_repository import get_poi_connection

_logger = logging.getLogger("ataraxia-wellness")

_SRC = Path(__file__).resolve().parent
_ROOT = _SRC.parent
_CSV_PATH = _ROOT / "data" / "wellness" / "destinos_wellness.csv"

REQUIRED_COLS = [
    "id_destino",
    "nombre_lugar",
    "estado",
    "nivel_aislamiento",
    "restauracion_pasiva",
    "demanda_fisica",
    "categoria_principal",
]

NUMERIC_COLS = ["nivel_aislamiento", "restauracion_pasiva", "demanda_fisica"]


def load_csv(path: Path | None = None) -> pd.DataFrame:
    p = path or _CSV_PATH
    if not p.exists():
        raise FileNotFoundError(f"Catalog CSV not found: {p}")
    df = pd.read_csv(p)
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in CSV: {missing}")

    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].isna().any():
            raise ValueError(f"Null values in {col}")
        if ((df[col] < 0) | (df[col] > 1)).any():
            raise ValueError(f"Values out of [0,1] in {col}")

    df["lat"] = pd.to_numeric(df.get("lat"), errors="coerce")
    df["lon"] = pd.to_numeric(df.get("lon"), errors="coerce")
    df["fuente"] = df.get("fuente", "manual").fillna("manual")
    return df


def sync_to_postgres(df: pd.DataFrame | None = None) -> int:
    data = df if df is not None else load_csv()
    sql = """
        INSERT INTO wellness_destination (
            id_destino, nombre_lugar, estado,
            nivel_aislamiento, restauracion_pasiva, demanda_fisica,
            categoria_principal, latitude, longitude, fuente, is_active, updated_at
        ) VALUES (
            %(id_destino)s, %(nombre_lugar)s, %(estado)s,
            %(nivel_aislamiento)s, %(restauracion_pasiva)s, %(demanda_fisica)s,
            %(categoria_principal)s, %(latitude)s, %(longitude)s, %(fuente)s, TRUE, NOW()
        )
        ON CONFLICT (id_destino) DO UPDATE SET
            nombre_lugar = EXCLUDED.nombre_lugar,
            estado = EXCLUDED.estado,
            nivel_aislamiento = EXCLUDED.nivel_aislamiento,
            restauracion_pasiva = EXCLUDED.restauracion_pasiva,
            demanda_fisica = EXCLUDED.demanda_fisica,
            categoria_principal = EXCLUDED.categoria_principal,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            fuente = EXCLUDED.fuente,
            is_active = TRUE,
            updated_at = NOW()
    """
    count = 0
    with get_poi_connection() as conn:
        with conn.cursor() as cur:
            for _, row in data.iterrows():
                lat = row["lat"] if pd.notna(row.get("lat")) else None
                lon = row["lon"] if pd.notna(row.get("lon")) else None
                cur.execute(
                    sql,
                    {
                        "id_destino": str(row["id_destino"]),
                        "nombre_lugar": str(row["nombre_lugar"]),
                        "estado": str(row.get("estado") or ""),
                        "nivel_aislamiento": float(row["nivel_aislamiento"]),
                        "restauracion_pasiva": float(row["restauracion_pasiva"]),
                        "demanda_fisica": float(row["demanda_fisica"]),
                        "categoria_principal": str(row["categoria_principal"]),
                        "latitude": lat,
                        "longitude": lon,
                        "fuente": str(row.get("fuente") or "manual"),
                    },
                )
                count += 1
        conn.commit()
    _logger.info("Synced %d wellness destinations to PostgreSQL", count)
    return count


def fetch_active_destinations() -> pd.DataFrame:
    try:
        with get_poi_connection() as conn:
            df = pd.read_sql(
                """
                SELECT id_destino, nombre_lugar, estado,
                       nivel_aislamiento, restauracion_pasiva, demanda_fisica,
                       categoria_principal, latitude AS lat, longitude AS lon, fuente
                FROM wellness_destination
                WHERE is_active = TRUE
                """,
                conn,
            )
        if len(df) > 0:
            for col in NUMERIC_COLS:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
    except Exception as exc:
        _logger.warning("Postgres wellness catalog unavailable: %s", exc)

    return load_csv()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sync", action="store_true")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)

    df = load_csv()
    print(f"Loaded {len(df)} destinations from CSV")

    if args.validate:
        print("Validation OK")
        return

    if args.sync or os.getenv("WELLNESS_SYNC_DB", "1") == "1":
        if args.sync:
            n = sync_to_postgres(df)
            print(f"Synced {n} rows")


if __name__ == "__main__":
    main()
