export interface WellnessAnswers {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
}

export interface WellnessRecommendation {
    id_destino: string;
    nombre_lugar: string;
    estado: string;
    categoria_principal: string;
    match_pct: number;
    beneficio_optimo_pct?: number;
    alineacion_pct?: number;
    rank?: number;
    beneficio_descripcion?: string;
    nivel_aislamiento: number;
    restauracion_pasiva: number;
    demanda_fisica: number;
    lat?: number | null;
    lon?: number | null;
}

export interface WellnessRecommendationsResponse {
    user_id: string;
    perfil_estres: string;
    perfil_estres_label: string;
    perfil_probabilities: Record<string, number>;
    stress_confidence?: number;
    beneficio_objetivo?: string;
    recommendations: WellnessRecommendation[];
    session_id?: number;
    latency_ms?: number;
}

export interface WellnessFormPreferences {
    interests: string[];
    activity_level: number;
    preferred_place: string;
    has_accessibility: boolean;
    travel_type?: string;
}

export interface GetWellnessRecommendationsParams {
    userId: string;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    top_n?: number;
    token?: string | null;
}

/** @deprecated Legacy tourism form — use WellnessAnswers */
export interface FormContext {
    edad?: number;
    edad_range?: string;
    presupuesto_daily?: number;
    presupuesto_bucket?: string;
    duracion_dias?: number;
    duracion_dias_range?: string;
    tiposTurismo: string[];
    actividad_level: number;
    preferencia_lugar: string;
    pref_outdoor: boolean;
    group_type?: string;
    services: string[];
    needs_hotel: boolean;
    needs_transport: boolean;
    pref_food: boolean;
    wants_tours: boolean;
    accesibilidad: string;
    requiere_accesibilidad?: boolean;
    detalleAcc: string;
    visitado: string;
}

export type RecommendationsResponse = WellnessRecommendationsResponse;

export interface Recommendation {
    item_id: string;
    title: string;
    description?: string;
    category?: string;
    score: number;
    pred_cf: number;
    pred_rf: number;
    kind?: string;
    image_url?: string | null;
    match_pct?: number;
    estado?: string;
}
