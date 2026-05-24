import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import db from '../config/db.js';
import {
    scheduleStressModelRetrain,
    runStressModelRetrain,
    getRetrainStatus,
} from '../utils/mlRetrain.js';

const router = express.Router();

const MODELO_URL = process.env.MODELO_URL || 'http://modelo:8000';

const safeQuery = async (sql, fallback) => {
    try {
        return await db.query(sql);
    } catch (err) {
        console.warn('[ml/health] query fallback:', err.message);
        return { rows: fallback };
    }
};

async function fetchTravelerPreferences(userId) {
    try {
        const { rows } = await db.query(
            `SELECT interests, activity_level, preferred_place, has_accessibility
             FROM traveler_profile
             WHERE user_id = $1 AND is_active = TRUE
             LIMIT 1`,
            [userId],
        );
        if (!rows.length) return null;
        const r = rows[0];
        return {
            interests: r.interests ?? [],
            activity_level: r.activity_level ?? 3,
            preferred_place: r.preferred_place ?? 'indiferente',
            has_accessibility: Boolean(r.has_accessibility),
        };
    } catch (err) {
        console.warn('[ml/recommend] preferences fetch:', err.message);
        return null;
    }
}

/**
 * GET /api/v2/ml/health — KPIs wellness (accuracy, F1, sesiones, CTR)
 */
router.get('/ml/health', verifyToken, async (req, res) => {
    try {
        const [metricsRes, sessionsRes, feedbackRes, destRes, satisfactionRes, retrainStatus, profilesRes] =
            await Promise.all([
            safeQuery(
                `SELECT metrics_json, created_at FROM ml_model_metrics ORDER BY created_at DESC LIMIT 1`,
                [],
            ),
            safeQuery(
                `SELECT COUNT(*)::int AS total,
                        AVG(execution_time_ms)::numeric(10,2) AS avg_latency_ms,
                        DATE_TRUNC('day', created_at)::date AS day
                 FROM ml_recommendation_session
                 WHERE created_at > NOW() - INTERVAL '30 days'
                 GROUP BY DATE_TRUNC('day', created_at)
                 ORDER BY day DESC`,
                [],
            ),
            safeQuery(
                `SELECT COUNT(*)::int AS total,
                        SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::int AS clicked
                 FROM ml_recommendation_feedback
                 WHERE created_at > NOW() - INTERVAL '30 days'`,
                [{ total: 0, clicked: 0 }],
            ),
            safeQuery(
                `SELECT COUNT(*)::int AS n FROM wellness_destination WHERE is_active = TRUE`,
                [{ n: 0 }],
            ),
            safeQuery(
                `SELECT
                    COUNT(*)::int AS total,
                    ROUND(AVG(fit_rating)::numeric, 2) AS avg_rating,
                    COUNT(*) FILTER (WHERE fit_rating >= 4)::int AS positive_count
                 FROM ml_session_satisfaction
                 WHERE created_at > NOW() - INTERVAL '30 days'`,
                [{ total: 0, avg_rating: null, positive_count: 0 }],
            ),
            getRetrainStatus(),
            safeQuery(
                `SELECT perfil_estres, COUNT(*)::int AS n
                 FROM stress_assessment
                 WHERE created_at > NOW() - INTERVAL '30 days'
                 GROUP BY perfil_estres
                 ORDER BY n DESC`,
                [],
            ),
        ]);

        let modeloMetrics = null;
        try {
            const r = await fetch(`${MODELO_URL}/metrics`, { signal: AbortSignal.timeout(5_000) });
            if (r.ok) modeloMetrics = await r.json();
        } catch {
            /* optional */
        }

        const latestMetrics = modeloMetrics ?? metricsRes.rows[0]?.metrics_json ?? null;
        const metricsCreatedAt = metricsRes.rows[0]?.created_at ?? null;

        res.json({
            latest_metrics: latestMetrics,
            metrics_saved_at: metricsCreatedAt,
            daily_sessions: sessionsRes.rows,
            ctr_30d: feedbackRes.rows[0] ?? { total: 0, clicked: 0 },
            wellness_destinations: destRes.rows[0]?.n ?? 0,
            satisfaction_30d: satisfactionRes.rows[0] ?? {
                total: 0,
                avg_rating: null,
                positive_count: 0,
            },
            stress_profiles_30d: profilesRes.rows ?? [],
            retrain: retrainStatus,
            pipeline_mode: 'wellness',
        });
    } catch (err) {
        console.error('[ml/health] fatal:', err.message);
        res.status(500).json({ message: 'Error al obtener estado del modelo ML.' });
    }
});

