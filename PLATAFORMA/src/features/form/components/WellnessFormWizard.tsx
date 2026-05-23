import { useState } from 'react';
import { ArrowLeft, ArrowRight, Leaf, ShieldCheck } from 'lucide-react';
import { WellnessProgressIndicator } from './WellnessProgressIndicator';
import { useFormRecommendations } from '../hooks/useFormRecommendations';
import SmartURLoader from '../../auth/components/SmartURLoader';
import type { WellnessAnswers, WellnessFormPreferences, WellnessRecommendationsResponse } from '../types/types';
import {
    WELLNESS_INTERESTS,
    ACTIVITY_LEVELS,
    PLACE_PREFERENCES,
    STRESS_QUESTIONS,
    type WellnessWizardStepId,
} from '../wellnessFormConstants';
import { formApi } from '../api/formApi';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
    userId: string | number;
    token?: string | null;
    onClose: () => void;
    onComplete: (result: WellnessRecommendationsResponse) => void;
}

export function WellnessFormWizard({ userId, token, onClose, onComplete }: Props) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { loading, error, getRecommendations } = useFormRecommendations();

    const [step, setStep] = useState<WellnessWizardStepId>('intro');
    const [prefs, setPrefs] = useState<WellnessFormPreferences>({
        interests: ['bienestar'],
        activity_level: 2,
        preferred_place: 'indiferente',
        has_accessibility: false,
        travel_type: 'solo',
    });
    const [answers, setAnswers] = useState<Partial<WellnessAnswers>>({});
    const [savingPrefs, setSavingPrefs] = useState(false);

    const toggleInterest = (value: string) => {
        setPrefs((p) => {
            const has = p.interests.includes(value);
            const next = has ? p.interests.filter((i) => i !== value) : [...p.interests, value];
            return { ...p, interests: next.length ? next : [value] };
        });
    };

    const stressComplete = STRESS_QUESTIONS.every((q) => answers[q.key] !== undefined);

    const goNext = async () => {
        if (step === 'intro') {
            setStep('preferences');
            return;
        }
        if (step === 'preferences') {
            setSavingPrefs(true);
            try {
                await formApi.saveWellnessPreferences(prefs, token);
            } catch {
                /* continuar aunque falle guardado — el matchmaker puede leer perfil previo */
            } finally {
                setSavingPrefs(false);
            }
            setStep('stress');
            return;
        }
        if (step === 'stress' && stressComplete) {
            const payload: WellnessAnswers = {
                q1: answers.q1!,
                q2: answers.q2!,
                q3: answers.q3!,
                q4: answers.q4!,
            };
            const result = await getRecommendations({
                userId: String(userId),
                ...payload,
                top_n: 5,
                token,
            });
            onComplete(result);
        }
    };

    const goBack = () => {
        if (step === 'intro') onClose();
        else if (step === 'preferences') setStep('intro');
        else if (step === 'stress') setStep('preferences');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-20">
                <WellnessProgressIndicator currentStepId="stress" loading />
                <SmartURLoader />
                <div className="max-w-sm text-center space-y-2">
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        Diseñando tu ruta de bienestar
                    </p>
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Clasificamos tu perfil de estrés y cruzamos destinos terapéuticos en México…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <WellnessProgressIndicator currentStepId={step} />

            {step === 'intro' && (
                <section className="space-y-6 animate-in fade-in duration-300">
                    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-transparent to-emerald-600/10 p-6 md:p-8">
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-3">
                            <Leaf className="size-4" />
                            ATARAXIA · Turismo terapéutico
                        </div>
                        <h2 className={`text-2xl md:text-3xl font-semibold leading-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            No buscamos “más lugares”. Buscamos el destino que tu sistema nervioso necesita hoy.
                        </h2>
                        <p className={`mt-4 text-base leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            En tres pasos: cómo prefieres viajar, cómo te sientes ahora y recomendaciones nacionales con
                            beneficio óptimo para tu perfil de estrés.
                        </p>
                    </div>
                    <ul className={`grid gap-3 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        <li className="flex gap-2">
                            <ShieldCheck className="size-4 shrink-0 text-violet-400 mt-0.5" />
                            Tus respuestas entrenan el modelo de forma anónima y mejoran futuras recomendaciones.
                        </li>
                        <li className="flex gap-2">
                            <ShieldCheck className="size-4 shrink-0 text-violet-400 mt-0.5" />
                            Sin diagnóstico clínico: orientación wellness basada en señales de agotamiento y recuperación.
                        </li>
                    </ul>
                </section>
            )}

            {step === 'preferences' && (
                <section className="space-y-8 animate-in fade-in duration-300">
                    <header>
                        <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            Tu estilo de recuperación
                        </h2>
                        <p className={`mt-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            Afinamos destinos según entorno y ritmo — además de tu check-in emocional.
                        </p>
                    </header>

                    <div>
                        <p className={`mb-3 text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            ¿Qué tipo de experiencia te restaura? (elige al menos una)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {WELLNESS_INTERESTS.map((item) => {
                                const selected = prefs.interests.includes(item.value);
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => toggleInterest(item.value)}
                                        className={`rounded-2xl border p-4 text-left transition-all ${
                                            selected
                                                ? 'border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/40'
                                                : isDark
                                                  ? 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
                                                  : 'border-zinc-200 bg-white hover:border-violet-200'
                                        }`}
                                    >
                                        <Icon className={`size-5 mb-2 ${selected ? 'text-violet-400' : 'text-zinc-500'}`} />
                                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{item.label}</p>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{item.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className={`mb-3 text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            Ritmo físico deseado en el viaje
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {ACTIVITY_LEVELS.map((lvl) => (
                                <button
                                    key={lvl.value}
                                    type="button"
                                    onClick={() => setPrefs((p) => ({ ...p, activity_level: lvl.value }))}
                                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                        prefs.activity_level === lvl.value
                                            ? 'bg-violet-600 text-white'
                                            : isDark
                                              ? 'bg-zinc-800 text-zinc-400 hover:text-white'
                                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                    }`}
                                    title={lvl.hint}
                                >
                                    {lvl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className={`mb-3 text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            Entorno preferido
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {PLACE_PREFERENCES.map((place) => {
                                const Icon = place.icon;
                                const selected = prefs.preferred_place === place.value;
                                return (
                                    <button
                                        key={place.value}
                                        type="button"
                                        onClick={() => setPrefs((p) => ({ ...p, preferred_place: place.value }))}
                                        className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 text-sm font-medium ${
                                            selected
                                                ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                                                : isDark
                                                  ? 'border-zinc-700 text-zinc-400'
                                                  : 'border-zinc-200 text-zinc-600'
                                        }`}
                                    >
                                        <Icon className="size-5" />
                                        {place.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <label
                        className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${
                            isDark ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-200 bg-zinc-50'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={prefs.has_accessibility}
                            onChange={(e) => setPrefs((p) => ({ ...p, has_accessibility: e.target.checked }))}
                            className="size-4 rounded border-zinc-600 text-violet-600 focus:ring-violet-500"
                        />
                        <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            Necesito destinos con buena accesibilidad (menos esfuerzo físico intenso)
                        </span>
                    </label>
                </section>
            )}

            {step === 'stress' && (
                <section className="space-y-8 animate-in fade-in duration-300">
                    <header>
                        <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            Check-in emocional
                        </h2>
                        <p className={`mt-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            Responde con honestidad cómo te sientes <strong className="font-medium">esta semana</strong>.
                            Definimos tu perfil de estrés y los destinos con mayor beneficio terapéutico.
                        </p>
                    </header>

                    {STRESS_QUESTIONS.map((q) => {
                        const Icon = q.icon;
                        const selected = answers[q.key];
                        return (
                            <div
                                key={q.key}
                                className={`rounded-2xl border p-5 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/80'}`}
                            >
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="rounded-xl bg-violet-500/15 p-2">
                                        <Icon className="size-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{q.title}</h3>
                                        <p className={`text-sm mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>{q.subtitle}</p>
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {q.options.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt.value }))}
                                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                                selected === opt.value
                                                    ? 'border-violet-500 bg-violet-500/15'
                                                    : isDark
                                                      ? 'border-zinc-700 hover:border-zinc-600'
                                                      : 'border-zinc-200 bg-white hover:border-violet-200'
                                            }`}
                                        >
                                            <span className={`block font-medium text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                                {opt.label}
                                            </span>
                                            <span className={`block text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                                {opt.detail}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </section>
            )}

            {error && (
                <p className="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3" role="alert">
                    {error}
                </p>
            )}

            <div className="flex justify-between pt-2 border-t border-zinc-800/50">
                <button
                    type="button"
                    onClick={goBack}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                        isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                    <ArrowLeft className="size-4" />
                    {step === 'intro' ? 'Salir' : 'Atrás'}
                </button>
                <button
                    type="button"
                    disabled={
                        (step === 'preferences' && prefs.interests.length === 0) ||
                        (step === 'stress' && !stressComplete) ||
                        savingPrefs
                    }
                    onClick={() => void goNext()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                    {step === 'stress' ? 'Obtener mis destinos' : 'Continuar'}
                    <ArrowRight className="size-4" />
                </button>
            </div>
        </div>
    );
}
