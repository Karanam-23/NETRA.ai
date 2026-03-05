import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    Bell,
    Users,
    Building2,
    Save,
    Loader2,
    Plus,
    Trash2,
    Send,
    X,
    AlertTriangle,
    Crown,
    Zap,
} from 'lucide-react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

const TABS = ['Alerts', 'Team', 'Organization'] as const
type TabName = (typeof TABS)[number]

const TAB_ICONS: Record<TabName, React.ElementType> = {
    Alerts: Bell,
    Team: Users,
    Organization: Building2,
}

interface AlertConfig {
    thresholds: Record<string, number>
    escalationTimeout: number
    dedupWindow: number
}

interface OrgMember {
    uid: string
    email: string
    displayName: string
    role: string
    notifyViaSMS: boolean
}

interface OrgInfo {
    name: string
    plan: 'Starter' | 'Pro' | 'Enterprise'
    cameraCount: number
    cameraLimit: number
}

/* ================================================================== */
/*  Tab bar                                                            */
/* ================================================================== */

function TabBar({
    active,
    onChange,
}: {
    active: TabName
    onChange: (t: TabName) => void
}) {
    return (
        <div className="flex gap-1 rounded-xl border border-white/5 bg-slate-900/60 p-1 backdrop-blur-sm">
            {TABS.map((tab) => {
                const Icon = TAB_ICONS[tab]
                const isActive = tab === active
                return (
                    <button
                        key={tab}
                        onClick={() => onChange(tab)}
                        className={[
                            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition',
                            isActive
                                ? 'bg-netra-600/20 text-netra-400 shadow-sm'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                        ].join(' ')}
                    >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab}</span>
                    </button>
                )
            })}
        </div>
    )
}

/* ================================================================== */
/*  Tab 1: Alerts                                                      */
/* ================================================================== */

const THREAT_TYPES = ['Fall', 'Chasing', 'Struggle', 'Zone']

