import { Check } from 'lucide-react';
import { WELLNESS_WIZARD_STEPS, type WellnessWizardStepId } from '../wellnessFormConstants';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
    currentStepId: WellnessWizardStepId;
    loading?: boolean;
}

export function WellnessProgressIndicator({ currentStepId, loading = false }: Props) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const currentIndex = WELLNESS_WIZARD_STEPS.findIndex((s) => s.id === currentStepId);
    const progress = loading ? 100 : Math.round(((currentIndex + 1) / WELLNESS_WIZARD_STEPS.length) * 100);

    return (
        <div className="mb-8 w-full" aria-label="Progreso del check-in wellness">
            <div className="mb-6 flex items-center gap-3">
                <div className={`h-2 flex-1 overflow-hidden rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    {progress}%
                </span>
            </div>
            <div className="flex justify-between gap-2">
                {WELLNESS_WIZARD_STEPS.map((step, idx) => {
                    const done = idx < currentIndex || loading;
                    const active = idx === currentIndex && !loading;
                    return (
                        <div key={step.id} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className={`flex size-10 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                                    done
                                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                                        : active
                                          ? 'border-violet-500 bg-violet-500/15 text-violet-300 scale-105'
                                          : isDark
                                            ? 'border-zinc-800 bg-zinc-900 text-zinc-600'
                                            : 'border-zinc-200 bg-white text-zinc-400'
                                }`}
                            >
                                {done ? <Check className="size-4" /> : idx + 1}
                            </div>
                            <span
                                className={`text-center text-[10px] font-semibold uppercase tracking-wide ${
                                    active || done
                                        ? isDark
                                            ? 'text-zinc-300'
                                            : 'text-zinc-700'
                                        : isDark
                                          ? 'text-zinc-600'
                                          : 'text-zinc-400'
                                }`}
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
