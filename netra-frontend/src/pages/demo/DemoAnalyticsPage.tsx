import { useDemoContext } from './DemoContext'
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts'
import { BarChart3, Camera, AlertTriangle, Clock } from 'lucide-react'

/* ================================================================== */
/*  Hardcoded Data                                                     */
/* ================================================================== */

function generateTrendData() {
    const data = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        data.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Fall: Math.floor(Math.random() * 4) + 1,
            Chasing: Math.floor(Math.random() * 5) + 1,
            Struggle: Math.floor(Math.random() * 3) + 1,
            Zone: Math.floor(Math.random() * 3),
        })
    }
    return data
}

const TREND_DATA = generateTrendData()

const PIE_DATA = [
    { name: 'Chasing', value: 35, color: '#ff3b3b' },
    { name: 'Fall', value: 25, color: '#ffaa00' },
    { name: 'Struggle', value: 22, color: '#00d4ff' },
    { name: 'Zone', value: 18, color: '#00ff88' },
]

function generateResponseData() {
    const data = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        data.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            avgMinutes: +(Math.random() * 3 + 1.5).toFixed(1),
        })
    }
    return data
}

const RESPONSE_DATA = generateResponseData()

const CAMERA_TABLE = [
    { name: 'CAM 01 Main Gate', incidents: 45, falsePositive: 8, responseTime: 2.3 },
    { name: 'CAM 02 Hostel', incidents: 32, falsePositive: 12, responseTime: 1.8 },
    { name: 'CAM 03 Parking', incidents: 28, falsePositive: 6, responseTime: 3.1 },
    { name: 'CAM 04 Metro', incidents: 38, falsePositive: 9, responseTime: 2.7 },
]

const TOTAL_INCIDENTS = CAMERA_TABLE.reduce((s, c) => s + c.incidents, 0)

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const COLORS = { Fall: '#ffaa00', Chasing: '#ff3b3b', Struggle: '#00d4ff', Zone: '#00ff88' }

function DarkTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
            <p className="text-slate-400 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
                    {p.dataKey}: {p.value}
                </p>
            ))}
        </div>
    )
}

function StatCard({ icon: Icon, label, value, accent, bg }: { icon: React.ElementType; label: string; value: string | number; accent: string; bg: string }) {
    return (
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: bg }}>
                    <Icon className="h-5 w-5" style={{ color: accent }} />
                </div>
                <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-xl font-bold text-white">{value}</p>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function DemoAnalyticsPage() {
    const { showDemoToast } = useDemoContext()

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="mt-1 text-sm text-slate-400">Security intelligence overview</p>
                </div>
                <div className="flex items-center gap-2">
                    <input type="date" onChange={() => showDemoToast()} className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none" />
                    <span className="text-slate-500">to</span>
                    <input type="date" onChange={() => showDemoToast()} className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none" />
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={AlertTriangle} label="Total Incidents" value={TOTAL_INCIDENTS} accent="#ff3b3b" bg="#ff3b3b15" />
                <StatCard icon={Camera} label="Most Active Camera" value="CAM 01" accent="#00d4ff" bg="#00d4ff15" />
                <StatCard icon={BarChart3} label="Most Common Threat" value="Chasing" accent="#ffaa00" bg="#ffaa0015" />
                <StatCard icon={Clock} label="Best Response Time" value="1.8m" accent="#00ff88" bg="#00ff8815" />
            </div>

            {/* Incident Trend (Stacked Bar) */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Incident Trend (30 Days)</h3>
                <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={TREND_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={4} />
                            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="Fall" stackId="a" fill={COLORS.Fall} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Chasing" stackId="a" fill={COLORS.Chasing} />
                            <Bar dataKey="Struggle" stackId="a" fill={COLORS.Struggle} />
                            <Bar dataKey="Zone" stackId="a" fill={COLORS.Zone} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-3 justify-center">
                    {Object.entries(COLORS).map(([key, color]) => (
                        <div key={key} className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{key}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2-column: Threat Breakdown + Response Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Threat Breakdown Pie */}
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Threat Breakdown</h3>
                    <div className="flex" style={{ height: 250 }}>
                        <div className="w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                        {PIE_DATA.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1e2130', borderRadius: '8px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 flex flex-col justify-center gap-3 pl-4 border-l border-white/10">
                            {PIE_DATA.map(entry => (
                                <div key={entry.name} className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs text-slate-300">{entry.name} <span className="text-slate-500">{entry.value}%</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Response Time Trend */}
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Average Response Time</h3>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={RESPONSE_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={4} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} unit="m" />
                                <Tooltip content={<DarkTooltip />} />
                                <Line type="monotone" dataKey="avgMinutes" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#0a0a0f', stroke: '#00d4ff', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: '#00d4ff' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Per-Camera Table */}
            <div className="rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Per-Camera Analytics</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-5 py-3.5 font-medium text-slate-400">Camera</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">Total Incidents</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">False Positive Rate</th>
                                <th className="px-5 py-3.5 font-medium text-slate-400">Avg Response Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CAMERA_TABLE.map(cam => (
                                <tr key={cam.name} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                                    <td className="px-5 py-3.5 font-medium text-white font-mono text-xs">{cam.name}</td>
                                    <td className="px-5 py-3.5 text-slate-300">{cam.incidents}</td>
                                    <td className="px-5 py-3.5 text-slate-300">{cam.falsePositive}%</td>
                                    <td className="px-5 py-3.5 text-slate-300">{cam.responseTime}m</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
