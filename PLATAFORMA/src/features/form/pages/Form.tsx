import { useState, useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { Heart, Leaf, Sparkles, LogOut, ArrowRight } from 'lucide-react';

import { FormModal } from '../components/FormModal';

import { useLanguage, useUserPreferences } from '../../../contexts/LanguageContext';



export default function Form() {

    const navigate = useNavigate();

    const location = useLocation();

    const { t } = useLanguage();

    const { clearUser } = useUserPreferences();



    const token = location.state?.tokenValide || localStorage.getItem('token');

    const [isModalOpen, setIsModalOpen] = useState(false);



    useEffect(() => {

        if (!token) {

            navigate('/');

        }

    }, [token, navigate]);



    const handleLogout = () => {

        localStorage.removeItem('token');

        clearUser();

        navigate('/');

    };



    return (

        <div className="wellness-page flex flex-col items-center justify-center relative overflow-hidden px-6 py-12">

            <div className="absolute inset-0 pointer-events-none wellness-glow-primary" />

            <div className="absolute inset-0 pointer-events-none wellness-glow-earth" />



            <button

                type="button"

                onClick={handleLogout}

                className="absolute top-8 right-8 z-20 flex items-center gap-2 px-4 py-2 wellness-card-solid wellness-muted hover:opacity-80 transition-opacity"

            >

                <LogOut className="size-4" />

                <span className="text-sm font-semibold">{t('header.logout')}</span>

            </button>



            <div className="z-10 w-full max-w-xl text-center space-y-10">

                <div

                    className="mx-auto size-16 rounded-2xl flex items-center justify-center shadow-lg"

                    style={{ background: 'var(--color-primary)', color: 'var(--color-forest)' }}

                >

                    <Heart className="size-8" />

                </div>



                <div className="space-y-4">

                    <p className="text-sm font-semibold uppercase tracking-widest wellness-accent-text">

                        Check-in de bienestar · ATARAXIA

                    </p>

                    <h1

                        className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight"

                        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}

                    >

                        El destino que tu{' '}

                        <span style={{ color: 'var(--color-primary-deep)' }}>cuerpo y mente</span> necesitan hoy

                    </h1>

                    <p className="text-lg leading-relaxed max-w-md mx-auto wellness-muted">

                        Tres pasos: estilo de viaje, cómo te sientes y recomendaciones terapéuticas en México.

                    </p>

                </div>



                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">

                    {[

                        { icon: Leaf, title: 'Estilo', desc: 'Naturaleza, spa, ritmo y accesibilidad' },

                        { icon: Heart, title: 'Check-in', desc: '4 señales de estrés' },

                        { icon: Sparkles, title: 'Destinos', desc: 'Beneficio óptimo por perfil' },

                    ].map((item) => (

                        <div key={item.title} className="p-4 wellness-card text-left">

                            <item.icon className="size-5 mb-2 wellness-accent-text" />

                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>

                                {item.title}

                            </p>

                            <p className="text-xs mt-1 wellness-muted">{item.desc}</p>

                        </div>

                    ))}

                </div>



                <button

                    type="button"

                    onClick={() => setIsModalOpen(true)}

                    className="group inline-flex items-center gap-3 px-10 py-4 wellness-btn-primary rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98]"

                >

                    Comenzar check-in

                    <ArrowRight className="size-5 group-hover:translate-x-0.5 transition-transform" />

                </button>



                <p className="text-xs max-w-sm mx-auto wellness-muted">

                    No sustituye atención médica. Orientación wellness para tu próximo viaje reparador.

                </p>

            </div>



            <FormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

        </div>

    );

}