/**
 * GET /api/v2/ml/model-status — estado del clasificador wellness
 */
router.get('/ml/model-status', verifyToken, async (req, res) => {
    try {
        const r = await fetch(`${MODELO_URL}/health`, { signal: AbortSignal.timeout(5_000) });
        const data = await r.json().catch(() => ({}));
        const retrain = await getRetrainStatus();
        res.json({
            mode: data.mode ?? 'wellness',
            stress_model_loaded: Boolean(data.stress_model_loaded),
            destinations_count: data.destinations_count ?? 0,
            engine_ready: Boolean(data.stress_model_loaded),
            rf_ready: Boolean(data.stress_model_loaded),
            gbm_ready: Boolean(data.stress_model_loaded),
            svd_ready: false,
            lightfm_ready: false,
            content_ready: false,
            users_count: retrain.real_assessments_total,
            retrain,
        });
    } catch {
        res.json({
            mode: 'wellness',
            stress_model_loaded: false,
            destinations_count: 0,
            engine_ready: false,
            rf_ready: false,
            gbm_ready: false,
            svd_ready: false,
            lightfm_ready: false,
            content_ready: false,
            users_count: 0,
        });
    }
});

/**
 * GET /api/v2/ml/retrain-status
 */
router.get('/ml/retrain-status', verifyToken, async (req, res) => {
    try {
        res.json(await getRetrainStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * POST /api/v2/ml/train — reentrena clasificador de estrés
 */
router.post('/ml/train', verifyToken, async (req, res) => {
    try {
        const metrics = await runStressModelRetrain('manual');
        if (!metrics) {
            return res.status(502).json({ message: 'Entrenamiento falló o ya en curso.' });
        }
        res.json({ ok: true, message: 'Clasificador de estrés reentrenado.', metrics });
    } catch (err) {
        console.error('[ml/train] error:', err.message);
        res.status(502).json({ message: 'No se pudo iniciar el entrenamiento.', detail: err.message });
    }
});

/**
 * POST /api/v2/ml/recommend/:userId
 * Body: { q1, q2, q3, q4, top_n?, similarity? }
 */
router.post('/ml/recommend/:userId', verifyToken, async (req, res) => {
    const { userId } = req.params;
    const authUserId = String(req.user?.id ?? '');
    const { q1, q2, q3, q4, top_n = 3, similarity = 'cosine' } = req.body ?? {};
    const start = Date.now();

    if (authUserId && authUserId !== String(userId)) {
        return res.status(403).json({ message: 'No puedes solicitar recomendaciones para otro usuario.' });
    }

    if ([q1, q2, q3, q4].some((v) => v === undefined || v === null)) {
        return res.status(400).json({ message: 'q1, q2, q3 y q4 son requeridos.' });
    }

    try {
        const preferences = await fetchTravelerPreferences(userId);

        const modeloRes = await fetch(`${MODELO_URL}/recommend/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q1: +q1,
                q2: +q2,
                q3: +q3,
                q4: +q4,
                top_n: +top_n,
                similarity,
                preferences,
            }),
            signal: AbortSignal.timeout(15_000),
        });

        if (!modeloRes.ok) {
            const detail = await modeloRes.text().catch(() => '');
            return res.status(502).json({ message: 'Modelo no disponible.', detail });
        }

        const data = await modeloRes.json();
        const latencyMs = Date.now() - start;

        const { rows } = await db.query(
            `INSERT INTO ml_recommendation_session
               (user_id, alpha, best_algorithm, execution_time_ms, context_json)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                userId,
                0,
                data.perfil_estres ?? 'wellness',
                latencyMs,
                JSON.stringify({ ...data, preferences_used: preferences }),
            ],
        );

        let assessmentSaved = false;
        try {
            await db.query(
                `INSERT INTO stress_assessment
                   (user_id, q1_energia_cognitiva, q2_tension_fisica, q3_rumiacion, q4_activacion_negativa, perfil_estres)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [userId, q1, q2, q3, q4, data.perfil_estres],
            );
            assessmentSaved = true;
            scheduleStressModelRetrain('assessment');
        } catch (assessErr) {
            console.warn('[ml/recommend] stress_assessment insert:', assessErr.message);
        }

        res.json({
            ...data,
            session_id: rows[0].id,
            latency_ms: latencyMs,
            assessment_saved: assessmentSaved,
            preferences_applied: Boolean(preferences),
        });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            return res.status(504).json({ message: 'El servicio de recomendaciones tardó demasiado.' });
        }
        console.error('[ml/recommend] proxy error:', err.message);
        res.status(502).json({ message: 'Servicio ML no disponible.', detail: err.message });
    }
});

/**
 * POST /api/v2/ml/session-satisfaction
 * Body: { session_id, fit_rating } — fit_rating 1–5
 * Pregunta: ¿Este plan encaja con cómo te sientes ahora?
 */
router.post('/ml/session-satisfaction', verifyToken, async (req, res) => {
    const { session_id, fit_rating } = req.body ?? {};
    const authUserId = String(req.user?.id ?? '');

    const sid = parseInt(session_id, 10);
    const rating = parseInt(fit_rating, 10);

    if (!sid || Number.isNaN(sid)) {
        return res.status(400).json({ message: 'session_id es requerido.' });
    }
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'fit_rating debe ser un entero entre 1 y 5.' });
    }

    try {
        const { rows: sessions } = await db.query(
            `SELECT id, user_id FROM ml_recommendation_session WHERE id = $1`,
            [sid],
        );
        if (!sessions.length) {
            return res.status(404).json({ message: 'Sesión de recomendación no encontrada.' });
        }

        const sessionUserId = String(sessions[0].user_id);
        if (authUserId && authUserId !== sessionUserId) {
            return res.status(403).json({ message: 'No puedes valorar la sesión de otro usuario.' });
        }

        const { rows } = await db.query(
            `INSERT INTO ml_session_satisfaction (session_id, user_id, fit_rating)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id) DO UPDATE
               SET fit_rating = EXCLUDED.fit_rating,
                   user_id = EXCLUDED.user_id,
                   created_at = NOW()
             RETURNING id, session_id, fit_rating, created_at`,
            [sid, sessionUserId, rating],
        );

        res.status(201).json({
            ok: true,
            message: 'Gracias por tu valoración.',
            satisfaction: rows[0],
        });
    } catch (err) {
        if (err.code === '42P01') {
            return res.status(503).json({
                message: 'Tabla ml_session_satisfaction no existe. Aplica migración 002.',
            });
        }
        console.error('[ml/session-satisfaction] error:', err.message);
        res.status(500).json({ message: 'Error al guardar la valoración.' });
    }
});

router.post('/ml/feedback', verifyToken, async (req, res) => {
    const { session_id, item_id, rank_pos, clicked = false } = req.body ?? {};
    if (!session_id || !item_id || rank_pos == null) {
        return res.status(400).json({ message: 'session_id, item_id y rank_pos son requeridos.' });
    }
    try {
        await db.query(
            `INSERT INTO ml_recommendation_feedback (session_id, item_id, rank_pos, clicked, clicked_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [session_id, item_id, parseInt(rank_pos, 10), Boolean(clicked), clicked ? new Date() : null],
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[ml/feedback] error:', err.message);
        res.status(500).json({ message: 'Error al registrar feedback.' });
    }
});

export default router;
