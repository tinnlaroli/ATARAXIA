import React from 'react';
import { MapPin, Percent, RefreshCw, X, Sparkles } from 'lucide-react';
import type { WellnessRecommendationsResponse } from '../types/types';
import { PROFILE_HINTS } from '../wellnessFormConstants';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
    data: WellnessRecommendationsResponse;
    onClose: () => void;
    onRetake?: () => void;
}

const PROFILE_COLORS: Record<string, string> = {
    Burnout: 'from-violet-600/30 to-indigo-900/20',
    Fatiga_Fisica: 'from-emerald-600/25 to-teal-900/15',
    Hiperactividad_Ansiosa: 'from-amber-600/20 to-orange-900/15',
};

export function WellnessRecommendationsResult({ data, onClose, onRetake }: Props) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const hint = PROFILE_HINTS[data.perfil_estres] ?? data.beneficio_objetivo;
    const gradient = PROFILE_COLORS[data.perfil_estres] ?? PROFILE_COLORS.Burnout;

    const probs = Object.entries(data.perfil_probabilities ?? {}).sort((a, b) => b[1] - a[1]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <Sparkles className="size-4" />
                    Tu plan de recuperación
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className={`p-2 rounded-full ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100'}`}
                    aria-label="Cerrar"
                >
                    <X className="size-5" />
                </button>
            </div>

            <div className={`rounded-2xl border border-violet-500/20 bg-gradient-to-br ${gradient} p-6`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Perfil de estrés detectado</p>
                <h2 className={`text-2xl md:text-3xl font-semibold mt-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {data.perfil_estres_label}
                </h2>
                {data.stress_confidence != null && (
                    <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                        Confianza del modelo: {(data.stress_confidence * 100).toFixed(0)}%
                    </p>
                )}
                <p className={`mt-4 text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{hint}</p>
                {data.beneficio_objetivo && (
                    <p className={`mt-2 text-sm font-medium ${isDark ? 'text-emerald-400/90' : 'text-emerald-700'}`}>
                        Objetivo terapéutico: {data.beneficio_objetivo}
                    </p>
                )}
            </div>

            {probs.length > 0 && (
                <div className={`rounded-xl border p-4 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
                    <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        Distribución del modelo
                    </p>
                    <div className="space-y-2">
                        {probs.map(([key, val]) => (
                            <div key={key} className="flex items-center gap-3">
                                <span className={`w-28 shrink-0 text-xs truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    {key.replace(/_/g, ' ')}
                                </span>
                                <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <div
                                        className="h-full bg-violet-500 rounded-full transition-all"
                                        style={{ width: `${Math.round(val * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs tabular-nums w-10 text-right text-zinc-500">
                                    {(val * 100).toFixed(0)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    Destinos recomendados para ti
                </h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                    Ordenados por beneficio terapéutico y ajuste a tus preferencias de viaje.
                </p>
                <div className="space-y-4">
                    {data.recommendations.map((rec) => (
                        <article
                            key={rec.id_destino}
                            className={`rounded-2xl border p-5 transition-shadow hover:shadow-lg ${
                                isDark ? 'border-zinc-700/80 bg-zinc-900/60 hover:border-violet-500/30' : 'border-zinc-200 bg-white'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className="text-xs font-bold text-violet-400">#{rec.rank ?? '—'}</span>
                                    <h4 className={`text-lg font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                        {rec.nombre_lugar}
                                    </h4>
                                    <p className={`flex items-center gap-1 text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                        <MapPin className="size-3.5 shrink-0" />
                                        {rec.estado} · {rec.categoria_principal.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div
                                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-white"
                                        style={{ background: 'var(--color-purple, #7c3aed)' }}
                                    >
                                        <Percent className="size-3.5" />
                                        {rec.match_pct}%
                                    </div>
                                    {rec.beneficio_optimo_pct != null && (
                                        <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                            Beneficio {rec.beneficio_optimo_pct}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={`mt-4 grid grid-cols-3 gap-2 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                <div>
                                    <span className="block opacity-70">Aislamiento</span>
                                    <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                        {(rec.nivel_aislamiento * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div>
                                    <span className="block opacity-70">Restauración</span>
                                    <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                        {(rec.restauracion_pasiva * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div>
                                    <span className="block opacity-70">Esfuerzo</span>
                                    <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                        {(rec.demanda_fisica * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
                {onRetake && (
                    <button
                        type="button"
                        onClick={onRetake}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border ${
                            isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-700'
                        }`}
                    >
                        <RefreshCw className="size-4" />
                        Repetir check-in
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500"
                >
                    Finalizar
                </button>
            </div>
        </div>
    );
}
