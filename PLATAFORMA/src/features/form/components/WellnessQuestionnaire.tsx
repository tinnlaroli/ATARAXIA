import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useFormRecommendations } from '../hooks/useFormRecommendations';
import SmartURLoader from '../../auth/components/SmartURLoader';
import type { WellnessAnswers, WellnessRecommendationsResponse } from '../types/types';
import { useTheme } from '../../../contexts/ThemeContext';

const QUESTIONS = [
    {
        key: 'q1' as const,
        title: 'Energía cognitiva',
        subtitle: '¿Qué tan agotada sientes tu mente al final del día?',
        options: [
            { value: 1, label: 'Muy baja' },
            { value: 2, label: 'Moderada' },
            { value: 3, label: 'Buena' },
        ],
    },
    {
        key: 'q2' as const,
        title: 'Tensión física',
        subtitle: '¿Cuánta tensión o dolor corporal llevas encima?',
        options: [
            { value: 1, label: 'Ninguna' },
            { value: 2, label: 'Leve' },
            { value: 3, label: 'Moderada' },
            { value: 4, label: 'Alta' },
        ],
    },
    {
        key: 'q3' as const,
        title: 'Rumiación',
        subtitle: '¿Con qué frecuencia repites pensamientos estresantes?',
        options: [
            { value: 1, label: 'Casi nunca' },
            { value: 2, label: 'A veces' },
            { value: 3, label: 'Casi siempre' },
        ],
    },
    {
        key: 'q4' as const,
        title: 'Activación negativa',
        subtitle: '¿Qué tan inquieto o alerta te sientes en reposo?',
        options: [
            { value: 1, label: 'Muy calmado' },
            { value: 2, label: 'Algo inquieto' },
            { value: 3, label: 'Muy inquieto' },
        ],
    },
];

interface Props {
    onBack?: () => void;
    onComplete: (result: WellnessRecommendationsResponse) => void;
    userId: string | number;
    token?: string | null;
}

export function WellnessQuestionnaire({ onBack, onComplete, userId, token }: Props) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Partial<WellnessAnswers>>({});
    const { loading, error, getRecommendations } = useFormRecommendations();

    const current = QUESTIONS[step];
    const selected = answers[current.key];

    const setAnswer = (value: number) => {
        setAnswers((prev) => ({ ...prev, [current.key]: value }));
    };

    const canNext = selected !== undefined;

    const handleSubmit = async () => {
        const payload: WellnessAnswers = {
            q1: answers.q1 ?? 2,
            q2: answers.q2 ?? 2,
            q3: answers.q3 ?? 2,
            q4: answers.q4 ?? 2,
        };
        try {
            const result = await getRecommendations({
                userId: String(userId),
                ...payload,
                top_n: 3,
                token,
            });
            onComplete(result);
        } catch {
            /* error shown in UI */
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
                <SmartURLoader />
                <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                    Analizando tu perfil y buscando destinos terapéuticos…
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
                <Sparkles className="size-4" />
                Cuestionario wellness · Paso {step + 1} de {QUESTIONS.length}
            </div>

            <div>
                <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {current.title}
                </h2>
                <p className={`mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{current.subtitle}</p>
            </div>

            <div className="grid gap-3">
                {current.options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAnswer(opt.value)}
                        className={`w-full rounded-2xl border px-5 py-4 text-left transition-all ${
                            selected === opt.value
                                ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                                : isDark
                                  ? 'border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-zinc-600'
                                  : 'border-zinc-200 bg-white text-zinc-800 hover:border-violet-300'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {error && (
                <p className="text-sm text-red-400" role="alert">
                    {error}
                </p>
            )}

            <div className="flex justify-between pt-4">
                <button
                    type="button"
                    onClick={() => (step === 0 ? onBack?.() : setStep((s) => s - 1))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                        isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                    <ArrowLeft className="size-4" />
                    Atrás
                </button>
                {step < QUESTIONS.length - 1 ? (
                    <button
                        type="button"
                        disabled={!canNext}
                        onClick={() => setStep((s) => s + 1)}
                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold disabled:opacity-40"
                    >
                        Siguiente
                        <ArrowRight className="size-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={!canNext}
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold disabled:opacity-40"
                    >
                        Ver mis destinos
                        <ArrowRight className="size-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
