import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts'
import {
    BarChart3,
    Camera,
    AlertTriangle,
    Clock,
    Loader2,
    Database
} from 'lucide-react'

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                    <p className="text-slate-400 max-w-md">{this.state.error?.message || "Failed to load analytics data"}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface AnalyticsSummary {
    totalIncidents: number
    mostActiveCamera: string
    mostCommonThreat: string
    bestResponseTimeMin: number
    dailyBreakdown: DailyBreakdown[]
    threatDistribution: ThreatDistEntry[]
    avgResponsePerDay: ResponsePerDay[]
    perCamera: CameraAnalytics[]
}

interface DailyBreakdown {
    date: string
    Fall: number
    Chasing: number
    Struggle: number
    Zone: number
}

interface ThreatDistEntry {
    name: string
    value: number
}

interface ResponsePerDay {
    date: string
    avgMinutes: number
}

interface CameraAnalytics {
    cameraName: string
    totalIncidents: number
    falsePositiveRate: number
    avgResponseTime: number
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const THREAT_COLORS: Record<string, string> = {
    Fall: '#ef4444',
    Chasing: '#f97316',
    Struggle: '#eab308',
    Zone: '#6366f1',
}

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#6366f1', '#22c55e', '#06b6d4', '#a855f7']

/* ================================================================== */
/*  Custom tooltip                                                     */
/* ================================================================== */

function DarkTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 shadow-xl">
            <p className="mb-1 text-xs text-slate-400">{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-xs" style={{ color: entry.color }}>
                    {entry.name}: <span className="font-semibold">{entry.value}</span>
                </p>
            ))}
        </div>
    )
}

function PieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 shadow-xl">
            <p className="text-xs text-white">
                {payload[0].name}:{' '}
                <span className="font-semibold">{payload[0].value}</span>
            </p>
        </div>
    )
}

/* ================================================================== */
/*  Stat Card                                                          */
/* ================================================================== */

