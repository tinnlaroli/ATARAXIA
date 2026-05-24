import axios from 'axios';
import type {
    GetWellnessRecommendationsParams,
    WellnessFormPreferences,
    WellnessRecommendationsResponse,
} from '../types/types';

const REC_API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4100/api/v2';
const MODELO_BASE = import.meta.env.VITE_MODELO_URL ?? 'http://localhost:8100';

export const formApi = {
    /** Recomendación vía API (persiste sesión + stress_assessment) */
    getRecommendationsViaApi: async ({
        userId,
        q1,
        q2,
        q3,
        q4,
        top_n = 3,
        token = null,
    }: GetWellnessRecommendationsParams): Promise<WellnessRecommendationsResponse> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const { data } = await axios.post<WellnessRecommendationsResponse>(
            `${REC_API_BASE}/ml/recommend/${userId}`,
            { q1, q2, q3, q4, top_n },
            { headers },
        );
        return data;
    },

    saveWellnessPreferences: async (
        preferences: WellnessFormPreferences,
        token: string | null | undefined,
    ): Promise<void> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        await axios.post(
            `${REC_API_BASE}/profiles/preferences`,
            {
                interests: preferences.interests,
                activity_level: preferences.activity_level,
                preferred_place: preferences.preferred_place,
                has_accessibility: preferences.has_accessibility,
                travel_type: preferences.travel_type ?? 'solo',
            },
            { headers },
        );
    },

    /** Encuesta post-resultado: ¿Este plan encaja con cómo te sientes? (1–5) */
    submitSessionSatisfaction: async (
        sessionId: number,
        fitRating: number,
        token?: string | null,
    ): Promise<void> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        await axios.post(
            `${REC_API_BASE}/ml/session-satisfaction`,
            { session_id: sessionId, fit_rating: fitRating },
            { headers },
        );
    },

    /** Recomendación directa a MODELO (sin persistir sesión) */
    getRecommendations: async ({
        userId,
        q1,
        q2,
        q3,
        q4,
        top_n = 3,
        token = null,
    }: GetWellnessRecommendationsParams): Promise<WellnessRecommendationsResponse> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const { data } = await axios.post<WellnessRecommendationsResponse>(
            `${MODELO_BASE}/recommend/${userId}`,
            { q1, q2, q3, q4, top_n },
            { headers },
        );
        return data;
    },
};
