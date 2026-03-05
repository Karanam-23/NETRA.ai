import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    ArrowLeft,
    CheckCircle2,
    Shield,
    XCircle,
    AlertTriangle,
    Clock,
    Camera,
    MapPin,
    Gauge,
    Loader2,
    Send,
    UserPlus,
} from 'lucide-react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type IncidentStatus = 'detected' | 'alerted' | 'acknowledged' | 'resolved' | 'false_positive'

interface IncidentDetail {
    id: string
    threatType: string
    cameraName: string
    cameraId: string
    zoneName: string
    confidence: number
    status: IncidentStatus
    detectedAt: string
    alertedAt?: string
    acknowledgedAt?: string
    resolvedAt?: string
    snapshotUrl?: string
    clipUrl?: string
    notes?: string
    assignedTo?: string
}

interface OrgMember {
    uid: string
    email: string
    displayName: string
    role: string
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatDateTime(iso?: string): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })
}

function threatColor(type: string): string {
    const t = type.toLowerCase()
    if (t.includes('intrusion') || t.includes('weapon') || t.includes('assault'))
        return 'bg-red-500/15 text-red-400 ring-red-500/25'
    if (t.includes('fire') || t.includes('smoke'))
        return 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
    if (t.includes('loitering') || t.includes('crowd') || t.includes('suspicious'))
        return 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
    return 'bg-slate-500/15 text-slate-400 ring-slate-500/25'
}

/* ================================================================== */
/*  Status Timeline                                                    */
/* ================================================================== */

