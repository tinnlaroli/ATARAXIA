import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LoginPayload } from '../types';
import { authApi } from '../authApi';
import { useToast } from '../../../shared/context/ToastContext';
import SmartURLoader from '../components/SmartURLoader';
import { useAuthModal, type AuthStep } from '../context/AuthModalContext';
import { useLanguage, useUserPreferences } from '../../../contexts/LanguageContext';

interface LoginViewProps {
    onSwitchStep: (step: AuthStep) => void;
    onClose?: () => void;
}

export const LoginView = ({ onSwitchStep, onClose }: LoginViewProps) => {
    const navigate = useNavigate();
    const { setStep } = useAuthModal();
    const toast = useToast();
    const { t } = useLanguage();
    const { setUser } = useUserPreferences();

    const [formData, setFormData] = useState<LoginPayload>({
        email: '',
        password: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isLoginReady, setIsLoginReady] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const pendingActionRef = useRef<(() => void) | null>(null);
    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await authApi.login(formData);
            if (response.requiresVerification === true) {
                setStep('twoFactor', response.email);
                toast.success(t('auth.login.success.title'), t('auth.login.success.body'));
                return;
            }

            if (response.token && response.user) {
                localStorage.setItem('token', response.token);
                setUser(response.user);
                localStorage.removeItem('v1:token');
                localStorage.removeItem('v1:user');

                const userRole = response.user.role_id || (Number(response.user.id) === 1 ? 1 : 2);

                const completeAction = () => {
                    if (userRole === 1) {
                        navigate('/dashboard');
                    } else {
                        navigate('/', { state: { openForm: true } });
                    }
                    if (onClose) onClose();
                };

                pendingActionRef.current = completeAction;
                setIsLoginReady(true);
            }

        } catch (error) {
            toast.error(t('auth.login.error.title'), t('auth.login.error.body'));
            setIsLoading(false);
        }
    };

    const handleLoaderFinished = () => {
        if (pendingActionRef.current) {
            pendingActionRef.current();
        }
        setIsLoading(false);
        setIsLoginReady(false);
    };

    return (
        <div className="w-full">
            {isLoading && (
                <SmartURLoader
                    isReady={isLoginReady}
                    onFinished={handleLoaderFinished}
                />
            )}
            <div className="mb-6 flex justify-center">
                <img src="/image.png" alt="ATARAXIA" className="h-12 w-auto object-contain" />
            </div>

            <div className="mb-8 text-center">
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{t('auth.login.title')}</h2>
                <p className="mt-1 text-sm wellness-muted">{t('auth.login.subtitle')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                    <label htmlFor="user-email" className="text-xs font-medium tracking-wider uppercase wellness-muted">
                        {t('auth.login.email.label')}
                    </label>
                    <div className="relative">
                        <input
                            id="user-email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleFieldChange}
                            placeholder={t('auth.login.email.placeholder')}
                            className="w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm transition-colors focus:border-[var(--color-primary-deep)] focus:ring-1 focus:ring-[var(--color-primary-deep)] focus:outline-none wellness-card-solid"
                            style={{ color: 'var(--color-text)' }}
                        />
                        <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 wellness-muted" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="user-password" className="text-xs font-medium tracking-wider uppercase wellness-muted">
                        {t('auth.login.password.label')}
                    </label>
                    <div className="relative">
                        <input
                            id="user-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={formData.password}
                            onChange={handleFieldChange}
                            placeholder="………………"
                            className="w-full rounded-lg border py-2.5 pr-10 pl-9 text-sm transition-colors focus:border-[var(--color-primary-deep)] focus:ring-1 focus:ring-[var(--color-primary-deep)] focus:outline-none wellness-card-solid"
                            style={{ color: 'var(--color-text)' }}
                        />
                        <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 wellness-muted" />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 transition-colors wellness-muted hover:opacity-80"
                        >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => onSwitchStep('forgotPassword')}
                        className="flex items-center gap-1 text-xs wellness-accent-text transition-colors hover:opacity-80"
                    >
                        {t('auth.login.forgot')}
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-medium wellness-btn-primary transition-colors focus:ring-2 focus:ring-[var(--color-primary-deep)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="size-4 animate-spin rounded-full border-2 border-[var(--color-forest)]/30 border-t-[var(--color-forest)]" />
                            <span>{t('auth.login.submitting')}</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <LogIn className="size-4" />
                            <span>{t('auth.login.submit')}</span>
                        </div>
                    )}
                </button>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" style={{ borderColor: 'var(--color-border)' }} />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="px-4 wellness-muted" style={{ background: 'var(--color-bg)' }}>
                            {t('auth.login.first_time')}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onSwitchStep('signup')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-[var(--color-primary-deep)] focus:outline-none wellness-card-solid"
                    style={{ color: 'var(--color-text)' }}
                >
                    <UserPlus className="size-4" />
                    <span>{t('auth.login.create')}</span>
                </button>
            </form>
        </div>
    );
};
