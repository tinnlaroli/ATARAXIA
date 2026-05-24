import React, { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ChevronRight, ChevronLeft, User, Heart, Users, Users2, Bed, Car, Utensils, Route } from 'lucide-react';
import type { FormContext } from '../types/types';
import { btnBack, btnNext, chipCard, chipCardSelected } from '../utils/formStepClasses';

interface Step3Props {
    data: Partial<FormContext>;
    onNext: () => void;
    onBack: () => void;
    onChange: (newData: Partial<FormContext>) => void;
}

const companyOptions = [
    { label: 'Solo', value: 'solo', icon: User },
    { label: 'Pareja', value: 'pareja', icon: Heart },
    { label: 'Familia', value: 'familia', icon: Users },
    { label: 'Amigos', value: 'amigos', icon: Users2 },
];

const servicesList = [
    { label: 'Hospedaje', value: 'hospedaje', icon: Bed },
    { label: 'Transporte', value: 'transporte', icon: Car },
    { label: 'Alimentos', value: 'alimentos', icon: Utensils },
    { label: 'Tours', value: 'tours', icon: Route },
];

export const Step3Contexto: React.FC<Step3Props> = ({ data = {}, onNext, onBack, onChange }) => {
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

    const [group_type, setGroupType] = useState<string>(data.group_type || '');
    const [services, setServices] = useState<string[]>(data.services || []);

    const toggleService = (v: string) => {
        setServices((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
    };

    const handleNext = () => {
        if (!group_type) return;

        onChange({
            group_type,
            services,
            needs_hotel: services.includes('hospedaje'),
            needs_transport: services.includes('transporte'),
            pref_food: services.includes('alimentos'),
            wants_tours: services.includes('tours'),
        });
        onNext();
    };

    return (
        <div className="step-content px-4 py-6" ref={containerRef}>
            <div className="step-header mb-8 text-center">
                <h2 className="wellness-step-title mb-2 text-3xl font-semibold">Contexto del viaje</h2>
                <p className="wellness-step-subtitle">Cuéntanos sobre tu compañía y servicios preferidos</p>
            </div>

            <div className="form-section mb-8">
                <label className="wellness-step-label mb-4 block text-sm font-medium">Viajas con</label>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {companyOptions.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => setGroupType(c.value)}
                            type="button"
                            className={`flex flex-col items-center text-center ${
                                group_type === c.value ? chipCardSelected : chipCard
                            }`}
                        >
                            <div className="mb-3">
                                <c.icon className="size-8" />
                            </div>
                            <div className="font-semibold">{c.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-section mb-10">
                <label className="wellness-step-label mb-4 block text-sm font-medium">Servicios que quieres incluir</label>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {servicesList.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            onClick={() => toggleService(s.value)}
                            className={`flex flex-col items-center text-center ${
                                services.includes(s.value) ? chipCardSelected : chipCard
                            }`}
                        >
                            <div className="mb-3">
                                <s.icon className="size-8" />
                            </div>
                            <div className="font-bold">{s.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-between">
                <button type="button" onClick={onBack} className={btnBack}>
                    <ChevronLeft className="size-5" />
                    <span>Atrás</span>
                </button>
                <button type="button" onClick={handleNext} disabled={!group_type} className={btnNext}>
                    <span>Continuar</span>
                    <ChevronRight className="size-5" />
                </button>
            </div>
        </div>
    );
};
