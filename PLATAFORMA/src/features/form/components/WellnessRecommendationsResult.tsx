import React, { useState } from 'react';
import { MapPin, Percent, RefreshCw, X, Sparkles, MessageCircleHeart } from 'lucide-react';
import type { WellnessRecommendationsResponse } from '../types/types';
import { PROFILE_HINTS } from '../wellnessFormConstants';
import { formApi } from '../api/formApi';

interface Props {
    data: WellnessRecommendationsResponse;
    onClose: () => void;
    onRetake?: () => void;
    token?: string | null;
}

const FIT_LABELS: Record<number, string> = {
    1: 'Para nada',
    2: 'Poco',
    3: 'Algo',
    4: 'Bastante',
    5: 'Mucho, encaja muy bien',
};

const PROFILE_GRADIENT: Record<string, string> = {
    Burnout: 'linear-gradient(135deg, rgba(var(--rgb-primary), 0.35) 0%, rgba(var(--rgb-surface), 0.9) 100%)',
    Fatiga_Fisica: 'linear-gradient(135deg, rgba(var(--rgb-primary-deep), 0.3) 0%, rgba(var(--rgb-surface), 0.85) 100%)',
    Hiperactividad_Ansiosa: 'linear-gradient(135deg, rgba(var(--rgb-earth), 0.28) 0%, rgba(var(--rgb-surface), 0.9) 100%)',
};

