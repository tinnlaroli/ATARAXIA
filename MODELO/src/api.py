"""
ATARAXIA Wellness Recommender API
Clasificación de perfil de estrés (RF) + matchmaking destinos wellness.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from stress_classifier import StressProfileClassifier, PROFILE_LABELS_ES, _META_PATH
from wellness_catalog import load_csv, sync_to_postgres, fetch_active_destinations
from poi_repository import fetch_traveler_wellness_preferences
from benefit_scoring import profile_benefit_description
from wellness_matchmaker import recommend_wellness

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ataraxia-wellness")

stress_classifier: StressProfileClassifier | None = None
destinations_count: int = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    global stress_classifier, destinations_count
    if os.getenv("SKIP_MODEL_BOOT") == "1":
        logger.warning("SKIP_MODEL_BOOT=1: skipping wellness boot")
        yield
        return

    try:
        csv_path = Path(__file__).resolve().parent.parent / "data" / "wellness" / "destinos_wellness.csv"
        if not csv_path.exists():
            scripts = Path(__file__).resolve().parent.parent / "scripts"
            subprocess.run(["python", str(scripts / "build_destinos_seed.py")], check=False)
            subprocess.run(["python", str(scripts / "generate_synthetic_users.py")], check=False)

        if os.getenv("WELLNESS_SYNC_DB", "1") == "1":
            try:
                sync_to_postgres(load_csv())
            except Exception as sync_err:
                logger.warning("Wellness DB sync skipped: %s", sync_err)

        stress_classifier = StressProfileClassifier()
        if not stress_classifier.load():
            train_csv = Path(__file__).resolve().parent.parent / "data" / "wellness" / "entrenamiento_usuarios.csv"
            if not train_csv.exists():
                subprocess.run(
                    ["python", str(Path(__file__).resolve().parent.parent / "scripts" / "generate_synthetic_users.py")],
                    check=False,
                )
            metrics = stress_classifier.train(use_merged=True)
            logger.info("Stress classifier trained: %s", metrics)

        df = fetch_active_destinations()
        destinations_count = len(df)
        logger.info("ATARAXIA wellness ready: %d destinations, classifier loaded", destinations_count)
    except Exception as e:
        logger.error("Wellness boot failed: %s", e)
        raise RuntimeError(f"Boot abortado: {e}") from e
    yield


app = FastAPI(title="ATARAXIA Wellness API", version="3.0", lifespan=lifespan)

_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:4100").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class UserPreferencesPayload(BaseModel):
    interests: Optional[List[str]] = None
    activity_level: Optional[int] = Field(None, ge=1, le=5)
    preferred_place: Optional[str] = None
    has_accessibility: Optional[bool] = None


class WellnessRecommendRequest(BaseModel):
    q1: int = Field(..., ge=1, le=3, description="Energía cognitiva")
    q2: int = Field(..., ge=1, le=4, description="Tensión física")
    q3: int = Field(..., ge=1, le=3, description="Rumiación")
    q4: int = Field(..., ge=1, le=3, description="Activación negativa")
    top_n: int = Field(3, ge=1, le=20)
    similarity: str = Field("cosine", pattern="^(cosine|pearson)$")
    preferences: Optional[UserPreferencesPayload] = None


class WellnessRecItem(BaseModel):
    id_destino: str
    nombre_lugar: str
    estado: str
    categoria_principal: str
    match_pct: float
    beneficio_optimo_pct: float = 0.0
    alineacion_pct: float = 0.0
    rank: int = 1
    beneficio_descripcion: str = ""
    nivel_aislamiento: float
    restauracion_pasiva: float
    demanda_fisica: float
    lat: Optional[float] = None
    lon: Optional[float] = None


class WellnessRecommendationResponse(BaseModel):
    user_id: str
    perfil_estres: str
    perfil_estres_label: str
    perfil_probabilities: dict[str, float]
    stress_confidence: float
    beneficio_objetivo: str
    recommendations: List[WellnessRecItem]


# Legacy alias for clients sending old shape
class RecommendRequest(BaseModel):
    alpha: float = 0.0
    top_n: int = 3
    context: Optional[dict[str, Any]] = None


def _context_to_questions(ctx: dict[str, Any]) -> tuple[int, int, int, int]:
    q1 = int(ctx.get("q1") or ctx.get("Q1_EnergiaCognitiva") or ctx.get("q1_energia_cognitiva") or 2)
    q2 = int(ctx.get("q2") or ctx.get("Q2_TensionFisica") or ctx.get("q2_tension_fisica") or 2)
    q3 = int(ctx.get("q3") or ctx.get("Q3_Rumiacion") or ctx.get("q3_rumiacion") or 2)
    q4 = int(ctx.get("q4") or ctx.get("Q4_ActivacionNegativa") or ctx.get("q4_activacion_negativa") or 2)
    return (
        max(1, min(3, q1)),
        max(1, min(4, q2)),
        max(1, min(3, q3)),
        max(1, min(3, q4)),
    )


def _resolve_preferences(
    user_id: str,
    payload_prefs: UserPreferencesPayload | None,
) -> dict | None:
    if payload_prefs is not None:
        return payload_prefs.model_dump(exclude_none=True)
    return fetch_traveler_wellness_preferences(user_id)


def _wellness_recommend(
    user_id: str,
    q1: int,
    q2: int,
    q3: int,
    q4: int,
    top_n: int,
    similarity: str,
    preferences: dict | None = None,
):
    if stress_classifier is None:
        raise HTTPException(status_code=503, detail="Clasificador no cargado")
    perfil, proba, confidence = stress_classifier.predict(q1, q2, q3, q4)
    df = fetch_active_destinations()
    prefs = preferences or fetch_traveler_wellness_preferences(user_id)
    recs = recommend_wellness(
        df, perfil, q1, q2, q3, q4,
        top_n=top_n,
        similarity=similarity,
        stress_confidence=confidence,
        user_preferences=prefs,
    )
    return WellnessRecommendationResponse(
        user_id=user_id,
        perfil_estres=perfil,
        perfil_estres_label=PROFILE_LABELS_ES.get(perfil, perfil),
        perfil_probabilities=proba,
        stress_confidence=round(confidence, 3),
        beneficio_objetivo=profile_benefit_description(perfil),
        recommendations=[WellnessRecItem(**r) for r in recs],
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "wellness",
        "stress_model_loaded": stress_classifier is not None and stress_classifier.model is not None,
        "destinations_count": destinations_count,
        "skip_model_boot": os.getenv("SKIP_MODEL_BOOT") == "1",
    }


@app.get("/health/poi-db")
def health_poi_db():
    from poi_repository import get_poi_connection
    try:
        with get_poi_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM wellness_destination WHERE is_active = TRUE")
                n = cur.fetchone()[0]
        return {"status": "ok", "wellness_destinations": n}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {e}") from e


@app.post("/recommend/{user_id}", response_model=WellnessRecommendationResponse)
def post_recommendation(user_id: str, payload: WellnessRecommendRequest):
    try:
        prefs = _resolve_preferences(user_id, payload.preferences)
        return _wellness_recommend(
            user_id, payload.q1, payload.q2, payload.q3, payload.q4,
            payload.top_n, payload.similarity, prefs,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Recommend error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/recommend/{user_id}/legacy")
def post_recommendation_legacy(user_id: str, payload: RecommendRequest):
    """Compatibilidad: context con q1-q4."""
    ctx = payload.context or {}
    q1, q2, q3, q4 = _context_to_questions(ctx)
    return _wellness_recommend(user_id, q1, q2, q3, q4, payload.top_n or 3, "cosine")


@app.get("/recommend/{user_id}", response_model=WellnessRecommendationResponse)
def get_recommendation(
    user_id: str,
    q1: int = 2,
    q2: int = 2,
    q3: int = 2,
    q4: int = 2,
    top_n: int = 3,
):
    return _wellness_recommend(user_id, q1, q2, q3, q4, top_n, "cosine")


@app.get("/metrics")
def get_metrics():
    if stress_classifier is None or not _META_PATH.exists():
        raise HTTPException(status_code=404, detail="Métricas no disponibles. Entrena el clasificador.")
    return json.loads(_META_PATH.read_text(encoding="utf-8"))


@app.post("/train-stress")
def train_stress():
    clf = StressProfileClassifier()
    metrics = clf.train(use_merged=True, real_weight=3.0)
    global stress_classifier
    stress_classifier = clf
    return {"status": "ok", "metrics": metrics}


@app.get("/evaluate")
def evaluate_pipeline():
    from evaluate_wellness import run_full_eval
    return run_full_eval()


@app.post("/sync-catalog")
def sync_catalog():
    n = sync_to_postgres()
    global destinations_count
    destinations_count = n
    return {"status": "ok", "synced": n}