function StatCard({
    icon: Icon,
    label,
    value,
    accent,
    bg,
}: {
    icon: React.ElementType
    label: string
    value: string | number
    accent: string
    bg: string
}) {
    return (
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
                <div
                    className={[
                        'flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset',
                        bg,
                        accent,
                    ].join(' ')}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="truncate text-2xl font-bold tracking-tight text-white">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Pie label renderer                                                 */
/* ================================================================== */

function renderPieLabel({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
}: any) {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 1.3
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.04) return null

    return (
        <text
            x={x}
            y={y}
            fill="#94a3b8"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={12}
        >
            {name} {(percent * 100).toFixed(0)}%
        </text>
    )
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function AnalyticsPage() {
    const { orgId } = useAuthStore()

    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    /* ---- Fetch analytics data ---- */
    const { data: summary, isLoading } = useQuery<AnalyticsSummary>({
        queryKey: ['analytics-summary', orgId, dateFrom, dateTo],
        queryFn: async () => {
            const params: Record<string, string> = {}
            if (dateFrom) params.dateFrom = dateFrom
            if (dateTo) params.dateTo = dateTo
            const { data } = await apiClient.get(`/analytics/${orgId}/summary`, {
                params,
            })
            return data
        },
        enabled: !!orgId,
        retry: 1, // Don't retry infinitely if returning 404
        placeholderData: {
            totalIncidents: 0,
            mostActiveCamera: '—',
            mostCommonThreat: '—',
            bestResponseTimeMin: 0,
            dailyBreakdown: [],
            threatDistribution: [],
            avgResponsePerDay: [],
            perCamera: [],
        },
    })

    // If query fails completely, ErrorBoundary can catch, but let's handle graceful empty state first
    const s = summary || {
        totalIncidents: 0,
        mostActiveCamera: '—',
        mostCommonThreat: '—',
        bestResponseTimeMin: 0,
        dailyBreakdown: [],
        threatDistribution: [],
        avgResponsePerDay: [],
        perCamera: [],
    }

    /* ---- Fallback chart data ---- */
    const barData = useMemo(() => {
        if (s.dailyBreakdown.length > 0) return s.dailyBreakdown
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (29 - i))
            return {
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                Fall: 0,
                Chasing: 0,
                Struggle: 0,
                Zone: 0,
            }
        })
    }, [s.dailyBreakdown])

    const pieData = useMemo(() => {
        if (s.threatDistribution.length > 0) return s.threatDistribution
        return [
            { name: 'Fall', value: 0 },
            { name: 'Chasing', value: 0 },
            { name: 'Struggle', value: 0 },
            { name: 'Zone', value: 0 },
        ]
    }, [s.threatDistribution])

    const lineData = useMemo(() => {
        if (s.avgResponsePerDay.length > 0) return s.avgResponsePerDay
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (29 - i))
            return {
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                avgMinutes: 0,
            }
        })
    }, [s.avgResponsePerDay])

    /* ================================================================ */
    /*  Render                                                           */
    /* ================================================================ */

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-netra-400" />
                <p className="text-sm text-slate-400 animate-pulse">Loading analytics data...</p>

                {/* Skeleton Loading State */}
                <div className="w-full max-w-6xl mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 px-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse border border-white/5"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="space-y-6">
                {/* Header + date filter */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Analytics</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Security insights and performance metrics
                        </p>
                    </div>

                    <div className="flex items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        icon={BarChart3}
                        label="Total Incidents"
                        value={s.totalIncidents}
                        accent="text-netra-400 ring-netra-500/30"
                        bg="bg-netra-500/10"
                    />
                    <StatCard
                        icon={Camera}
                        label="Most Active Camera"
                        value={s.mostActiveCamera}
                        accent="text-red-400 ring-red-500/30"
                        bg="bg-red-500/10"
                    />
                    <StatCard
                        icon={AlertTriangle}
                        label="Most Common Threat"
                        value={s.mostCommonThreat}
                        accent="text-amber-400 ring-amber-500/30"
                        bg="bg-amber-500/10"
                    />
                    <StatCard
                        icon={Clock}
                        label="Best Response Time"
                        value={`${s.bestResponseTimeMin}m`}
                        accent="text-emerald-400 ring-emerald-500/30"
                        bg="bg-emerald-500/10"
                    />
                </div>

                {/* Chart 1: Bar chart — incidents per day by threat type */}
                <div className="rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                    <div className="border-b border-white/5 px-5 py-4">
                        <h2 className="text-sm font-semibold text-white">
                            Daily Incidents by Threat Type — Last 30 Days
                        </h2>
                    </div>
                    <div className="p-5">
                        <div className="h-72">
                            {barData && barData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<DarkTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                                        {Object.entries(THREAT_COLORS).map(([key, color]) => (
                                            <Bar key={key} dataKey={key} fill={color} radius={[2, 2, 0, 0]} maxBarSize={16} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center border-2 border-dashed border-white/5 rounded-lg">
                                    <Database className="h-8 w-8 text-slate-600 mb-2" />
                                    <div className="text-slate-500 py-2 font-medium">No data available yet</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Charts row: Pie + Line */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Chart 2: Pie — threat distribution */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                        <div className="border-b border-white/5 px-5 py-4">
                            <h2 className="text-sm font-semibold text-white">
                                Threat Distribution
                            </h2>
                        </div>
                        <div className="p-5">
                            <div className="h-72">
                                {pieData && pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" label={renderPieLabel} labelLine={false} stroke="rgba(15,23,42,0.8)" strokeWidth={2}>
                                                {pieData.map((_entry, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<PieTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center border-2 border-dashed border-white/5 rounded-lg">
                                        <Database className="h-8 w-8 text-slate-600 mb-2" />
                                        <div className="text-slate-500 py-2 font-medium">No threats detected yet</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Chart 3: Line — avg response time */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                        <div className="border-b border-white/5 px-5 py-4">
                            <h2 className="text-sm font-semibold text-white">
                                Avg Response Time — Last 30 Days
                            </h2>
                        </div>
                        <div className="p-5">
                            <div className="h-72">
                                {lineData && lineData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={lineData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} interval="preserveStartEnd" />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} unit="m" />
                                            <Tooltip content={<DarkTooltip />} />
                                            <Line type="monotone" dataKey="avgMinutes" name="Avg Response (min)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#14532d', stroke: '#22c55e', strokeWidth: 2, }} activeDot={{ r: 5, fill: '#22c55e', stroke: '#bbf7d0', strokeWidth: 2, }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center border-2 border-dashed border-white/5 rounded-lg">
                                        <Database className="h-8 w-8 text-slate-600 mb-2" />
                                        <div className="text-slate-500 py-2 font-medium">No response data available</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Per-camera table */}
                <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                    <div className="border-b border-white/5 px-5 py-4">
                        <h2 className="text-sm font-semibold text-white">
                            Per-Camera Breakdown
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Camera
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Total Incidents
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        False Positive Rate
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Avg Response Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {s.perCamera.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-5 py-12 text-center text-sm text-slate-500"
                                        >
                                            No camera data available yet
                                        </td>
                                    </tr>
                                ) : (
                                    s.perCamera.map((cam, i) => (
                                        <tr
                                            key={i}
                                            className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                                        >
                                            <td className="whitespace-nowrap px-5 py-3.5 font-medium text-white">
                                                {cam.cameraName}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-300">
                                                {cam.totalIncidents}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5">
                                                <span
                                                    className={[
                                                        'rounded-full px-2 py-0.5 text-xs font-medium',
                                                        cam.falsePositiveRate > 30
                                                            ? 'bg-red-500/15 text-red-400'
                                                            : cam.falsePositiveRate > 15
                                                                ? 'bg-amber-500/15 text-amber-400'
                                                                : 'bg-emerald-500/15 text-emerald-400',
                                                    ].join(' ')}
                                                >
                                                    {cam.falsePositiveRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-300">
                                                {cam.avgResponseTime.toFixed(1)}m
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
