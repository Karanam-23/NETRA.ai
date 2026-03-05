import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    Filter,
    Download,
    ChevronLeft,
    ChevronRight,
    ShieldOff,
    Loader2,
    Video,
    Clock,
    MapPin,
    Shield,
    CheckCircle2,
    XCircle,
} from 'lucide-react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type IncidentStatus = 'alerted' | 'acknowledged' | 'resolved' | 'false_positive'

interface Incident {
    id: string
    threatType: string
    cameraName: string
    zoneName: string
    confidence: number
    status: IncidentStatus
    detectedAt: string // ISO
    acknowledgedAt?: string
    resolvedAt?: string
}

interface PaginatedResponse {
    items: Incident[]
    total: number
    page: number
    pageSize: number
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const PAGE_SIZE = 20
const STATUS_OPTIONS: { label: string; value: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Alerted', value: 'alerted' },
    { label: 'Acknowledged', value: 'acknowledged' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'False Positive', value: 'false_positive' },
]

const THREAT_OPTIONS = [
    'All',
    'Intrusion',
    'Fire',
    'Loitering',
    'Vehicle',
    'Crowd',
    'Weapon',
    'Suspicious',
]

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function statusBadge(status: IncidentStatus) {
    const map: Record<IncidentStatus, string> = {
        alerted: 'bg-red-500/15 text-red-400 ring-red-500/25',
        acknowledged: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
        resolved: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
        false_positive: 'bg-slate-500/15 text-slate-400 ring-slate-500/25',
    }
    return map[status] ?? map.alerted
}

function threatBadge(type: string) {
    const t = type.toLowerCase()
    if (t.includes('intrusion') || t.includes('weapon') || t.includes('assault'))
        return 'bg-red-500/15 text-red-400 ring-red-500/25'
    if (t.includes('fire') || t.includes('smoke'))
        return 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
    if (t.includes('loitering') || t.includes('crowd') || t.includes('suspicious'))
        return 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
    if (t.includes('vehicle') || t.includes('parking'))
        return 'bg-blue-500/15 text-blue-400 ring-blue-500/25'
    return 'bg-slate-500/15 text-slate-400 ring-slate-500/25'
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatStatus(s: string): string {
    return s
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function IncidentsPage() {
    const navigate = useNavigate()
    const { orgId } = useAuthStore()

    /* ---- Filter state ---- */
    const [statusFilter, setStatusFilter] = useState('all')
    const [threatFilter, setThreatFilter] = useState('All')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [page, setPage] = useState(1)
    const [exporting, setExporting] = useState(false)

    /* ---- Fetch incidents ---- */
    const queryParams = useMemo(() => {
        const p: Record<string, string> = {
            page: String(page),
            pageSize: String(PAGE_SIZE),
        }
        if (statusFilter !== 'all') p.status = statusFilter
        if (threatFilter !== 'All') p.threatType = threatFilter
        if (dateFrom) p.dateFrom = dateFrom
        if (dateTo) p.dateTo = dateTo
        return p
    }, [page, statusFilter, threatFilter, dateFrom, dateTo])

    const { data, isLoading } = useQuery<PaginatedResponse>({
        queryKey: ['incidents', orgId, queryParams],
        queryFn: async () => {
            const { data } = await apiClient.get(`/ incidents / ${orgId} `, {
                params: queryParams,
            })
            // Normalise: API might return items directly or wrapped
            if (Array.isArray(data))
                return { items: data, total: data.length, page: 1, pageSize: PAGE_SIZE }
            return data
        },
        enabled: !!orgId,
        placeholderData: { items: [], total: 0, page: 1, pageSize: PAGE_SIZE },
    })

    const incidents = data?.items ?? []
    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    /* ---- Export CSV ---- */
    const handleExport = async () => {
        setExporting(true)
        try {
            const res = await apiClient.get(`/ incidents / ${orgId}/export`, {
                responseType: 'blob',
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = `incidents-${orgId}-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch {
            // silently ignore for now
        } finally {
            setExporting(false)
        }
    }

    /* ---- Reset page on filter change ---- */
    const applyFilter = (setter: (v: any) => void, value: any) => {
        setter(value)
        setPage(1)
    }

    /* ================================================================ */
    /*  Render                                                           */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Incidents</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {total} total incident{total !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                    {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Export CSV
                </button>
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-sm">
                <Filter className="hidden h-5 w-5 text-slate-500 sm:block" />

                {/* Status filter */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => applyFilter(setStatusFilter, e.target.value)}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                    >
                        {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Threat type filter */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Threat Type</label>
                    <select
                        value={threatFilter}
                        onChange={(e) => applyFilter(setThreatFilter, e.target.value)}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                    >
                        {THREAT_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date range */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => applyFilter(setDateFrom, e.target.value)}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => applyFilter(setDateTo, e.target.value)}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                    Threat Type
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                    Camera
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden md:table-cell">
                                    Zone
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden lg:table-cell">
                                    Confidence
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                    Status
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden sm:table-cell">
                                    Detected
                                </th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-netra-400" />
                                    </td>
                                </tr>
                            ) : incidents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center">
                                        <ShieldOff className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                                        <p className="text-sm font-medium text-slate-400">
                                            No incidents found
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            Adjust filters or check back later
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                incidents.map((inc) => (
                                    <tr
                                        key={inc.id}
                                        onClick={() => navigate(`/incidents/${inc.id}`)}
                                        className="cursor-pointer border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                                    >
                                        {/* Threat */}
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <span
                                                className={[
                                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                    threatBadge(inc.threatType),
                                                ].join(' ')}
                                            >
                                                {inc.threatType}
                                            </span>
                                        </td>
                                        {/* Camera */}
                                        <td className="whitespace-nowrap px-5 py-3.5 font-medium text-white">
                                            {inc.cameraName}
                                        </td>
                                        {/* Zone */}
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 hidden md:table-cell">
                                            {inc.zoneName}
                                        </td>
                                        {/* Confidence */}
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 hidden lg:table-cell">
                                            {Math.round(inc.confidence * 100)}%
                                        </td>
                                        {/* Status */}
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <span
                                                className={[
                                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                    statusBadge(inc.status),
                                                ].join(' ')}
                                            >
                                                {formatStatus(inc.status)}
                                            </span>
                                        </td>
                                        {/* Detected at */}
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 hidden sm:table-cell">
                                            {formatDate(inc.detectedAt)}
                                        </td>
                                        {/* Action */}
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(`/incidents/${inc.id}`)
                                                }}
                                                className="text-xs font-medium text-netra-400 hover:text-netra-300 transition"
                                            >
                                                View →
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
                        <p className="text-xs text-slate-500">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>

                            {/* Page number pills */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pn: number
                                if (totalPages <= 5) {
                                    pn = i + 1
                                } else if (page <= 3) {
                                    pn = i + 1
                                } else if (page >= totalPages - 2) {
                                    pn = totalPages - 4 + i
                                } else {
                                    pn = page - 2 + i
                                }
                                return (
                                    <button
                                        key={pn}
                                        onClick={() => setPage(pn)}
                                        className={[
                                            'min-w-[32px] rounded-lg px-2 py-1 text-xs font-medium transition',
                                            pn === page
                                                ? 'bg-netra-600/30 text-netra-400'
                                                : 'text-slate-500 hover:bg-white/5 hover:text-white',
                                        ].join(' ')}
                                    >
                                        {pn}
                                    </button>
                                )
                            })}

                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
