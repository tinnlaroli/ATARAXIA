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

interface Props {
    userId: string | number;
    token?: string | null;
    onClose: () => void;
    onComplete: (result: WellnessRecommendationsResponse) => void;
}

export function WellnessFormWizard({ userId, token, onClose, onComplete }: Props) {
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
                    <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                        Diseñando tu ruta de bienestar
                    </p>
                    <p className="text-sm wellness-muted">
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
                    <div
                        className="wellness-card p-6 md:p-8"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(var(--rgb-primary), 0.25) 0%, rgba(var(--rgb-surface), 0.9) 60%, rgba(var(--rgb-earth), 0.12) 100%)',
                        }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold mb-3 wellness-accent-text">
                            <Leaf className="size-4" />
                            ATARAXIA · Turismo terapéutico
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
                            No buscamos “más lugares”. Buscamos el destino que tu sistema nervioso necesita hoy.
                        </h2>
                        <p className="mt-4 text-base leading-relaxed wellness-muted">
                            En tres pasos: cómo prefieres viajar, cómo te sientes ahora y recomendaciones nacionales con
                            beneficio óptimo para tu perfil de estrés.
                        </p>
                    </div>
                    <ul className="grid gap-3 text-sm wellness-muted">
                        <li className="flex gap-2">
                            <ShieldCheck className="size-4 shrink-0 wellness-accent-text mt-0.5" />
                            Tus respuestas entrenan el modelo de forma anónima y mejoran futuras recomendaciones.
                        </li>
                        <li className="flex gap-2">
                            <ShieldCheck className="size-4 shrink-0 wellness-accent-text mt-0.5" />
                            Sin diagnóstico clínico: orientación wellness basada en señales de agotamiento y recuperación.
                        </li>
                    </ul>
                </section>
            )}

            {step === 'preferences' && (
                <section className="space-y-8 animate-in fade-in duration-300">
                    <header>
                        <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
                            Tu estilo de recuperación
                        </h2>
                        <p className="mt-2 text-sm wellness-muted">
                            Afinamos destinos según entorno y ritmo — además de tu check-in emocional.
                        </p>
                    </header>

                    <div>
                        <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
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
                                        className={`rounded-2xl border p-4 text-left transition-all wellness-card-solid ${selected ? 'wellness-chip-active' : ''}`}
                                    >
                                        <Icon className={`size-5 mb-2 ${selected ? 'wellness-accent-text' : 'wellness-muted'}`} />
                                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{item.label}</p>
                                        <p className="text-xs mt-1 wellness-muted">{item.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            Ritmo físico deseado en el viaje
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {ACTIVITY_LEVELS.map((lvl) => (
                                <button
                                    key={lvl.value}
                                    type="button"
                                    onClick={() => setPrefs((p) => ({ ...p, activity_level: lvl.value }))}
                                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                        prefs.activity_level === lvl.value ? 'wellness-btn-primary' : 'wellness-card-solid wellness-muted'
                                    }`}
                                    title={lvl.hint}
                                >
                                    {lvl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
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
                                        className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 text-sm font-medium wellness-card-solid ${
                                            selected ? 'wellness-chip-active' : 'wellness-muted'
                                        }`}
                                    >
                                        <Icon className="size-5" />
                                        {place.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer wellness-card-solid">
                        <input
                            type="checkbox"
                            checked={prefs.has_accessibility}
                            onChange={(e) => setPrefs((p) => ({ ...p, has_accessibility: e.target.checked }))}
                            className="size-4 rounded"
                            style={{ accentColor: 'var(--color-primary-deep)' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                            Necesito destinos con buena accesibilidad (menos esfuerzo físico intenso)
                        </span>
                    </label>
                </section>
            )}

            {step === 'stress' && (
                <section className="space-y-8 animate-in fade-in duration-300">
                    <header>
                        <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
                            Check-in emocional
                        </h2>
                        <p className="mt-2 text-sm wellness-muted">
                            Responde con honestidad cómo te sientes <strong className="font-medium">esta semana</strong>.
                            Definimos tu perfil de estrés y los destinos con mayor beneficio terapéutico.
                        </p>
                    </header>

                    {STRESS_QUESTIONS.map((q) => {
                        const Icon = q.icon;
                        const selected = answers[q.key];
                        return (
                            <div key={q.key} className="rounded-2xl border p-5 wellness-card-solid">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="rounded-xl p-2" style={{ background: 'rgba(var(--rgb-primary), 0.25)' }}>
                                        <Icon className="size-5 wellness-accent-text" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{q.title}</h3>
                                        <p className="text-sm mt-0.5 wellness-muted">{q.subtitle}</p>
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {q.options.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt.value }))}
                                            className={`rounded-xl border px-4 py-3 text-left transition-all wellness-card-solid ${
                                                selected === opt.value ? 'wellness-chip-active' : ''
                                            }`}
                                        >
                                            <span className="block font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                                                {opt.label}
                                            </span>
                                            <span className="block text-xs mt-0.5 wellness-muted">{opt.detail}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </section>
            )}

            {error && (
                <p className="text-sm rounded-xl px-4 py-3 wellness-alert-error" role="alert">
                    {error}
                </p>
            )}

            <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                <button type="button" onClick={goBack} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium wellness-muted hover:opacity-80">
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
                    className="flex items-center gap-2 px-6 py-2.5 wellness-btn-primary rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                    {step === 'stress' ? 'Obtener mis destinos' : 'Continuar'}
                    <ArrowRight className="size-4" />
                </button>
            </div>
        </div>
    );
}
