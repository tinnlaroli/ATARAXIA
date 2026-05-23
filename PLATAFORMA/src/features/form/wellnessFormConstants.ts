import type { LucideIcon } from 'lucide-react';
import {
    Brain,
    HeartPulse,
    Moon,
    Zap,
    Leaf,
    Sparkles,
    Mountain,
    Church,
    Landmark,
    Sun,
    Building2,
    Trees,
} from 'lucide-react';

export const WELLNESS_WIZARD_STEPS = [
    { id: 'intro', label: 'Inicio' },
    { id: 'preferences', label: 'Estilo' },
    { id: 'stress', label: 'Check-in' },
] as const;

export type WellnessWizardStepId = (typeof WELLNESS_WIZARD_STEPS)[number]['id'];

export const WELLNESS_INTERESTS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
    { value: 'bienestar', label: 'Bienestar', description: 'Spas, termas y cuidado integral', icon: Sparkles },
    { value: 'relax', label: 'Descanso', description: 'Silencio, retiros y baja estimulación', icon: Moon },
    { value: 'naturaleza', label: 'Naturaleza', description: 'Bosque, montaña y agua', icon: Mountain },
    { value: 'espiritual', label: 'Contemplación', description: 'Ritmo lento y conexión interior', icon: Church },
    { value: 'cultural', label: 'Cultura suave', description: 'Experiencias sin prisa', icon: Landmark },
];

export const ACTIVITY_LEVELS = [
    { value: 1, label: 'Muy suave', hint: 'Casi sin caminatas largas' },
    { value: 2, label: 'Suave', hint: 'Paseos cortos y reposo' },
    { value: 3, label: 'Equilibrado', hint: 'Mezcla de descanso y movimiento' },
    { value: 4, label: 'Activo', hint: 'Senderos y actividades ligeras' },
    { value: 5, label: 'Muy activo', hint: 'Mucho movimiento al aire libre' },
];

export const PLACE_PREFERENCES = [
    { value: 'aire', label: 'Aire libre', icon: Sun },
    { value: 'cerrado', label: 'Espacios cerrados', icon: Building2 },
    { value: 'indiferente', label: 'Me da igual', icon: Trees },
];

export const STRESS_QUESTIONS = [
    {
        key: 'q1' as const,
        icon: Brain,
        title: 'Energía mental',
        subtitle: 'Al cerrar el día, ¿cuánta claridad y energía te queda en la cabeza?',
        options: [
            { value: 1, label: 'Agotada', detail: 'Cuesta concentrarte' },
            { value: 2, label: 'Regular', detail: 'Funcionas, pero con esfuerzo' },
            { value: 3, label: 'Bien', detail: 'Mente relativamente fresca' },
        ],
    },
    {
        key: 'q2' as const,
        icon: HeartPulse,
        title: 'Cuerpo y tensión',
        subtitle: '¿Qué tan presente está la tensión, fatiga o dolor físico?',
        options: [
            { value: 1, label: 'Mínima', detail: 'Cuerpo liviano' },
            { value: 2, label: 'Leve', detail: 'Alguna molestia puntual' },
            { value: 3, label: 'Moderada', detail: 'Cansancio frecuente' },
            { value: 4, label: 'Alta', detail: 'Agotamiento corporal marcado' },
        ],
    },
    {
        key: 'q3' as const,
        icon: Moon,
        title: 'Mente rumiante',
        subtitle: '¿Con qué frecuencia repites preocupaciones o escenarios negativos?',
        options: [
            { value: 1, label: 'Casi nunca', detail: 'Mente tranquila' },
            { value: 2, label: 'A veces', detail: 'Algunos bucles mentales' },
            { value: 3, label: 'Casi siempre', detail: 'Difícil desconectar' },
        ],
    },
    {
        key: 'q4' as const,
        icon: Zap,
        title: 'Activación en reposo',
        subtitle: 'En momentos de pausa, ¿qué tan alerta o inquieto te sientes?',
        options: [
            { value: 1, label: 'Muy calmado', detail: 'Puedes soltar con facilidad' },
            { value: 2, label: 'Algo activo', detail: 'Ligera inquietud' },
            { value: 3, label: 'Muy activo', detail: 'Sistema nervioso acelerado' },
        ],
    },
];

export const PROFILE_HINTS: Record<string, string> = {
    Burnout: 'Tu cuerpo pide restauración cognitiva: silencio, baja demanda y entornos que no exijan decisiones.',
    Fatiga_Fisica: 'Priorizamos recuperación corporal con termas, spa y ritmo lento.',
    Hiperactividad_Ansiosa: 'Buscamos entornos que bajen la rumiación y la hiperalerta sin abrumarte.',
};
