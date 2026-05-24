import { Check } from 'lucide-react';
import { WELLNESS_WIZARD_STEPS, type WellnessWizardStepId } from '../wellnessFormConstants';

interface Props {
    currentStepId: WellnessWizardStepId;
    loading?: boolean;
}

export function WellnessProgressIndicator({ currentStepId, loading = false }: Props) {
    const currentIndex = WELLNESS_WIZARD_STEPS.findIndex((s) => s.id === currentStepId);
    const progress = loading ? 100 : Math.round(((currentIndex + 1) / WELLNESS_WIZARD_STEPS.length) * 100);

    return (
        <div className="mb-8 w-full" aria-label="Progreso del check-in wellness">
            <div className="mb-6 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(var(--rgb-forest), 0.12)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, var(--color-primary), var(--color-earth))',
                        }}
                    />
                </div>
                <span className="text-xs font-semibold tabular-nums wellness-muted">{progress}%</span>
            </div>
            <div className="flex justify-between gap-2">
                {WELLNESS_WIZARD_STEPS.map((step, idx) => {
                    const done = idx < currentIndex || loading;
                    const active = idx === currentIndex && !loading;
                    return (
                        <div key={step.id} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className="flex size-10 items-center justify-center rounded-xl border text-xs font-bold transition-all"
                                style={
                                    done
                                        ? {
                                              borderColor: 'var(--color-primary-deep)',
                                              background: 'rgba(var(--rgb-primary), 0.35)',
                                              color: 'var(--color-forest)',
                                          }
                                        : active
                                          ? {
                                                borderColor: 'var(--color-primary-deep)',
                                                background: 'rgba(var(--rgb-primary), 0.2)',
                                                color: 'var(--color-forest)',
                                                transform: 'scale(1.05)',
                                            }
                                          : {
                                                borderColor: 'var(--color-border)',
                                                background: 'var(--color-bg)',
                                                color: 'var(--color-text-alt)',
                                            }
                                }
                            >
                                {done ? <Check className="size-4" /> : idx + 1}
                            </div>
                            <span
                                className="text-center text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                    color: active || done ? 'var(--color-text)' : 'var(--color-text-alt)',
                                }}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
