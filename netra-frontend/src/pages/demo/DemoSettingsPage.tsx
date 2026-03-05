import { useState } from 'react'
import { useDemoContext } from './DemoContext'
import { Bell, Users, Building2, Save } from 'lucide-react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

const TABS = ['Alerts', 'Team', 'Organization'] as const
type TabName = typeof TABS[number]

const TAB_ICONS: Record<TabName, React.ElementType> = {
    Alerts: Bell,
    Team: Users,
    Organization: Building2,
}

/* ================================================================== */
/*  Tab bar                                                            */
/* ================================================================== */

function TabBar({ active, onChange }: { active: TabName; onChange: (t: TabName) => void }) {
    return (
        <div className="flex gap-1 rounded-xl border border-white/5 bg-slate-900/60 p-1.5 backdrop-blur-sm">
            {TABS.map((tab) => {
                const Icon = TAB_ICONS[tab]
                const isActive = tab === active
                return (
                    <button
                        key={tab}
                        onClick={() => onChange(tab)}
                        className={[
                            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition',
                            isActive ? 'bg-netra-600/20 text-netra-400' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                        ].join(' ')}
                    >
                        <Icon className="h-4 w-4" />
                        {tab}
                    </button>
                )
            })}
        </div>
    )
}

/* ================================================================== */
/*  Alerts Tab                                                         */
/* ================================================================== */

const THREAT_TYPES = ['Fall', 'Chasing', 'Struggle', 'Zone']

function AlertsTab({ showDemoToast }: { showDemoToast: (msg?: string) => void }) {
    const thresholds: Record<string, number> = {
        Fall: 75,
        Chasing: 80,
        Struggle: 70,
        Zone: 60,
    }
    const escalationTimeout = 5
    const dedupWindow = 30

    return (
        <div className="space-y-6">
            {/* Confidence thresholds */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Confidence Thresholds</h3>
                <p className="text-xs text-slate-500 mb-4">Alerts below these confidence values will be suppressed.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {THREAT_TYPES.map((t) => (
                        <div key={t} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/30 px-4 py-3">
                            <span className="text-sm font-medium text-white">{t}</span>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={thresholds[t]}
                                    readOnly
                                    className="w-24 accent-netra-500"
                                />
                                <span className="w-10 text-right text-sm font-mono text-netra-400">{thresholds[t]}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Escalation */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Escalation Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Escalation Timeout (minutes)</label>
                        <input type="number" value={escalationTimeout} readOnly className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Deduplication Window (seconds)</label>
                        <input type="number" value={dedupWindow} readOnly className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none" />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={() => showDemoToast()} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5">
                    Test Alert
                </button>
                <button onClick={() => showDemoToast()} className="flex items-center gap-2 rounded-lg bg-netra-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500">
                    <Save className="h-4 w-4" />
                    Save Changes
                </button>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Team Tab                                                           */
/* ================================================================== */

const DEMO_TEAM = [
    { uid: 'u1', email: 'superadmin@netra.ai', displayName: 'Super Admin', role: 'super_admin', notifyViaSMS: true },
    { uid: 'u2', email: 'admin@netra.ai', displayName: 'Org Admin', role: 'org_admin', notifyViaSMS: true },
    { uid: 'u3', email: 'operator@netra.ai', displayName: 'Operator', role: 'operator', notifyViaSMS: false },
    { uid: 'u4', email: 'viewer@netra.ai', displayName: 'Viewer', role: 'viewer', notifyViaSMS: false },
]

function roleBadge(role: string) {
    switch (role) {
        case 'super_admin': return 'bg-purple-500/15 text-purple-400'
        case 'org_admin': return 'bg-[#00d4ff]/15 text-[#00d4ff]'
        case 'operator': return 'bg-amber-500/15 text-amber-400'
        case 'viewer': return 'bg-emerald-500/15 text-emerald-400'
        default: return 'bg-slate-500/15 text-slate-400'
    }
}

function formatRole(role: string): string {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function TeamTab({ showDemoToast }: { showDemoToast: (msg?: string) => void }) {
    return (
        <div className="space-y-6">
            {/* Invite form */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Invite Team Member</h3>
                <div className="flex flex-wrap gap-3">
                    <input placeholder="email@example.com" className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500" />
                    <select className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white outline-none">
                        <option>operator</option>
                        <option>viewer</option>
                        <option>org_admin</option>
                    </select>
                    <button onClick={() => showDemoToast()} className="rounded-lg bg-netra-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500">
                        Invite
                    </button>
                </div>
            </div>

            {/* Team table */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-5 py-3.5 font-medium text-slate-400">Name</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">Email</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">Role</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">SMS Alerts</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DEMO_TEAM.map(m => (
                                <tr key={m.uid} className="border-b border-white/[0.03]">
                                    <td className="px-5 py-3.5 font-medium text-white">{m.displayName}</td>
                                    <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{m.email}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={['inline-flex rounded-full px-2 py-0.5 text-xs font-medium', roleBadge(m.role)].join(' ')}>
                                            {formatRole(m.role)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <button onClick={() => showDemoToast()} className={['rounded-full w-10 h-5 relative transition', m.notifyViaSMS ? 'bg-netra-600' : 'bg-slate-700'].join(' ')}>
                                            <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', m.notifyViaSMS ? 'left-5' : 'left-0.5'].join(' ')} />
                                        </button>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <button onClick={() => showDemoToast()} className="text-xs font-medium text-red-400 hover:text-red-300 transition">
                                            Remove
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

/* ================================================================== */
/*  Organization Tab                                                   */
/* ================================================================== */

function OrgTab({ showDemoToast }: { showDemoToast: (msg?: string) => void }) {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Organization Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Organization Name</label>
                        <input value="Netra.AI Demo Org" readOnly className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Plan</label>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex rounded-full bg-netra-600/20 px-3 py-1 text-xs font-semibold text-netra-400">Pro</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Usage</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">Cameras</span>
                            <span className="text-white font-mono">4 / 32</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-netra-500" style={{ width: '12.5%' }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={() => showDemoToast()} className="flex items-center gap-2 rounded-lg bg-netra-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500">
                    <Save className="h-4 w-4" />
                    Save Changes
                </button>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Main Settings Page                                                 */
/* ================================================================== */

export default function DemoSettingsPage() {
    const { showDemoToast } = useDemoContext()
    const [activeTab, setActiveTab] = useState<TabName>('Alerts')

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="mt-1 text-sm text-slate-400">Manage organization settings</p>
            </div>

            <TabBar active={activeTab} onChange={setActiveTab} />

            {activeTab === 'Alerts' && <AlertsTab showDemoToast={showDemoToast} />}
            {activeTab === 'Team' && <TeamTab showDemoToast={showDemoToast} />}
            {activeTab === 'Organization' && <OrgTab showDemoToast={showDemoToast} />}
        </div>
    )
}