const TIMELINE_STEPS: { key: IncidentStatus; label: string; icon: React.ElementType }[] = [
    { key: 'detected', label: 'Detected', icon: AlertTriangle },
    { key: 'alerted', label: 'Alerted', icon: Shield },
    { key: 'acknowledged', label: 'Acknowledged', icon: CheckCircle2 },
    { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
]

function statusIndex(status: IncidentStatus): number {
    if (status === 'false_positive') return 4
    const idx = TIMELINE_STEPS.findIndex((s) => s.key === status)
    return idx >= 0 ? idx : 0
}

function StatusTimeline({
    incident,
}: {
    incident: IncidentDetail
}) {
    const currentIdx = statusIndex(incident.status)
    const isFalsePositive = incident.status === 'false_positive'

    const timestamps: Record<string, string | undefined> = {
        detected: incident.detectedAt,
        alerted: incident.alertedAt,
        acknowledged: incident.acknowledgedAt,
        resolved: incident.resolvedAt,
    }

    return (
        <div className="space-y-1">
            <h3 className="mb-4 text-sm font-semibold text-white">Status Timeline</h3>

            {isFalsePositive && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-500/10 px-3 py-2 text-xs text-slate-400 ring-1 ring-inset ring-slate-500/20">
                    <XCircle className="h-4 w-4" />
                    Marked as False Positive
                </div>
            )}

            <div className="relative pl-6">
                {TIMELINE_STEPS.map((step, i) => {
                    const completed = i <= currentIdx && !isFalsePositive
                    const active = i === currentIdx && !isFalsePositive
                    const Icon = step.icon

                    return (
                        <div key={step.key} className="relative pb-6 last:pb-0">
                            {/* Connector line */}
                            {i < TIMELINE_STEPS.length - 1 && (
                                <div
                                    className={[
                                        'absolute left-[-14px] top-7 h-full w-0.5',
                                        i < currentIdx && !isFalsePositive
                                            ? 'bg-netra-600'
                                            : 'bg-slate-800',
                                    ].join(' ')}
                                />
                            )}

                            {/* Circle */}
                            <div
                                className={[
                                    'absolute left-[-22px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full',
                                    completed
                                        ? 'bg-netra-600 text-white'
                                        : 'bg-slate-800 text-slate-600 ring-1 ring-white/10',
                                    active ? 'ring-2 ring-netra-500 shadow-md shadow-netra-500/20' : '',
                                ].join(' ')}
                            >
                                <Icon className="h-3 w-3" />
                            </div>

                            {/* Content */}
                            <div>
                                <p
                                    className={[
                                        'text-sm font-medium',
                                        completed ? 'text-white' : 'text-slate-600',
                                    ].join(' ')}
                                >
                                    {step.label}
                                </p>
                                {timestamps[step.key] && (
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {formatDateTime(timestamps[step.key])}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function IncidentDetailPage() {
    const { id: incidentId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { orgId } = useAuthStore()
    const queryClient = useQueryClient()

    const [notes, setNotes] = useState('')
    const [notesLoaded, setNotesLoaded] = useState(false)
    const [assignee, setAssignee] = useState('')
    const [savingNotes, setSavingNotes] = useState(false)

    /* ---- Fetch incident ---- */
    const {
        data: incident,
        isLoading,
    } = useQuery<IncidentDetail>({
        queryKey: ['incident', orgId, incidentId],
        queryFn: async () => {
            const { data } = await apiClient.get(
                `/incidents/${orgId}/${incidentId}`
            )
            return data
        },
        enabled: !!orgId && !!incidentId,
    })

    // Populate notes once when data loads
    if (incident && !notesLoaded) {
        setNotes(incident.notes ?? '')
        setAssignee(incident.assignedTo ?? '')
        setNotesLoaded(true)
    }

    /* ---- Fetch org members (responders) ---- */
    const { data: members } = useQuery<OrgMember[]>({
        queryKey: ['org-members', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/org/${orgId}/members`)
            return data
        },
        enabled: !!orgId,
        placeholderData: [],
    })

    const responders = (members ?? []).filter(
        (m) => m.role === 'responder' || m.role === 'operator' || m.role === 'org_admin'
    )

    /* ---- Action mutations ---- */
    const patchMutation = useMutation({
        mutationFn: async (payload: Record<string, any>) => {
            await apiClient.patch(
                `/incidents/${orgId}/${incidentId}`,
                payload
            )
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['incident', orgId, incidentId],
            })
        },
    })

    const handleAcknowledge = () => patchMutation.mutate({ status: 'acknowledged' })
    const handleResolve = () => patchMutation.mutate({ status: 'resolved' })
    const handleFalsePositive = () => patchMutation.mutate({ status: 'false_positive' })

    const handleSaveNotes = async () => {
        setSavingNotes(true)
        try {
            await apiClient.patch(`/incidents/${orgId}/${incidentId}`, {
                notes,
                assignedTo: assignee || undefined,
            })
            queryClient.invalidateQueries({
                queryKey: ['incident', orgId, incidentId],
            })
        } finally {
            setSavingNotes(false)
        }
    }

    /* ---- Loading / error ---- */
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-6 w-6 animate-spin text-netra-400" />
            </div>
        )
    }

    if (!incident) {
        return (
            <div className="py-20 text-center">
                <p className="text-sm text-slate-400">Incident not found.</p>
                <button
                    onClick={() => navigate('/incidents')}
                    className="mt-4 text-sm text-netra-400 hover:text-netra-300"
                >
                    Back to Incidents
                </button>
            </div>
        )
    }

    /* ================================================================ */
    /*  Render                                                           */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* Back button */}
            <button
                onClick={() => navigate('/incidents')}
                className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Incidents
            </button>

            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                    Incident #{incidentId?.slice(0, 8)}
                </h1>
                <span
                    className={[
                        'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                        threatColor(incident.threatType),
                    ].join(' ')}
                >
                    {incident.threatType}
                </span>
            </div>

            {/* Main content: 2-column layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* LEFT: Media (60%) */}
                <div className="space-y-4 lg:col-span-3">
                    {/* Snapshot */}
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60">
                        <div className="border-b border-white/5 px-5 py-3">
                            <h3 className="text-sm font-semibold text-white">
                                Snapshot
                            </h3>
                        </div>
                        <div className="aspect-video bg-slate-800">
                            {incident.snapshotUrl ? (
                                <img
                                    src={incident.snapshotUrl}
                                    alt="Incident snapshot"
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <Camera className="h-12 w-12 text-slate-700" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Video clip */}
                    {incident.clipUrl && (
                        <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60">
                            <div className="border-b border-white/5 px-5 py-3">
                                <h3 className="text-sm font-semibold text-white">
                                    Video Clip
                                </h3>
                            </div>
                            <div className="aspect-video bg-black">
                                <video
                                    src={incident.clipUrl}
                                    controls
                                    className="h-full w-full"
                                    preload="metadata"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        </div>
                    )}

                    {/* Operator notes */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                        <h3 className="mb-3 text-sm font-semibold text-white">
                            Operator Notes
                        </h3>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                            placeholder="Add notes about this incident…"
                            className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20 resize-none"
                        />

                        {/* Assign responder */}
                        <div className="mt-4 flex flex-wrap items-end gap-3">
                            <div className="flex-1 space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Assign Responder
                                </label>
                                <select
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                                >
                                    <option value="">Unassigned</option>
                                    {responders.map((m) => (
                                        <option key={m.uid} value={m.uid}>
                                            {m.displayName || m.email} ({m.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleSaveNotes}
                                disabled={savingNotes}
                                className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500 disabled:opacity-60"
                            >
                                {savingNotes ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Save
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Metadata + Timeline + Actions (40%) */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Metadata */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                        <h3 className="mb-4 text-sm font-semibold text-white">
                            Incident Details
                        </h3>
                        <dl className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <dt className="flex items-center gap-2 text-slate-400">
                                    <AlertTriangle className="h-4 w-4" /> Threat
                                </dt>
                                <dd className="font-medium text-white">
                                    {incident.threatType}
                                </dd>
                            </div>
                            <div className="border-t border-white/5" />
                            <div className="flex items-center justify-between text-sm">
                                <dt className="flex items-center gap-2 text-slate-400">
                                    <Camera className="h-4 w-4" /> Camera
                                </dt>
                                <dd className="font-medium text-white">
                                    {incident.cameraName}
                                </dd>
                            </div>
                            <div className="border-t border-white/5" />
                            <div className="flex items-center justify-between text-sm">
                                <dt className="flex items-center gap-2 text-slate-400">
                                    <MapPin className="h-4 w-4" /> Zone
                                </dt>
                                <dd className="font-medium text-white">
                                    {incident.zoneName}
                                </dd>
                            </div>
                            <div className="border-t border-white/5" />
                            <div className="flex items-center justify-between text-sm">
                                <dt className="flex items-center gap-2 text-slate-400">
                                    <Gauge className="h-4 w-4" /> Confidence
                                </dt>
                                <dd className="font-medium text-white">
                                    {Math.round(incident.confidence * 100)}%
                                </dd>
                            </div>
                            <div className="border-t border-white/5" />
                            <div className="flex items-center justify-between text-sm">
                                <dt className="flex items-center gap-2 text-slate-400">
                                    <Clock className="h-4 w-4" /> Detected
                                </dt>
                                <dd className="text-xs font-medium text-white">
                                    {formatDateTime(incident.detectedAt)}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Timeline */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                        <StatusTimeline incident={incident} />
                    </div>

                    {/* Action buttons */}
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                        <h3 className="mb-4 text-sm font-semibold text-white">
                            Actions
                        </h3>
                        <div className="space-y-2">
                            {(incident.status === 'detected' ||
                                incident.status === 'alerted') && (
                                    <button
                                        onClick={handleAcknowledge}
                                        disabled={patchMutation.isPending}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20 transition hover:bg-amber-500/20 disabled:opacity-60"
                                    >
                                        {patchMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                        )}
                                        Acknowledge
                                    </button>
                                )}

                            {incident.status !== 'resolved' &&
                                incident.status !== 'false_positive' && (
                                    <button
                                        onClick={handleResolve}
                                        disabled={patchMutation.isPending}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20 transition hover:bg-emerald-500/20 disabled:opacity-60"
                                    >
                                        {patchMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Shield className="h-4 w-4" />
                                        )}
                                        Mark Resolved
                                    </button>
                                )}

                            {incident.status !== 'false_positive' &&
                                incident.status !== 'resolved' && (
                                    <button
                                        onClick={handleFalsePositive}
                                        disabled={patchMutation.isPending}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-500/10 px-4 py-2.5 text-sm font-semibold text-slate-400 ring-1 ring-inset ring-slate-500/20 transition hover:bg-slate-500/20 disabled:opacity-60"
                                    >
                                        {patchMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <XCircle className="h-4 w-4" />
                                        )}
                                        Mark False Positive
                                    </button>
                                )}

                            {(incident.status === 'resolved' ||
                                incident.status === 'false_positive') && (
                                    <div className="rounded-lg bg-emerald-500/5 px-4 py-3 text-center text-sm text-emerald-400">
                                        This incident has been{' '}
                                        {incident.status === 'resolved'
                                            ? 'resolved'
                                            : 'marked as false positive'}
                                        .
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
