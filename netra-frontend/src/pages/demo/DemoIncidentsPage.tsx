import { useNavigate, useParams } from 'react-router-dom'
import { useDemoContext } from './DemoContext'
import { Filter, Download } from 'lucide-react'

/* ================================================================== */
/*  Types + Data                                                       */
/* ================================================================== */

type IncidentStatus = 'alerted' | 'acknowledged' | 'resolved' | 'false_positive'

interface DemoIncident {
    id: string
    threatType: string
    cameraName: string
    zoneName: string
    confidence: number
    status: IncidentStatus
    detectedAt: string
}

const DEMO_INCIDENTS: DemoIncident[] = [
    { id: 'inc-1', threatType: 'Chasing', cameraName: 'CAM 01 Main Gate', zoneName: 'Perimeter', confidence: 0.91, status: 'resolved', detectedAt: new Date(Date.now() - 2 * 60000).toISOString() },
    { id: 'inc-2', threatType: 'Sudden Fall', cameraName: 'CAM 02 Hostel', zoneName: 'Residential', confidence: 0.87, status: 'acknowledged', detectedAt: new Date(Date.now() - 8 * 60000).toISOString() },
    { id: 'inc-3', threatType: 'Struggling', cameraName: 'CAM 03 Parking', zoneName: 'Parking', confidence: 0.83, status: 'alerted', detectedAt: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 'inc-4', threatType: 'Being Followed', cameraName: 'CAM 04 Metro', zoneName: 'Transit', confidence: 0.89, status: 'resolved', detectedAt: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: 'inc-5', threatType: 'Chasing', cameraName: 'CAM 01 Main Gate', zoneName: 'Perimeter', confidence: 0.94, status: 'false_positive', detectedAt: new Date(Date.now() - 120 * 60000).toISOString() },
    { id: 'inc-6', threatType: 'Sudden Fall', cameraName: 'CAM 02 Hostel', zoneName: 'Residential', confidence: 0.78, status: 'resolved', detectedAt: new Date(Date.now() - 180 * 60000).toISOString() },
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
    if (t.includes('chas')) return 'bg-red-500/15 text-red-400 ring-red-500/25'
    if (t.includes('fall')) return 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
    if (t.includes('struggl')) return 'bg-blue-500/15 text-blue-400 ring-blue-500/25'
    if (t.includes('follow')) return 'bg-purple-500/15 text-purple-400 ring-purple-500/25'
    return 'bg-slate-500/15 text-slate-400 ring-slate-500/25'
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatStatus(s: string): string {
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function DemoIncidentsPage() {
    const navigate = useNavigate()
    const { role } = useParams<{ role: string }>()
    const { showDemoToast } = useDemoContext()
    const prefix = `/demo/${role}`

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Incidents</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {DEMO_INCIDENTS.length} total incidents
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => showDemoToast()}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => showDemoToast()}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                    >
                        <Download className="h-4 w-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-sm">
                <Filter className="hidden h-5 w-5 text-slate-500 sm:block" />
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Status</label>
                    <select
                        onChange={() => showDemoToast()}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none"
                        defaultValue="all"
                    >
                        <option value="all">All</option>
                        <option value="alerted">Alerted</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                        <option value="false_positive">False Positive</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Threat Type</label>
                    <select
                        onChange={() => showDemoToast()}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none"
                        defaultValue="All"
                    >
                        <option>All</option>
                        <option>Chasing</option>
                        <option>Sudden Fall</option>
                        <option>Struggling</option>
                        <option>Being Followed</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">From</label>
                    <input
                        type="date"
                        onChange={() => showDemoToast()}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">To</label>
                    <input
                        type="date"
                        onChange={() => showDemoToast()}
                        className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">Threat Type</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">Camera</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden md:table-cell">Zone</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden lg:table-cell">Confidence</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">Status</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden sm:table-cell">Detected</th>
                                <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DEMO_INCIDENTS.map(inc => (
                                <tr
                                    key={inc.id}
                                    onClick={() => navigate(`${prefix}/incidents/${inc.id}`)}
                                    className="cursor-pointer border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                                >
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <span className={['inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', threatBadge(inc.threatType)].join(' ')}>
                                            {inc.threatType}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-white">{inc.cameraName}</td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 hidden md:table-cell">{inc.zoneName}</td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 hidden lg:table-cell">{Math.round(inc.confidence * 100)}%</td>
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <span className={['inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', statusBadge(inc.status)].join(' ')}>
                                            {formatStatus(inc.status)}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 hidden sm:table-cell">{formatDate(inc.detectedAt)}</td>
                                    <td className="whitespace-nowrap px-5 py-3.5">
                                        <button
                                            onClick={e => { e.stopPropagation(); navigate(`${prefix}/incidents/${inc.id}`) }}
                                            className="text-xs font-medium text-netra-400 hover:text-netra-300 transition"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
