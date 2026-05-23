/**
 * Reentrenamiento automático del clasificador wellness tras nuevas evaluaciones.
 * Debounce en memoria: varias evaluaciones seguidas → un solo train-stress.
 */
import db from '../config/db.js';

const MODELO_URL = process.env.MODELO_URL || 'http://modelo:8000';
const AUTO_RETRAIN = process.env.ML_AUTO_RETRAIN !== '0';
const DEBOUNCE_MS = parseInt(process.env.ML_RETRAIN_DEBOUNCE_MS || '45000', 10);
const TRAIN_TIMEOUT_MS = parseInt(process.env.ML_RETRAIN_TIMEOUT_MS || '120000', 10);

let debounceTimer = null;
let trainingInFlight = false;

async function fetchRealAssessmentCount() {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM stress_assessment`);
    return rows[0]?.n ?? 0;
}

async function fetchLastTrainedRealCount() {
    const { rows } = await db.query(
        `SELECT metrics_json FROM ml_model_metrics ORDER BY created_at DESC LIMIT 1`,
    );
    const json = rows[0]?.metrics_json;
    if (!json) return 0;
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    return parsed?.real_assessments_at_train ?? 0;
}

/**
 * Programa reentrenamiento (no bloquea la petición HTTP del usuario).
 */
export function scheduleStressModelRetrain(reason = 'assessment') {
    if (!AUTO_RETRAIN) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runStressModelRetrain(reason).catch((err) => {
            console.warn('[ml/retrain] background train failed:', err.message);
        });
    }, DEBOUNCE_MS);
}

export async function runStressModelRetrain(reason = 'manual') {
    if (trainingInFlight) {
        console.info('[ml/retrain] train already in flight, skipping');
        return null;
    }

    trainingInFlight = true;
    const realCount = await fetchRealAssessmentCount();

    try {
        const modeloRes = await fetch(`${MODELO_URL}/train-stress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(TRAIN_TIMEOUT_MS),
        });
        const data = await modeloRes.json().catch(() => ({}));

        if (!modeloRes.ok) {
            throw new Error(data.detail || data.message || `HTTP ${modeloRes.status}`);
        }

        const metrics = {
            ...(data.metrics ?? data),
            real_assessments_at_train: realCount,
            retrain_reason: reason,
            retrained_at: new Date().toISOString(),
        };

        await db.query(`INSERT INTO ml_model_metrics (metrics_json) VALUES ($1::jsonb)`, [
            JSON.stringify(metrics),
        ]);

        console.info(
            '[ml/retrain] OK accuracy=%s real_count=%d reason=%s',
            metrics.accuracy,
            realCount,
            reason,
        );
        return metrics;
    } finally {
        trainingInFlight = false;
    }
}

export async function getRetrainStatus() {
    const [realCount, lastTrainedCount] = await Promise.all([
        fetchRealAssessmentCount(),
        fetchLastTrainedRealCount(),
    ]);
    return {
        auto_retrain_enabled: AUTO_RETRAIN,
        real_assessments_total: realCount,
        real_assessments_at_last_train: lastTrainedCount,
        pending_for_retrain: Math.max(0, realCount - lastTrainedCount),
        training_in_flight: trainingInFlight,
    };
}
