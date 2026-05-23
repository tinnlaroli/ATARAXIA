import { useState, useRef, useCallback } from 'react';
import { formApi } from '../api/formApi';
import type { WellnessRecommendationsResponse, GetWellnessRecommendationsParams } from '../types/types';

export function useFormRecommendations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<WellnessRecommendationsResponse | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const cancel = () => {
        abortRef.current?.abort();
        abortRef.current = null;
    };

    const getRecommendations = useCallback(async (params: GetWellnessRecommendationsParams) => {
        cancel();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const json = await formApi.getRecommendationsViaApi(params);
            setData(json);
            return json;
        } catch (err: unknown) {
            const e = err as { name?: string; message?: string; response?: { data?: { message?: string; detail?: string } } };
            if (e?.name === 'AbortError') return null;
            const errorMessage =
                e?.response?.data?.detail ||
                e?.response?.data?.message ||
                e?.message ||
                'Error al obtener recomendaciones';
            setError(String(errorMessage));
            throw new Error(String(errorMessage));
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, error, data, getRecommendations, cancel };
};
