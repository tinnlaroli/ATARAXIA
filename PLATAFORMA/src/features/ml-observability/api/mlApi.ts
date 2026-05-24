import { api } from '../../../shared/api/axiosClient';

/** Métricas legacy Yelp/híbrido (solo si existen filas antiguas en BD). */
export interface AlgorithmMetric {
    rmse: number;
    mae: number;
    alpha?: number;
}

export interface MLMetricsLegacy {
    best_algorithm: string;
    best_alpha: number;
    local_blend?: { rf: number; gbm: number };
    algorithms: Record<string, AlgorithmMetric>;
    sample_size?: number;
    ranking?: {
        ndcg: number;
        precision: number;
        hit_rate: number;
    };
}

/** Métricas del clasificador de estrés ATARAXIA (MODELO /train-stress). */
export interface WellnessClassifierMetrics {
    accuracy?: number;
    macro_f1?: number;
    n_train?: number;
    n_test?: number;
    n_real_assessments?: number;
    model_type?: string;
    hybrid_threshold?: number;
    classification_report?: Record<string, { precision?: number; recall?: number; 'f1-score'?: number; support?: number }>;
    class_distribution?: Record<string, number>;
    real_assessments_at_train?: number;
    retrain_reason?: string;
    retrained_at?: string;
}

export type LatestMetrics = WellnessClassifierMetrics | MLMetricsLegacy;

export interface MLRetrainStatus {
    auto_retrain_enabled: boolean;
    real_assessments_total: number;
    real_assessments_at_last_train: number;
    pending_for_retrain: number;
    training_in_flight: boolean;
}

export interface StressProfileRow {
    perfil_estres: string;
    n: number;
}

export interface MLHealth {
    pipeline_mode?: 'wellness' | 'legacy';
    latest_metrics: LatestMetrics | null;
    metrics_saved_at?: string | null;
    wellness_destinations?: number;
    stress_profiles_30d?: StressProfileRow[];
    daily_sessions: {
        total: number;
        avg_latency_ms: string;
        day: string;
    }[];
    ctr_30d: {
        total: number;
        clicked: number;
    };
    satisfaction_30d?: {
        total: number;
        avg_rating: string | number | null;
        positive_count: number;
    };
    retrain?: MLRetrainStatus;
}

export interface ModelStatus {
    mode?: string;
    stress_model_loaded?: boolean;
    destinations_count?: number;
    engine_ready: boolean;
    rf_ready: boolean;
    gbm_ready: boolean;
    svd_ready: boolean;
    lightfm_ready: boolean;
    content_ready: boolean;
    users_count: number;
    retrain?: MLRetrainStatus;
}

export function isWellnessMetrics(m: LatestMetrics | null | undefined): m is WellnessClassifierMetrics {
    return m != null && ('accuracy' in m || 'macro_f1' in m) && !('algorithms' in m);
}

export function isLegacyMetrics(m: LatestMetrics | null | undefined): m is MLMetricsLegacy {
    return m != null && 'algorithms' in m;
}

export const mlApi = {
    getHealth: async (): Promise<MLHealth> => {
        const { data } = await api.get<MLHealth>('/ml/health');
        return data;
    },

    getModelStatus: async (): Promise<ModelStatus> => {
        const { data } = await api.get<ModelStatus>('/ml/model-status');
        return data;
    },

    trainModel: async (): Promise<{ ok: boolean; message: string; metrics?: WellnessClassifierMetrics }> => {
        const { data } = await api.post('/ml/train');
        return data;
    },
};
