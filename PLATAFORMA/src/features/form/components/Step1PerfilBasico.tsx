import React, { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ChevronRight, Wallet, DollarSign, Star, Clock, Calendar, CalendarRange, Briefcase } from 'lucide-react';
import type { FormContext } from '../types/types';
import { chipCard, chipCardSelected, chipRounded, chipSelectedRounded } from '../utils/formStepClasses';

interface Step1Props {
    data: Partial<FormContext>;
    onNext: () => void;
    onChange: (newData: Partial<FormContext>) => void;
}

const edadOptions = [
    { label: '18-24', value: '18-24' },
    { label: '25-34', value: '25-34' },
    { label: '35-44', value: '35-44' },
    { label: '45-54', value: '45-54' },
    { label: '55+',   value: '55+' },
];

const presupuestoOptions = [
    {
        label: 'Económico',
        value: 'bajo',
        range: '< $700/día',
        icon: Wallet,
        daily: 500,
    },
    {
        label: 'Moderado',
        value: 'medio',
        range: '$700 - $2,000/día',
        icon: DollarSign,
        daily: 1200,
    },
    {
        label: 'Premium',
        value: 'alto',
        range: '> $2,000/día',
        icon: Star,
        daily: 3000,
    },
];

const duracionOptions = [
    { label: '1-2 días', value: '1-2', icon: Clock },
    { label: '3-5 días', value: '3-5', icon: Calendar },
    { label: '6-10 días', value: '6-10', icon: CalendarRange },
    { label: '10+ días', value: '10+', icon: Briefcase },
];

const edadRangeToApprox = (range: string) => {
    if (!range) return null;
    if (range === '55+' || range === '60+') return 60;
    const parts = range.split('-').map(Number);
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return Math.round((parts[0] + parts[1]) / 2);
};

const diasRangeToDays = (range: string) => {
    if (!range) return null;
    if (range === '10+') return 14;
    const parts = range.split('-').map(Number);
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return Math.round((parts[0] + parts[1]) / 2);
};

export const Step1PerfilBasico: React.FC<Step1Props> = ({ data = {}, onNext, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useGSAP(
        () => {
            if (containerRef.current) {
                gsap.from(containerRef.current.children, {
                    y: 20,
                    opacity: 0,
                    duration: 0.5,
                    stagger: 0.1,
                    ease: 'power2.out',
                });
            }
        },
        { scope: containerRef },
    );

    const [edad_range, setEdadRange] = useState(data.edad_range || '');
    const [presupuesto_bucket, setPresupuestoBucket] = useState(data.presupuesto_bucket || '');
    const [duracion_dias_range, setDuracionDiasRange] = useState(data.duracion_dias_range || '');

    const handleNext = () => {
        if (!edad_range || !presupuesto_bucket || !duracion_dias_range) return;

        const edad = edadRangeToApprox(edad_range);
        const duracion_dias = diasRangeToDays(duracion_dias_range);
        const selectedPresupuesto = presupuestoOptions.find((p) => p.value === presupuesto_bucket);
        const presupuesto_daily = selectedPresupuesto?.daily || 1200;

        onChange({
            edad: edad || undefined,
            edad_range,
            presupuesto_daily,
            presupuesto_bucket,
            duracion_dias: duracion_dias || undefined,
            duracion_dias_range,
        });

        onNext();
    };

    return (
        <div className="step-content px-4 py-6" ref={containerRef}>
            <div className="step-header mb-8 text-center">
                <h2 className="wellness-step-title mb-2 text-3xl font-semibold">¿Qué te interesa?</h2>
                <p className="wellness-step-subtitle">Selecciona tus preferencias de viaje</p>
            </div>

            <div className="form-section mb-8">
                <label className="wellness-step-label mb-4 block text-sm font-medium">Rango de edad</label>
                <div className="grid grid-cols-5 gap-2">
                    {edadOptions.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setEdadRange(o.value)}
                            className={`${chipRounded} py-3 ${
                                edad_range === o.value ? chipSelectedRounded : ''
                            }`}
                        >
                            <span className="text-sm font-semibold">{o.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-section mb-8">
                <label className="wellness-step-label mb-4 block text-sm font-medium">Presupuesto diario</label>
                <div className="grid grid-cols-3 gap-4">
                    {presupuestoOptions.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setPresupuestoBucket(o.value)}
                            className={`flex flex-col items-center text-center ${
                                presupuesto_bucket === o.value ? chipCardSelected : chipCard
                            }`}
                        >
                            <div className="mb-3">
                                <o.icon className="size-6" />
                            </div>
                            <div className="mb-1 font-semibold">{o.label}</div>
                            <div className="text-xs opacity-70">{o.range}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-section mb-10">
                <label className="wellness-step-label mb-4 block text-sm font-medium">Duración del viaje</label>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {duracionOptions.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setDuracionDiasRange(o.value)}
                            className={`flex flex-col items-center text-center ${
                                duracion_dias_range === o.value ? chipCardSelected : chipCard
                            }`}
                        >
                            <div className="mb-3">
                                <o.icon className="size-6" />
                            </div>
                            <div className="font-semibold">{o.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleNext}
                    disabled={!(edad_range && presupuesto_bucket && duracion_dias_range)}
                    className="wellness-btn-primary flex items-center gap-2 px-8 py-3 shadow-lg active:scale-95 disabled:cursor-not-allowed"
                >
                    <span>Continuar</span>
                    <ChevronRight className="size-5" />
                </button>
            </div>
        </div>
    );
};