function AlertsTab({ orgId }: { orgId: string }) {
    const queryClient = useQueryClient()
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testCameraId, setTestCameraId] = useState('')
    const [success, setSuccess] = useState<string | null>(null)

    const { data: config } = useQuery<AlertConfig>({
        queryKey: ['alert-config', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/alerts/config/${orgId}`)
            return data
        },
        placeholderData: {
            thresholds: { Fall: 0.7, Chasing: 0.6, Struggle: 0.65, Zone: 0.5 },
            escalationTimeout: 300,
            dedupWindow: 60,
        },
    })

    const [thresholds, setThresholds] = useState<Record<string, number>>(
        config?.thresholds ?? { Fall: 0.7, Chasing: 0.6, Struggle: 0.65, Zone: 0.5 }
    )
    const [escalationTimeout, setEscalationTimeout] = useState(
        config?.escalationTimeout ?? 300
    )
    const [dedupWindow, setDedupWindow] = useState(config?.dedupWindow ?? 60)

    // Sync when data loads
    if (
        config &&
        JSON.stringify(thresholds) !==
        JSON.stringify(config.thresholds) &&
        !saving
    ) {
        // Only sync on first load
    }

    const handleSave = async () => {
        setSaving(true)
        setSuccess(null)
        try {
            await apiClient.put(`/alerts/config/${orgId}`, {
                thresholds,
                escalationTimeout,
                dedupWindow,
            })
            queryClient.invalidateQueries({ queryKey: ['alert-config', orgId] })
            setSuccess('Alert configuration saved successfully.')
        } catch {
            // silently
        } finally {
            setSaving(false)
        }
    }

    const handleTestAlert = async () => {
        if (!testCameraId) return
        setTesting(true)
        try {
            await apiClient.post(`/alerts/test/${testCameraId}`)
            setSuccess('Test alert sent!')
        } catch {
            // silently
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="space-y-6">
            {success && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    {success}
                </div>
            )}

            {/* Confidence thresholds */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-sm">
                <h3 className="mb-5 text-sm font-semibold text-white">
                    Confidence Thresholds per Threat Type
                </h3>
                <div className="space-y-5">
                    {THREAT_TYPES.map((type) => (
                        <div key={type}>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">
                                    {type}
                                </label>
                                <span className="text-sm font-semibold text-netra-400">
                                    {Math.round((thresholds[type] ?? 0.5) * 100)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={thresholds[type] ?? 0.5}
                                onChange={(e) =>
                                    setThresholds((prev) => ({
                                        ...prev,
                                        [type]: parseFloat(e.target.value),
                                    }))
                                }
                                className="w-full accent-netra-500"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Escalation + Dedup */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-sm">
                    <label className="block text-sm font-semibold text-white">
                        Escalation Timeout
                    </label>
                    <p className="mb-3 text-xs text-slate-500">
                        Seconds before an unacknowledged alert is escalated
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={30}
                            max={3600}
                            value={escalationTimeout}
                            onChange={(e) =>
                                setEscalationTimeout(parseInt(e.target.value) || 300)
                            }
                            className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition focus:border-netra-500"
                        />
                        <span className="text-sm text-slate-500">sec</span>
                    </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-sm">
                    <label className="block text-sm font-semibold text-white">
                        Dedup Window
                    </label>
                    <p className="mb-3 text-xs text-slate-500">
                        Seconds to suppress duplicate alerts from same camera
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={10}
                            max={600}
                            value={dedupWindow}
                            onChange={(e) =>
                                setDedupWindow(parseInt(e.target.value) || 60)
                            }
                            className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition focus:border-netra-500"
                        />
                        <span className="text-sm text-slate-500">sec</span>
                    </div>
                </div>
            </div>

            {/* Save + Test */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-netra-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500 disabled:opacity-60"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Configuration
                </button>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Camera ID"
                        value={testCameraId}
                        onChange={(e) => setTestCameraId(e.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-netra-500"
                    />
                    <button
                        onClick={handleTestAlert}
                        disabled={testing || !testCameraId}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        Send Test Alert
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Tab 2: Team                                                        */
/* ================================================================== */

function TeamTab({ orgId }: { orgId: string }) {
    const queryClient = useQueryClient()
    const { uid } = useAuthStore()

    const [inviting, setInviting] = useState(false)
    const [showInvite, setShowInvite] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('operator')
    const [removing, setRemoving] = useState<string | null>(null)

    const { data: members } = useQuery<OrgMember[]>({
        queryKey: ['org-members', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/org/${orgId}/members`)
            return data
        },
        placeholderData: [],
    })

    const memberList = members ?? []
    const adminCount = memberList.filter((m) => m.role === 'org_admin').length

    const handleInvite = async () => {
        if (!inviteEmail) return
        setInviting(true)
        try {
            await apiClient.post('/org/members/invite', {
                email: inviteEmail,
                role: inviteRole,
                orgId,
            })
            setInviteEmail('')
            setShowInvite(false)
            queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
        } catch {
            // silently
        } finally {
            setInviting(false)
        }
    }

    const handleRemove = async (memberUid: string) => {
        setRemoving(memberUid)
        try {
            await apiClient.delete(`/org/${orgId}/members/${memberUid}`)
            queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
        } catch {
            // silently
        } finally {
            setRemoving(null)
        }
    }

    const handleToggleSMS = async (memberUid: string, current: boolean) => {
        try {
            await apiClient.patch(`/org/${orgId}/members/${memberUid}`, {
                notifyViaSMS: !current,
            })
            queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
        } catch {
            // silently
        }
    }

    const roleBadge = (role: string) => {
        const map: Record<string, string> = {
            super_admin: 'bg-red-500/15 text-red-400',
            org_admin: 'bg-amber-500/15 text-amber-400',
            operator: 'bg-netra-500/15 text-netra-400',
            responder: 'bg-emerald-500/15 text-emerald-400',
            viewer: 'bg-slate-500/15 text-slate-400',
        }
        return map[role] ?? map.viewer
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                    Team Members ({memberList.length})
                </h3>
                <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-netra-500"
                >
                    <Plus className="h-4 w-4" />
                    Invite Member
                </button>
            </div>

            {/* Invite form */}
            {showInvite && (
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-netra-500/20 bg-netra-600/5 p-4">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-slate-500">
                            Email
                        </label>
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-netra-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">
                            Role
                        </label>
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="block rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-netra-500"
                        >
                            <option value="org_admin">Org Admin</option>
                            <option value="operator">Operator</option>
                            <option value="responder">Responder</option>
                            <option value="viewer">Viewer</option>
                        </select>
                    </div>
                    <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail}
                        className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-netra-500 disabled:opacity-60"
                    >
                        {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Send
                    </button>
                    <button
                        onClick={() => setShowInvite(false)}
                        className="rounded-lg p-2 text-slate-400 hover:text-white transition"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Members table */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-5 py-3.5 font-medium text-slate-400">
                                    Name
                                </th>
                                <th className="px-5 py-3.5 font-medium text-slate-400 hidden sm:table-cell">
                                    Email
                                </th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">
                                    Role
                                </th>
                                <th className="px-5 py-3.5 font-medium text-slate-400 hidden md:table-cell">
                                    SMS
                                </th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberList.map((m) => {
                                const isSelf = m.uid === uid
                                const isLastAdmin =
                                    m.role === 'org_admin' && adminCount <= 1
                                const canRemove = !isSelf && !isLastAdmin

                                return (
                                    <tr
                                        key={m.uid}
                                        className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                                    >
                                        <td className="whitespace-nowrap px-5 py-3.5 font-medium text-white">
                                            {m.displayName || '—'}
                                            {isSelf && (
                                                <span className="ml-1.5 text-xs text-slate-500">
                                                    (you)
                                                </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 hidden sm:table-cell">
                                            {m.email}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <span
                                                className={[
                                                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                                    roleBadge(m.role),
                                                ].join(' ')}
                                            >
                                                {m.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 hidden md:table-cell">
                                            <button
                                                onClick={() =>
                                                    handleToggleSMS(m.uid, m.notifyViaSMS)
                                                }
                                                className={[
                                                    'relative h-5 w-9 rounded-full transition',
                                                    m.notifyViaSMS
                                                        ? 'bg-netra-600'
                                                        : 'bg-slate-700',
                                                ].join(' ')}
                                                aria-label="Toggle SMS"
                                            >
                                                <span
                                                    className={[
                                                        'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                                                        m.notifyViaSMS
                                                            ? 'translate-x-4'
                                                            : 'translate-x-0',
                                                    ].join(' ')}
                                                />
                                            </button>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            {canRemove ? (
                                                <button
                                                    onClick={() => handleRemove(m.uid)}
                                                    disabled={removing === m.uid}
                                                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                                                    aria-label="Remove member"
                                                >
                                                    {removing === m.uid ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-600">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Tab 3: Organization                                                */
/* ================================================================== */

function OrgTab({ orgId }: { orgId: string }) {
    const queryClient = useQueryClient()
    const [saving, setSaving] = useState(false)
    const [showDelete, setShowDelete] = useState(false)

    const { data: orgInfo } = useQuery<OrgInfo>({
        queryKey: ['org-info', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/org/${orgId}`)
            return data
        },
        placeholderData: {
            name: orgId,
            plan: 'Starter',
            cameraCount: 0,
            cameraLimit: 5,
        },
    })

    const info = orgInfo!
    const [orgName, setOrgName] = useState(info.name)

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiClient.put(`/org/${orgId}`, { name: orgName })
            queryClient.invalidateQueries({ queryKey: ['org-info', orgId] })
        } catch {
            // silently
        } finally {
            setSaving(false)
        }
    }

    const planColors: Record<string, string> = {
        Starter: 'bg-slate-500/15 text-slate-400',
        Pro: 'bg-netra-500/15 text-netra-400',
        Enterprise: 'bg-amber-500/15 text-amber-400',
    }

    const usagePercent = Math.min(
        100,
        Math.round((info.cameraCount / info.cameraLimit) * 100)
    )

    return (
        <div className="space-y-6">
            {/* Org name */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-sm">
                <h3 className="mb-4 text-sm font-semibold text-white">
                    Organization Details
                </h3>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">
                            Organization Name
                        </label>
                        <div className="flex gap-3">
                            <input
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="block flex-1 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition focus:border-netra-500"
                            />
                            <button
                                onClick={handleSave}
                                disabled={saving || orgName === info.name}
                                className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500 disabled:opacity-60"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan + usage */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-sm">
                <h3 className="mb-4 text-sm font-semibold text-white">
                    Plan & Usage
                </h3>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-300">Current Plan:</span>
                    <span
                        className={[
                            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                            planColors[info.plan] ?? planColors.Starter,
                        ].join(' ')}
                    >
                        <Crown className="h-3.5 w-3.5" />
                        {info.plan}
                    </span>
                </div>

                {/* Camera usage bar */}
                <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Cameras</span>
                        <span className="text-slate-300">
                            {info.cameraCount} / {info.cameraLimit}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                            className={[
                                'h-full rounded-full transition-all duration-500',
                                usagePercent >= 90
                                    ? 'bg-red-500'
                                    : usagePercent >= 70
                                        ? 'bg-amber-500'
                                        : 'bg-netra-500',
                            ].join(' ')}
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                </div>

                {/* Upgrade button */}
                <button className="mt-5 flex items-center gap-2 rounded-lg bg-gradient-to-r from-netra-600 to-netra-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-netra-500 hover:to-netra-400">
                    <Zap className="h-4 w-4" />
                    Upgrade Plan
                </button>
            </div>

            {/* Danger zone */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    Danger Zone
                </h3>
                <p className="mb-4 text-sm text-slate-400">
                    Permanently delete this organization and all associated data.
                    This action cannot be undone.
                </p>

                {!showDelete ? (
                    <button
                        onClick={() => setShowDelete(true)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
                    >
                        Delete Organization
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-red-300">Are you sure?</p>
                        <button
                            onClick={() => setShowDelete(false)}
                            className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500">
                            Yes, Delete Everything
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Main Settings Page                                                 */
/* ================================================================== */

export default function SettingsPage() {
    const { orgId } = useAuthStore()
    const [activeTab, setActiveTab] = useState<TabName>('Alerts')

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Configure alerts, manage your team, and organization settings
                </p>
            </div>

            <TabBar active={activeTab} onChange={setActiveTab} />

            {orgId && (
                <div>
                    {activeTab === 'Alerts' && <AlertsTab orgId={orgId} />}
                    {activeTab === 'Team' && <TeamTab orgId={orgId} />}
                    {activeTab === 'Organization' && <OrgTab orgId={orgId} />}
                </div>
            )}
        </div>
    )
}
