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
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden px-6 py-12">
            <button
                onClick={handleLogout}
                className="absolute top-8 right-8 z-20 flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
                <LogOut className="size-4" />
                <span className="text-sm font-semibold">{t('header.logout')}</span>
            </button>

            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[45%] bg-violet-600/25 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[40%] bg-emerald-600/15 rounded-full blur-[120px]" />
            </div>

            <div className="z-10 w-full max-w-xl text-center space-y-10">
                <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-violet-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Heart className="size-8 text-white" />
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400/90">
                        Check-in de bienestar
                    </p>
                    <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
                        Encuentra el destino que tu{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">
                            cuerpo y mente
                        </span>{' '}
                        necesitan
                    </h1>
                    <p className="text-lg text-zinc-400 leading-relaxed max-w-md mx-auto">
                        Tres pasos: estilo de viaje, cómo te sientes hoy e IA que recomienda lugares terapéuticos en México.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                    {[
                        { icon: Leaf, title: 'Estilo', desc: 'Naturaleza, spa, ritmo y accesibilidad' },
                        { icon: Heart, title: 'Check-in', desc: '4 señales de estrés y agotamiento' },
                        { icon: Sparkles, title: 'Destinos', desc: 'Beneficio óptimo por perfil' },
                    ].map((item) => (
                        <div
                            key={item.title}
                            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm"
                        >
                            <item.icon className="size-5 text-violet-400 mb-2" />
                            <p className="text-sm font-semibold text-zinc-200">{item.title}</p>
                            <p className="text-xs text-zinc-500 mt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="group inline-flex items-center gap-3 px-10 py-4 bg-white text-zinc-900 font-semibold rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                    Comenzar check-in
                    <ArrowRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                    No sustituye atención médica. Orientación wellness para planificar tu próximo viaje reparador.
                </p>
            </div>

            <FormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
