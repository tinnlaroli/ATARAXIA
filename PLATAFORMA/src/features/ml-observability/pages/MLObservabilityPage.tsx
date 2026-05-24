import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMLHealth } from '../hooks/useMLHealth';
import {
    mlApi,
    isWellnessMetrics,
    isLegacyMetrics,
    type ModelStatus,
    type WellnessClassifierMetrics,
} from '../api/mlApi';
import { useToast } from '../../../shared/context/ToastContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getDashboardText } from '../../../shared/i18n/dashboardLocale';
import { DASHBOARD_COLORS } from '../../home/utils/dashboard';
import {
    BrainCircuit, Zap, Clock, MousePointerClick,
    BarChart2, AlertCircle, RefreshCw, Activity, Play,
    CheckCircle2, XCircle, Leaf, Route, Database, MessageCircleHeart,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const TRAINING_LOCK_MS = 3 * 60 * 1000;
const TRAINING_LOCK_KEY = 'ataraxia_ml_training_lock';
const POLL_INTERVAL_MS = 15_000;

const ACCENT = 'var(--color-primary-deep)';
const ACCENT_SOFT = 'rgba(var(--rgb-primary), 0.22)';

function KpiCard({
    label, value, sub,
    icon: Icon, accent,
}: {
    label: string; value: string; sub?: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    accent: string;
}) {
    return (
        <div
            className="rounded-2xl border p-4 flex items-center gap-4"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        >
            <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${accent}1a` }}
            >
                <Icon className="size-5" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                    {value}
                </p>
                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-alt)' }}>
                    {label}
                </p>
                {sub && (
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-text-alt)' }}>
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div
            className="rounded-2xl border h-20 animate-pulse"
            style={{ background: 'var(--color-bg-alt)', borderColor: 'var(--color-border)' }}
        />
    );
}

function ModelBadge({ label, ready }: { label: string; ready: boolean }) {
    return (
        <div
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{
                borderColor: ready ? `${DASHBOARD_COLORS.success}44` : 'var(--color-border)',
                background: ready ? `${DASHBOARD_COLORS.success}10` : 'var(--color-bg-alt)',
                color: ready ? DASHBOARD_COLORS.success : 'var(--color-text-alt)',
            }}
        >
            {ready ? <CheckCircle2 className="size-3 shrink-0" /> : <XCircle className="size-3 shrink-0" />}
            {label}
        </div>
    );
}

function getClassMetricRows(metrics: WellnessClassifierMetrics) {
    const report = metrics.classification_report;
    if (!report) return [];
    return Object.entries(report)
        .filter(([key]) => !['accuracy', 'macro avg', 'weighted avg'].includes(key))
        .map(([key, row]) => ({
            key,
            f1: row['f1-score'] ?? 0,
            precision: row.precision ?? 0,
            recall: row.recall ?? 0,
            support: row.support ?? 0,
        }));
}

export const MLObservabilityPage = () => {
    const { data, isLoading, error, fetchHealth } = useMLHealth();
    const toast = useToast();
    const { lang } = useLanguage();
    const copy = getDashboardText(lang).mlObservability;
    const locale = getDashboardText(lang).locale;

    const trainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollBaselineRef = useRef<string | null>(null);

    const [training, setTraining] = useState(() => {
        try {
            const ts = localStorage.getItem(TRAINING_LOCK_KEY);
            if (!ts) return false;
            const age = Date.now() - Number(ts);
            if (age >= TRAINING_LOCK_MS) {
                localStorage.removeItem(TRAINING_LOCK_KEY);
                return false;
            }
            return true;
        } catch {
            return false;
        }
    });

    const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);

    const fetchModelStatus = useCallback(async () => {
        setStatusLoading(true);
        try {
            setModelStatus(await mlApi.getModelStatus());
        } catch {
            /* keep previous */
        } finally {
            setStatusLoading(false);
        }
    }, []);

    const releaseLock = useCallback(() => {
        localStorage.removeItem(TRAINING_LOCK_KEY);
        setTraining(false);
        if (trainTimerRef.current) clearTimeout(trainTimerRef.current);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        trainTimerRef.current = null;
        pollTimerRef.current = null;
    }, []);

    const startPolling = useCallback((startedAt: number, baselineSavedAt: string | null) => {
        pollBaselineRef.current = baselineSavedAt;
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        pollTimerRef.current = setInterval(async () => {
            try {
                const result = await mlApi.getHealth();
                const newSaved = result.metrics_saved_at ?? null;
                const newRetrained = isWellnessMetrics(result.latest_metrics)
                    ? result.latest_metrics.retrained_at ?? null
                    : null;
                const baseline = pollBaselineRef.current;
                const changed =
                    (newSaved && newSaved !== baseline) ||
                    (newRetrained && newRetrained !== baseline);

                if (changed) {
                    releaseLock();
                    void fetchHealth();
                    void fetchModelStatus();
                }
            } catch {
                /* ignore */
            }
        }, POLL_INTERVAL_MS);

        trainTimerRef.current = setTimeout(() => {
            releaseLock();
            void fetchHealth();
            void fetchModelStatus();
        }, Math.max(0, TRAINING_LOCK_MS - (Date.now() - startedAt)));
    }, [releaseLock, fetchHealth, fetchModelStatus]);

    useEffect(() => {
        void fetchHealth();
        void fetchModelStatus();

        try {
            const ts = localStorage.getItem(TRAINING_LOCK_KEY);
            if (!ts) return;
            const startedAt = Number(ts);
            if (Date.now() - startedAt >= TRAINING_LOCK_MS) {
                releaseLock();
                return;
            }
            startPolling(startedAt, null);
        } catch {
            /* ignore */
        }

        return () => {
            if (trainTimerRef.current) clearTimeout(trainTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const metrics = data?.latest_metrics;
    const wellnessMetrics = isWellnessMetrics(metrics) ? metrics : null;
    const legacyMetrics = isLegacyMetrics(metrics) ? metrics : null;
    const retrain = data?.retrain ?? modelStatus?.retrain;
    const satisfaction = data?.satisfaction_30d;
    const destinations = modelStatus?.destinations_count ?? data?.wellness_destinations ?? 0;
    const classifierReady = Boolean(modelStatus?.stress_model_loaded ?? wellnessMetrics);
    const sessions = data?.daily_sessions ?? [];
    const ctr = data?.ctr_30d;
    const profiles30d = data?.stress_profiles_30d ?? [];

    const classRows = useMemo(
        () => (wellnessMetrics ? getClassMetricRows(wellnessMetrics) : []),
        [wellnessMetrics],
    );

    const bestRmse = legacyMetrics
        ? Math.min(...Object.values(legacyMetrics.algorithms).map((a) => a.rmse))
        : null;

    const avgLatency =
        sessions.length > 0
            ? (
                sessions.reduce((s, d) => s + parseFloat(d.avg_latency_ms), 0) / sessions.length
            ).toFixed(0)
            : null;
    const totalSessions = sessions.reduce((s, d) => s + d.total, 0);
    const ctrPct =
        ctr && ctr.total > 0 ? ((ctr.clicked / ctr.total) * 100).toFixed(1) : null;

    const chartData = [...sessions].reverse().map((d) => ({
        day: new Date(d.day).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        sessions: d.total,
    }));

    const metricsSavedLabel = data?.metrics_saved_at
        ? copy.metricsSavedAt(
            new Date(data.metrics_saved_at).toLocaleString(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
            }),
        )
        : null;

    const handleTrain = async () => {
        const startedAt = Date.now();
        const baseline = data?.metrics_saved_at ?? wellnessMetrics?.retrained_at ?? null;

        setTraining(true);
        localStorage.setItem(TRAINING_LOCK_KEY, String(startedAt));
        startPolling(startedAt, baseline);

        try {
            await mlApi.trainModel();
            toast.success(copy.toastTrainTitle, copy.toastTrainDesc);
        } catch {
            toast.error(copy.toastErrorTitle, copy.toastErrorDesc);
            releaseLock();
        }
    };

    const profileLabel = (key: string) =>
        copy.profileLabels[key] ?? key.replace(/_/g, ' ');

    if (error) {
        return (
            <div
                className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl border"
                style={{ borderColor: 'var(--color-border)' }}
            >
                <AlertCircle className="size-10" style={{ color: DASHBOARD_COLORS.danger }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{error}</p>
                <button
                    type="button"
                    onClick={() => { void fetchHealth(); void fetchModelStatus(); }}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold wellness-btn-primary"
                >
                    <RefreshCw className="size-4" /> {copy.errorRetry}
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-9rem)] flex-col gap-4 overflow-hidden" id="ml-module">
            <div className="flex shrink-0 items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
                        {copy.title}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-alt)' }}>{copy.subtitle}</p>
                    {metricsSavedLabel && (
                        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-alt)' }}>
                            {metricsSavedLabel}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => void handleTrain()}
                        disabled={training || isLoading || retrain?.training_in_flight}
                        className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed wellness-btn-primary"
                        title={training ? copy.trainTooltipActive : copy.trainTooltipIdle}
                    >
                        {training || retrain?.training_in_flight ? (
                            <>
                                <span className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                {copy.trainingLabel}
                            </>
                        ) : (
                            <>
                                <Play className="size-4" />
                                {copy.trainBtn}
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => { void fetchHealth(); void fetchModelStatus(); }}
                        disabled={isLoading || statusLoading}
                        className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 wellness-card-solid"
                        style={{ color: 'var(--color-text-alt)' }}
                    >
                        <RefreshCw className={`size-4 ${(isLoading || statusLoading) ? 'animate-spin' : ''}`} />
                        {copy.refreshBtn}
                    </button>
                </div>
            </div>

            <div
                className="shrink-0 rounded-xl border px-5 py-4 flex items-start gap-3"
                style={{ background: ACCENT_SOFT, borderColor: 'var(--color-border)' }}
            >
                <BrainCircuit className="size-5 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>
                        {copy.bannerTitle}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-alt)' }}>
                        {copy.bannerDesc}
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Pipeline */}
                <div
                    className="rounded-2xl border p-4"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                        <Route className="size-4" style={{ color: ACCENT }} />
                        {copy.pipelineTitle}
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                        {[
                            { title: copy.pipelineStep1Title, desc: copy.pipelineStep1Desc, icon: Leaf },
                            { title: copy.pipelineStep2Title, desc: copy.pipelineStep2Desc, icon: BrainCircuit },
                            { title: copy.pipelineStep3Title, desc: copy.pipelineStep3Desc, icon: Database },
                        ].map(({ title, desc, icon: Icon }) => (
                            <div
                                key={title}
                                className="rounded-xl border p-3"
                                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-alt)' }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Icon className="size-4" style={{ color: 'var(--color-earth)' }} />
                                    <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{title}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-alt)' }}>{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Model status */}
                <div
                    className="rounded-2xl border p-4"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Activity className="size-4" style={{ color: ACCENT }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                            {copy.modelStatusTitle}
                        </p>
                        {retrain != null && (
                            <span
                                className="ml-auto text-[11px] font-medium"
                                style={{ color: 'var(--color-text-alt)' }}
                            >
                                {retrain.real_assessments_total.toLocaleString(locale)} {copy.retrainAssessmentsLabel}
                            </span>
                        )}
                    </div>
                    {statusLoading && !modelStatus ? (
                        <div className="flex gap-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-6 w-24 rounded-full animate-pulse" style={{ background: 'var(--color-bg-alt)' }} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <ModelBadge label={copy.badgeClassifier} ready={classifierReady} />
                            <ModelBadge label={copy.badgeMatchmaker} ready={classifierReady && destinations > 0} />
                            <ModelBadge label={copy.badgeCatalog} ready={destinations > 0} />
                        </div>
                    )}
                    {wellnessMetrics?.model_type && (
                        <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-alt)' }}>
                            {copy.modelTypeLabel}: {wellnessMetrics.model_type}
                            {wellnessMetrics.hybrid_threshold != null &&
                                ` · ${copy.hybridThresholdLabel(wellnessMetrics.hybrid_threshold)}`}
                        </p>
                    )}
                </div>

                {/* Retrain panel */}
                {retrain && (
                    <div
                        className="rounded-2xl border p-4"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                            {copy.retrainTitle}
                        </p>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-alt)' }}>
                            {retrain.auto_retrain_enabled ? copy.retrainAutoOn : copy.retrainAutoOff}
                        </p>
                        {retrain.training_in_flight && (
                            <p className="text-xs font-medium" style={{ color: 'var(--color-earth)' }}>
                                {copy.retrainInFlight}
                            </p>
                        )}
                        {retrain.pending_for_retrain > 0 && !retrain.training_in_flight && (
                            <p className="text-xs font-medium" style={{ color: DASHBOARD_COLORS.warning }}>
                                {copy.retrainPending(retrain.pending_for_retrain)}
                            </p>
                        )}
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                    ) : (
                        <>
                            <KpiCard
                                label={copy.kpiAccuracy}
                                value={
                                    wellnessMetrics?.accuracy != null
                                        ? `${(wellnessMetrics.accuracy * 100).toFixed(1)}%`
                                        : legacyMetrics && bestRmse != null
                                          ? bestRmse.toFixed(3)
                                          : '—'
                                }
                                sub={
                                    wellnessMetrics?.macro_f1 != null
                                        ? `Macro-F1 ${(wellnessMetrics.macro_f1 * 100).toFixed(1)}%`
                                        : wellnessMetrics
                                          ? copy.kpiAccuracySub
                                          : copy.kpiRmseSub
                                }
                                icon={BarChart2}
                                accent={ACCENT}
                            />
                            <KpiCard
                                label={copy.kpiDestinations}
                                value={String(destinations)}
                                sub={copy.kpiDestinationsSub}
                                icon={Leaf}
                                accent={DASHBOARD_COLORS.success}
                            />
                            <KpiCard
                                label={copy.kpiAssessments}
                                value={String(retrain?.real_assessments_total ?? modelStatus?.users_count ?? 0)}
                                sub={copy.kpiAssessmentsSub}
                                icon={Database}
                                accent="var(--color-earth)"
                            />
                            <KpiCard
                                label={copy.kpiLatency}
                                value={avgLatency ? `${avgLatency} ms` : '—'}
                                sub={copy.kpiLatencySub}
                                icon={Zap}
                                accent={DASHBOARD_COLORS.warning}
                            />
                            <KpiCard
                                label={copy.kpiSessions}
                                value={String(totalSessions)}
                                sub={copy.kpiSessionsSub}
                                icon={Clock}
                                accent={DASHBOARD_COLORS.chart2}
                            />
                            <KpiCard
                                label={copy.kpiCtr}
                                value={ctrPct ? `${ctrPct}%` : '—'}
                                sub={ctr ? copy.kpiCtrSub(ctr.clicked, ctr.total) : copy.kpiCtrEmpty}
                                icon={MousePointerClick}
                                accent={DASHBOARD_COLORS.chart4}
                            />
                            {satisfaction != null && (
                                <KpiCard
                                    label="Encuesta post-plan"
                                    value={
                                        satisfaction.avg_rating != null
                                            ? String(satisfaction.avg_rating)
                                            : '—'
                                    }
                                    sub={`${satisfaction.total} respuestas (30d) · ${satisfaction.positive_count} con 4–5`}
                                    icon={MessageCircleHeart}
                                    accent="var(--color-earth)"
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Profile distribution 30d */}
                {!isLoading && profiles30d.length > 0 && (
                    <div
                        className="rounded-2xl border p-5"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                            {copy.profileDistributionTitle}
                        </p>
                        <div className="space-y-2">
                            {profiles30d.map((row) => {
                                const max = Math.max(...profiles30d.map((r) => r.n), 1);
                                return (
                                    <div key={row.perfil_estres} className="flex items-center gap-3">
                                        <span className="w-36 shrink-0 text-xs truncate" style={{ color: 'var(--color-text)' }}>
                                            {profileLabel(row.perfil_estres)}
                                        </span>
                                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--rgb-forest), 0.08)' }}>
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${(row.n / max) * 100}%`,
                                                    background: ACCENT,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs tabular-nums w-8 text-right" style={{ color: 'var(--color-text-alt)' }}>
                                            {row.n}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Class F1 table */}
                {!isLoading && classRows.length > 0 && (
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-5 py-3 border-b" style={{ background: 'var(--color-bg-alt)', borderColor: 'var(--color-border)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                {copy.classMetricsTitle}
                            </p>
                            {wellnessMetrics?.n_train != null && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-alt)' }}>
                                    n_train={wellnessMetrics.n_train} · n_test={wellnessMetrics.n_test}
                                    {wellnessMetrics.n_real_assessments != null &&
                                        ` · reales=${wellnessMetrics.n_real_assessments}`}
                                </p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background: 'var(--color-bg-alt)', borderBottom: '1px solid var(--color-border)' }}>
                                        {[copy.classColProfile, copy.classColF1, copy.classColPrecision, copy.classColRecall, copy.classColSupport].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i > 0 ? 'text-right' : 'text-left'}`}
                                                style={{ color: 'var(--color-text-alt)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {classRows.map((row) => (
                                        <tr key={row.key} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                                                {profileLabel(row.key)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono" style={{ color: ACCENT }}>{row.f1.toFixed(3)}</td>
                                            <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-text)' }}>{row.precision.toFixed(3)}</td>
                                            <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-text)' }}>{row.recall.toFixed(3)}</td>
                                            <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-text-alt)' }}>{row.support}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Sessions chart */}
                {!isLoading && chartData.length > 0 && (
                    <div
                        className="rounded-2xl border p-5"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="size-4" style={{ color: ACCENT }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{copy.chartTitle}</p>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="mlGradWellness" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-alt)' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-alt)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sessions"
                                    stroke="var(--color-chart-1)"
                                    fill="url(#mlGradWellness)"
                                    strokeWidth={2}
                                    name={copy.chartSessionsName}
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Legacy metrics fallback */}
                {!isLoading && legacyMetrics && Object.keys(legacyMetrics.algorithms ?? {}).length > 0 && (
                    <div
                        className="rounded-xl border px-4 py-3 text-xs"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-alt)' }}
                    >
                        {copy.tableTitle} (motor legacy detectado en BD — no usado en producción wellness)
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !wellnessMetrics && !legacyMetrics && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-20 rounded-2xl border"
                        style={{ borderColor: 'var(--color-border)' }}
                    >
                        <BrainCircuit className="size-12" style={{ color: 'var(--color-border)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-alt)' }}>{copy.emptyTitle}</p>
                        <p className="text-xs text-center max-w-md px-4" style={{ color: 'var(--color-text-alt)' }}>
                            {copy.emptyHint}
                        </p>
                        <button
                            type="button"
                            onClick={() => void handleTrain()}
                            disabled={training}
                            className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold wellness-btn-primary disabled:opacity-50"
                        >
                            {training ? (
                                <>
                                    <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                    {copy.trainingLabel}
                                </>
                            ) : (
                                <>
                                    <Play className="size-4" />
                                    {copy.emptyTrainBtn}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