export function WellnessRecommendationsResult({ data, onClose, onRetake, token }: Props) {
    const hint = PROFILE_HINTS[data.perfil_estres] ?? data.beneficio_objetivo;
    const gradient = PROFILE_GRADIENT[data.perfil_estres] ?? PROFILE_GRADIENT.Burnout;
    const probs = Object.entries(data.perfil_probabilities ?? {}).sort((a, b) => b[1] - a[1]);

    const [fitRating, setFitRating] = useState<number | null>(null);
    const [savingRating, setSavingRating] = useState(false);
    const [ratingSaved, setRatingSaved] = useState(false);
    const [ratingError, setRatingError] = useState<string | null>(null);

    const hasSession = data.session_id != null;

    const submitRating = async (rating: number) => {
        if (!hasSession || !data.session_id) return;
        setSavingRating(true);
        setRatingError(null);
        try {
            await formApi.submitSessionSatisfaction(data.session_id, rating, token);
            setFitRating(rating);
            setRatingSaved(true);
        } catch {
            setRatingError('No pudimos guardar tu valoración. Inténtalo de nuevo.');
        } finally {
            setSavingRating(false);
        }
    };

    const handleSelectRating = (rating: number) => {
        setFitRating(rating);
        void submitRating(rating);
    };

    const handleFinish = () => {
        if (hasSession && !ratingSaved && fitRating == null) {
            setRatingError('Ayúdanos con una valoración rápida (1–5) o pulsa Omitir.');
            return;
        }
        onClose();
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-medium wellness-accent-text">
                    <Sparkles className="size-4" />
                    Tu plan de recuperación
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full wellness-muted hover:opacity-80 transition-opacity"
                    aria-label="Cerrar"
                >
                    <X className="size-5" />
                </button>
            </div>

            <div
                className="rounded-2xl border p-6"
                style={{ background: gradient, borderColor: 'var(--color-border)' }}
            >
                <p className="text-xs font-semibold uppercase tracking-wider wellness-accent-text">
                    Perfil de estrés detectado
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>
                    {data.perfil_estres_label}
                </h2>
                {data.stress_confidence != null && (
                    <p className="text-xs mt-2 wellness-muted">
                        Confianza del modelo: {(data.stress_confidence * 100).toFixed(0)}%
                    </p>
                )}
                <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{hint}</p>
                {data.beneficio_objetivo && (
                    <p className="mt-2 text-sm font-medium" style={{ color: 'var(--color-earth)' }}>
                        Objetivo terapéutico: {data.beneficio_objetivo}
                    </p>
                )}
            </div>

            {probs.length > 0 && (
                <div className="rounded-xl border p-4 wellness-card-solid">
                    <p className="text-xs font-semibold mb-3 wellness-muted">Distribución del modelo</p>
                    <div className="space-y-2">
                        {probs.map(([key, val]) => (
                            <div key={key} className="flex items-center gap-3">
                                <span className="w-28 shrink-0 text-xs truncate wellness-muted">
                                    {key.replace(/_/g, ' ')}
                                </span>
                                <div
                                    className="flex-1 h-2 rounded-full overflow-hidden"
                                    style={{ background: 'rgba(var(--rgb-forest), 0.1)' }}
                                >
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.round(val * 100)}%`,
                                            background: 'var(--color-primary-deep)',
                                        }}
                                    />
                                </div>
                                <span className="text-xs tabular-nums w-10 text-right wellness-muted">
                                    {(val * 100).toFixed(0)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    Destinos recomendados para ti
                </h3>
                <p className="text-sm mb-4 wellness-muted">
                    Ordenados por beneficio terapéutico y ajuste a tus preferencias de viaje.
                </p>
                <div className="space-y-4">
                    {data.recommendations.map((rec) => (
                        <article
                            key={rec.id_destino}
                            className="rounded-2xl border p-5 transition-shadow hover:shadow-md wellness-card-solid"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className="text-xs font-bold wellness-accent-text">#{rec.rank ?? '—'}</span>
                                    <h4 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--color-text)' }}>
                                        {rec.nombre_lugar}
                                    </h4>
                                    <p className="flex items-center gap-1 text-sm mt-1 wellness-muted">
                                        <MapPin className="size-3.5 shrink-0" />
                                        {rec.estado} · {rec.categoria_principal.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div
                                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold"
                                        style={{
                                            background: 'var(--color-primary-deep)',
                                            color: 'var(--color-text-on-vivid)',
                                        }}
                                    >
                                        <Percent className="size-3.5" />
                                        {rec.match_pct}%
                                    </div>
                                    {rec.beneficio_optimo_pct != null && (
                                        <span className="text-xs font-semibold" style={{ color: 'var(--color-earth)' }}>
                                            Beneficio {rec.beneficio_optimo_pct}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-xs wellness-muted">
                                <div>
                                    <span className="block opacity-70">Aislamiento</span>
                                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                        {(rec.nivel_aislamiento * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div>
                                    <span className="block opacity-70">Restauración</span>
                                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                        {(rec.restauracion_pasiva * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div>
                                    <span className="block opacity-70">Esfuerzo</span>
                                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                        {(rec.demanda_fisica * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>

            {hasSession && (
                <section className="rounded-2xl border p-5 wellness-card-solid space-y-4">
                    <div className="flex items-start gap-2">
                        <MessageCircleHeart className="size-5 shrink-0 wellness-accent-text mt-0.5" />
                        <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                                ¿Este plan encaja con cómo te sientes ahora?
                            </p>
                            <p className="text-xs mt-1 wellness-muted">
                                Tu respuesta mejora las recomendaciones (sesión #{data.session_id}).
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                disabled={savingRating}
                                onClick={() => handleSelectRating(n)}
                                className={`flex flex-col items-center min-w-[3.5rem] rounded-xl border px-2 py-2 text-center transition-all ${
                                    fitRating === n ? 'wellness-chip-active' : 'wellness-card-solid'
                                }`}
                                title={FIT_LABELS[n]}
                            >
                                <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                                    {n}
                                </span>
                                <span className="text-[10px] leading-tight wellness-muted max-w-[4.5rem]">
                                    {FIT_LABELS[n]}
                                </span>
                            </button>
                        ))}
                    </div>
                    {ratingSaved && (
                        <p className="text-xs font-medium" style={{ color: 'var(--color-primary-deep)' }}>
                            Gracias — valoración guardada.
                        </p>
                    )}
                    {ratingError && (
                        <p className="text-xs wellness-alert-error rounded-lg px-3 py-2" role="alert">
                            {ratingError}
                        </p>
                    )}
                </section>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
                {onRetake && (
                    <button
                        type="button"
                        onClick={onRetake}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border wellness-card-solid"
                        style={{ color: 'var(--color-text)' }}
                    >
                        <RefreshCw className="size-4" />
                        Repetir check-in
                    </button>
                )}
                {hasSession && !ratingSaved && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm wellness-muted hover:opacity-80"
                    >
                        Omitir
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleFinish}
                    disabled={savingRating}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold wellness-btn-primary disabled:opacity-50"
                >
                    Finalizar
                </button>
            </div>
        </div>
    );
}
