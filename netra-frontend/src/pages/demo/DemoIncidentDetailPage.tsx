import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDemoContext } from './DemoContext'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, X } from 'lucide-react'

/* ================================================================== */
/*  Types + Data                                                       */
/* ================================================================== */

type IncidentStatus = 'alerted' | 'acknowledged' | 'resolved' | 'false_positive'

interface DemoIncidentDetail {
    id: string
    threatType: string
    cameraName: string
    cameraId: string
    zoneName: string
    confidence: number
    status: IncidentStatus
    detectedAt: string
    alertedAt: string
    acknowledgedAt?: string
    resolvedAt?: string
    notes: string
    video: string
}

const DEMO_INCIDENTS_MAP: Record<string, DemoIncidentDetail> = {
    'inc-1': { id: 'inc-1', threatType: 'Chasing', cameraName: 'CAM 01 Main Gate', cameraId: 'cam01', zoneName: 'Perimeter', confidence: 0.91, status: 'resolved', detectedAt: new Date(Date.now() - 2 * 60000).toISOString(), alertedAt: new Date(Date.now() - 2 * 60000 + 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 90000).toISOString(), resolvedAt: new Date(Date.now() - 60000).toISOString(), notes: 'Security team dispatched. Subject identified and escorted.', video: '/src/assets/demo/campus_chase.mp4' },
    'inc-2': { id: 'inc-2', threatType: 'Sudden Fall', cameraName: 'CAM 02 Hostel', cameraId: 'cam02', zoneName: 'Residential', confidence: 0.87, status: 'acknowledged', detectedAt: new Date(Date.now() - 8 * 60000).toISOString(), alertedAt: new Date(Date.now() - 8 * 60000 + 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 5 * 60000).toISOString(), notes: 'Medical team alerted.', video: '/src/assets/demo/hostel_fall.mp4' },
    'inc-3': { id: 'inc-3', threatType: 'Struggling', cameraName: 'CAM 03 Parking', cameraId: 'cam03', zoneName: 'Parking', confidence: 0.83, status: 'alerted', detectedAt: new Date(Date.now() - 15 * 60000).toISOString(), alertedAt: new Date(Date.now() - 15 * 60000 + 1000).toISOString(), notes: '', video: '/src/assets/demo/parking_struggle.mp4' },
    'inc-4': { id: 'inc-4', threatType: 'Being Followed', cameraName: 'CAM 04 Metro', cameraId: 'cam04', zoneName: 'Transit', confidence: 0.89, status: 'resolved', detectedAt: new Date(Date.now() - 60 * 60000).toISOString(), alertedAt: new Date(Date.now() - 60 * 60000 + 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 55 * 60000).toISOString(), resolvedAt: new Date(Date.now() - 50 * 60000).toISOString(), notes: 'Patrol responded. Person confirmed safe.', video: '/src/assets/demo/metro_following.mp4' },
    'inc-5': { id: 'inc-5', threatType: 'Chasing', cameraName: 'CAM 01 Main Gate', cameraId: 'cam01', zoneName: 'Perimeter', confidence: 0.94, status: 'false_positive', detectedAt: new Date(Date.now() - 120 * 60000).toISOString(), alertedAt: new Date(Date.now() - 120 * 60000 + 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 118 * 60000).toISOString(), resolvedAt: new Date(Date.now() - 115 * 60000).toISOString(), notes: 'Students were playing. Marked as false positive.', video: '/src/assets/demo/campus_chase.mp4' },
    'inc-6': { id: 'inc-6', threatType: 'Sudden Fall', cameraName: 'CAM 02 Hostel', cameraId: 'cam02', zoneName: 'Residential', confidence: 0.78, status: 'resolved', detectedAt: new Date(Date.now() - 180 * 60000).toISOString(), alertedAt: new Date(Date.now() - 180 * 60000 + 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 175 * 60000).toISOString(), resolvedAt: new Date(Date.now() - 170 * 60000).toISOString(), notes: 'First aid administered on site.', video: '/src/assets/demo/hostel_fall.mp4' },
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatDateTime(iso?: string): string {
    if (!iso) return '--'
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function threatColor(type: string): string {
    const t = type.toLowerCase()
    if (t.includes('chas')) return '#ff3b3b'
    if (t.includes('fall')) return '#ffaa00'
    if (t.includes('struggl')) return '#00d4ff'
    if (t.includes('follow')) return '#c084fc'
    return '#ffaa00'
}

/* ================================================================== */
/*  Status Timeline                                                    */
/* ================================================================== */

const TIMELINE_STEPS = [
    { key: 'detected', label: 'Detected', icon: AlertTriangle },
    { key: 'alerted', label: 'Alerted', icon: Shield },
    { key: 'acknowledged', label: 'Acknowledged', icon: CheckCircle2 },
    { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
]

function statusIndex(status: IncidentStatus): number {
    const map: Record<string, number> = { alerted: 1, acknowledged: 2, resolved: 3, false_positive: 3 }
    return map[status] ?? 0
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function DemoIncidentDetailPage() {
    const navigate = useNavigate()
    const { role, id } = useParams<{ role: string; id: string }>()
    const { role: demoRole, showDemoToast } = useDemoContext()
    const prefix = `/demo/${role}`

    const baseIncident = DEMO_INCIDENTS_MAP[id || ''] || DEMO_INCIDENTS_MAP['inc-1']
    const [incident, setIncident] = useState(baseIncident)
    const [videoError, setVideoError] = useState(false)
    const [emergencyOpen, setEmergencyOpen] = useState(false)
    const [reportCopied, setReportCopied] = useState(false)

    const currentIdx = statusIndex(incident.status)
    const isViewer = demoRole === 'viewer'

    const handleAcknowledge = () => {
        if (isViewer) { showDemoToast('View only access'); return }
        setIncident(prev => ({ ...prev, status: 'acknowledged' as IncidentStatus, acknowledgedAt: new Date().toISOString() }))
    }

    const handleResolve = () => {
        if (isViewer) { showDemoToast('View only access'); return }
        setIncident(prev => ({ ...prev, status: 'resolved' as IncidentStatus, resolvedAt: new Date().toISOString() }))
    }

    const handleFalsePositive = () => {
        if (isViewer) { showDemoToast('View only access'); return }
        setIncident(prev => ({ ...prev, status: 'false_positive' as IncidentStatus, resolvedAt: new Date().toISOString() }))
    }

    const handleCopyReport = () => {
        const msg = `NETRA.AI ALERT: ${incident.threatType} detected at ${incident.cameraName}.\nConfidence: ${Math.round(incident.confidence * 100)}%. Time: ${formatDateTime(incident.detectedAt)}.\nLocation: Saveetha University Campus.\nPlease respond immediately.`
        navigator.clipboard.writeText(msg)
        setReportCopied(true)
        setTimeout(() => setReportCopied(false), 2000)
    }

    return (
        <div className="space-y-6">
            {/* Back button */}
            <button onClick={() => navigate(`${prefix}/incidents`)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
                <ArrowLeft className="h-4 w-4" />
                Back to Incidents
            </button>

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">{incident.threatType}</h1>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset" style={{ color: threatColor(incident.threatType), backgroundColor: `${threatColor(incident.threatType)}15`, borderColor: `${threatColor(incident.threatType)}40` }}>
                            {Math.round(incident.confidence * 100)}%
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400 font-mono">{incident.cameraName} / {incident.zoneName}</p>
                </div>
                <div className="flex gap-2">
                    {incident.status === 'alerted' && (
                        <button onClick={handleAcknowledge} disabled={isViewer} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed" title={isViewer ? 'View only access' : ''}>
                            Acknowledge
                        </button>
                    )}
                    {(incident.status === 'alerted' || incident.status === 'acknowledged') && (
                        <>
                            <button onClick={handleResolve} disabled={isViewer} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed" title={isViewer ? 'View only access' : ''}>
                                Resolve
                            </button>
                            <button onClick={handleFalsePositive} disabled={isViewer} className="rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed" title={isViewer ? 'View only access' : ''}>
                                False Positive
                            </button>
                        </>
                    )}
                    <button onClick={() => setEmergencyOpen(true)} className="rounded-lg bg-[#ff3b3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ff3b3b]/90">
                        Emergency
                    </button>
                </div>
            </div>

            {/* Main content: 2 columns */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Video */}
                <div className="lg:w-1/2">
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden" style={{ height: 360 }}>
                        {videoError ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/60">
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                                <p className="text-sm text-slate-600 font-mono z-10">Video unavailable</p>
                            </div>
                        ) : (
                            <video src={incident.video} autoPlay muted loop playsInline onError={() => setVideoError(true)} className="w-full h-full object-cover" />
                        )}
                    </div>
                </div>

                {/* Right: Metadata */}
                <div className="lg:w-1/2 space-y-4">
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Incident Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Threat Type</p>
                                <p className="text-white font-medium mt-1">{incident.threatType}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Camera</p>
                                <p className="text-white font-medium mt-1 font-mono">{incident.cameraName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Confidence</p>
                                <p className="font-medium mt-1" style={{ color: threatColor(incident.threatType) }}>{Math.round(incident.confidence * 100)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Zone</p>
                                <p className="text-white font-medium mt-1">{incident.zoneName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Detected At</p>
                                <p className="text-slate-300 font-mono text-xs mt-1">{formatDateTime(incident.detectedAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                                <p className="text-white font-medium mt-1">{incident.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
                            </div>
                        </div>
                        {incident.notes && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Notes</p>
                                <p className="text-sm text-slate-300">{incident.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Timeline */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">Status Timeline</h3>
                <div className="flex items-center">
                    {TIMELINE_STEPS.map((step, idx) => {
                        const isCompleted = idx <= currentIdx
                        const Icon = step.icon
                        const timeKey = step.key === 'detected' ? 'detectedAt' : step.key === 'alerted' ? 'alertedAt' : step.key === 'acknowledged' ? 'acknowledgedAt' : 'resolvedAt'
                        const time = (incident as any)[timeKey]

                        return (
                            <div key={step.key} className="flex-1 flex flex-col items-center relative">
                                {idx > 0 && (
                                    <div className={['absolute top-4 right-1/2 w-full h-[2px]', isCompleted ? 'bg-emerald-500' : 'bg-white/10'].join(' ')} style={{ transform: 'translateX(-50%)' }} />
                                )}
                                <div className={['relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition', isCompleted ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20 bg-slate-800'].join(' ')}>
                                    <Icon className={['h-4 w-4', isCompleted ? 'text-emerald-400' : 'text-slate-500'].join(' ')} />
                                </div>
                                <p className={['mt-2 text-xs font-medium', isCompleted ? 'text-white' : 'text-slate-500'].join(' ')}>{step.label}</p>
                                <p className="text-[10px] text-slate-600 font-mono mt-0.5">{time ? formatDateTime(time) : '--'}</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Emergency Modal */}
            {emergencyOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-xl p-7">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-bold text-[#ff3b3b] tracking-wider uppercase">Emergency Response</h2>
                            <button onClick={() => { setEmergencyOpen(false); setReportCopied(false) }} className="text-gray-500 hover:text-white transition p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="bg-black/40 rounded-lg border border-white/10 p-4 mb-5">
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Threat</span><p className="text-[#ff3b3b] font-semibold mt-1">{incident.threatType}</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Camera</span><p className="text-white font-semibold mt-1">{incident.cameraName}</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Confidence</span><p className="text-[#ffaa00] font-semibold mt-1">{Math.round(incident.confidence * 100)}%</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Time</span><p className="text-white font-semibold mt-1">{formatDateTime(incident.detectedAt)}</p></div>
                            </div>
                        </div>
                        <div className="flex gap-3 mb-5">
                            <button onClick={() => window.open('tel:100')} className="flex-1 py-3.5 rounded-lg bg-[#ff3b3b] text-white text-sm font-bold border-none cursor-pointer">Call Police — 100</button>
                            <button onClick={() => window.open('tel:108')} className="flex-1 py-3.5 rounded-lg bg-[#ffaa00] text-black text-sm font-bold border-none cursor-pointer">Call Ambulance — 108</button>
                        </div>
                        <button onClick={handleCopyReport} className="w-full py-3 rounded-lg bg-white/5 text-white text-xs font-semibold border border-white/10 cursor-pointer mb-3">
                            {reportCopied ? 'Report Copied to Clipboard' : 'Send Incident Report'}
                        </button>
                        <div className="bg-black/30 rounded-md p-3 text-[10px] font-mono text-gray-400 leading-relaxed mb-4">
                            NETRA.AI ALERT: {incident.threatType} detected at {incident.cameraName}.<br />
                            Confidence: {Math.round(incident.confidence * 100)}%. Time: {formatDateTime(incident.detectedAt)}.<br />
                            Location: Saveetha University Campus. Please respond immediately.
                        </div>
                        <p className="text-[9px] text-gray-600 text-center">Emergency dispatch is the sole responsibility of the operator. Netra.AI provides detection and notification only.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
