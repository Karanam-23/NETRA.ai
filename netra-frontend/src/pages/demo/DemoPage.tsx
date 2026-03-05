import { useState, useEffect, useRef, useCallback } from 'react'
import { useDemoContext } from './DemoContext'
import axios from 'axios'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import { X, MessageSquare, Loader2 } from 'lucide-react'
import logo from '@/assets/logo.png'

const SMS_API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/demo/send-alert-sms'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface DemoAlert {
    id: string
    threat: string
    camera: string
    cameraIndex: number
    confidence: number
    firedAt: number
    acknowledged: boolean
}

interface ScriptedEvent {
    delay: number
    threat: string
    camera: string
    cameraIndex: number
    confidence: number
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const CAMERAS = [
    { id: 'cam01', label: 'CAM 01', name: 'Main Gate', video: '/src/assets/demo/campus_chase.mp4' },
    { id: 'cam02', label: 'CAM 02', name: 'Hostel Block A', video: '/src/assets/demo/hostel_fall.mp4' },
    { id: 'cam03', label: 'CAM 03', name: 'Parking Zone B', video: '/src/assets/demo/parking_struggle.mp4' },
    { id: 'cam04', label: 'CAM 04', name: 'Metro Entry', video: '/src/assets/demo/metro_following.mp4' },
]

const SCRIPTED_EVENTS: ScriptedEvent[] = [
    { delay: 8, threat: 'Chasing', camera: 'CAM 01 -- Main Gate', cameraIndex: 0, confidence: 0.91 },
    { delay: 18, threat: 'Sudden Fall', camera: 'CAM 02 -- Hostel Block A', cameraIndex: 1, confidence: 0.87 },
    { delay: 28, threat: 'Struggling', camera: 'CAM 03 -- Parking Zone B', cameraIndex: 2, confidence: 0.83 },
    { delay: 40, threat: 'Being Followed', camera: 'CAM 04 -- Metro Entry', cameraIndex: 3, confidence: 0.89 },
    { delay: 55, threat: 'Chasing', camera: 'CAM 01 -- Main Gate', cameraIndex: 0, confidence: 0.94 },
]

const TREND_DATA = [
    { date: 'Mon', incidents: 3 },
    { date: 'Tue', incidents: 7 },
    { date: 'Wed', incidents: 2 },
    { date: 'Thu', incidents: 9 },
    { date: 'Fri', incidents: 4 },
    { date: 'Sat', incidents: 6 },
    { date: 'Sun', incidents: 8 },
]

const PIE_DATA = [
    { name: 'Chasing', value: 35, color: '#ff3b3b' },
    { name: 'Fall', value: 25, color: '#ffaa00' },
    { name: 'Struggle', value: 22, color: '#00d4ff' },
    { name: 'Zone', value: 18, color: '#00ff88' },
]

const PLATFORM_ORGS = [
    { name: 'Saveetha University', cameras: 16, alerts: 42 },
    { name: 'Chennai Metro', cameras: 24, alerts: 31 },
    { name: 'VIT Campus', cameras: 12, alerts: 18 },
]

/* ================================================================== */
/*  CSS                                                                */
/* ================================================================== */

const demoStyles = `
@keyframes demoPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes demoRedBorder { 0%,100%{border-color:#ff3b3b;box-shadow:0 0 12px #ff3b3b60} 50%{border-color:#ff3b3b80;box-shadow:0 0 4px #ff3b3b30} }
.demo-pulse{animation:demoPulse 1.5s ease-in-out infinite}
.demo-alert-border{animation:demoRedBorder 1s ease-in-out infinite}
.soc-scrollbar::-webkit-scrollbar{width:6px}
.soc-scrollbar::-webkit-scrollbar-track{background:#0f1117}
.soc-scrollbar::-webkit-scrollbar-thumb{background:#1e2130;border-radius:3px}
.soc-scrollbar::-webkit-scrollbar-thumb:hover{background:#00d4ff}
`

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function threatColor(type: string): string {
    const t = type.toLowerCase()
    if (t.includes('chas')) return '#ff3b3b'
    if (t.includes('fall')) return '#ffaa00'
    if (t.includes('struggl')) return '#00d4ff'
    if (t.includes('follow')) return '#c084fc'
    return '#ffaa00'
}

function formatClock(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ================================================================== */
/*  Main Component (Dashboard content only, no layout shell)           */
/* ================================================================== */

export default function DemoPage() {
    const { role } = useDemoContext()

    const [currentTime, setCurrentTime] = useState(new Date())
    const [alerts, setAlerts] = useState<DemoAlert[]>([])
    const [totalAlertsFired, setTotalAlertsFired] = useState(2)
    const [acknowledgedTimes, setAcknowledgedTimes] = useState<number[]>([])
    const [emergencyAlert, setEmergencyAlert] = useState<DemoAlert | null>(null)
    const [reportCopied, setReportCopied] = useState(false)
    const [videoErrors, setVideoErrors] = useState<Set<number>>(new Set())
    const [tick, setTick] = useState(0)
    const intervalRefs = useRef<number[]>([])
    const alertIdCounter = useRef(0)

    // SMS state
    const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const sendDemoSms = useCallback(async (threat: string, camera: string, confidence: number) => {
        setSmsStatus('sending')
        try {
            const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const res = await axios.post(SMS_API_URL, {
                threat,
                camera,
                confidence: Math.round(confidence * 100),
                time: timeStr,
            })
            setSmsStatus(res.data?.success ? 'sent' : 'error')
        } catch {
            setSmsStatus('error')
        }
        setTimeout(() => setSmsStatus('idle'), 3000)
    }, [])

    const handleTestSms = () => {
        sendDemoSms('Test Alert', 'CAM 01 -- Main Gate', 0.95)
    }

    const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length
    const avgResponseTime = acknowledgedTimes.length > 0
        ? Math.round(acknowledgedTimes.reduce((a, b) => a + b, 0) / acknowledgedTimes.length)
        : 0
    const alertingCameras = new Set(alerts.filter(a => !a.acknowledged).map(a => a.cameraIndex))

    useEffect(() => {
        const id = window.setInterval(() => setCurrentTime(new Date()), 1000)
        intervalRefs.current.push(id)
        return () => window.clearInterval(id)
    }, [])

    useEffect(() => {
        const id = window.setInterval(() => setTick(t => t + 1), 1000)
        intervalRefs.current.push(id)
        return () => window.clearInterval(id)
    }, [])

    const startTimeline = useCallback(() => {
        intervalRefs.current.forEach(id => { window.clearTimeout(id); window.clearInterval(id) })
        intervalRefs.current = []
        const clockId = window.setInterval(() => setCurrentTime(new Date()), 1000)
        intervalRefs.current.push(clockId)
        const tickId = window.setInterval(() => setTick(t => t + 1), 1000)
        intervalRefs.current.push(tickId)

        SCRIPTED_EVENTS.forEach(evt => {
            const tid = window.setTimeout(() => {
                alertIdCounter.current += 1
                const newAlert: DemoAlert = { id: `alert-${alertIdCounter.current}`, threat: evt.threat, camera: evt.camera, cameraIndex: evt.cameraIndex, confidence: evt.confidence, firedAt: Date.now(), acknowledged: false }
                setAlerts(prev => [newAlert, ...prev])
                setTotalAlertsFired(prev => prev + 1)
                // Send SMS to the number configured in backend .env
                sendDemoSms(evt.threat, evt.camera, evt.confidence)
            }, evt.delay * 1000)
            intervalRefs.current.push(tid)
        })

        const resetTid = window.setTimeout(() => { setAlerts([]); startTimeline() }, 70000)
        intervalRefs.current.push(resetTid)
    }, [sendDemoSms])

    useEffect(() => {
        startTimeline()
        return () => { intervalRefs.current.forEach(id => { window.clearInterval(id); window.clearTimeout(id) }) }
    }, [startTimeline])

    const handleAcknowledge = (alertId: string) => {
        setAlerts(prev => {
            const found = prev.find(a => a.id === alertId)
            if (found && !found.acknowledged) {
                const elapsed = Math.round((Date.now() - found.firedAt) / 1000)
                setAcknowledgedTimes(t => [...t, elapsed])
            }
            return prev.filter(a => a.id !== alertId)
        })
    }

    const handleEscalate = (alert: DemoAlert) => { setEmergencyAlert(alert) }

    const handleVideoError = (index: number) => { setVideoErrors(prev => new Set(prev).add(index)) }

    const handleCopyReport = (alert: DemoAlert) => {
        const ts = new Date(alert.firedAt).toLocaleString()
        const msg = `NETRA.AI ALERT: ${alert.threat} detected at ${alert.camera}.\nConfidence: ${Math.round(alert.confidence * 100)}%. Time: ${ts}.\nLocation: Saveetha University Campus.\nPlease respond immediately.`
        navigator.clipboard.writeText(msg)
        setReportCopied(true)
        setTimeout(() => setReportCopied(false), 2000)
    }

    return (
        <div className="min-h-full text-white font-sans">
            <style>{demoStyles}</style>

            {/* Inner header bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Netra.AI" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1) hue-rotate(180deg) saturate(300%) contrast(200%)' }} />
                    <span className="text-xl font-bold tracking-widest text-white">
                        NETRA<span className="text-[#00d4ff]">.AI</span>
                    </span>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="font-mono text-2xl tracking-[0.2em] font-light bg-black/40 px-6 py-2 border border-white/5 rounded text-[#00d4ff]">
                        {formatClock(currentTime)}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Test SMS Button */}
                    <button
                        onClick={handleTestSms}
                        disabled={smsStatus === 'sending'}
                        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border transition disabled:opacity-30 disabled:cursor-not-allowed border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 bg-black/40"
                    >
                        {smsStatus === 'sending' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <MessageSquare className="h-3 w-3" />
                        )}
                        Test SMS
                    </button>
                    {smsStatus === 'sent' && <span className="h-2 w-2 rounded-full bg-[#00ff88]" style={{ boxShadow: '0 0 6px #00ff88' }} title="SMS sent" />}
                    {smsStatus === 'error' && <span className="h-2 w-2 rounded-full bg-[#ff3b3b]" style={{ boxShadow: '0 0 6px #ff3b3b' }} title="SMS failed" />}

                    <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-widest">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] demo-pulse" style={{ boxShadow: '0 0 8px #00ff88' }} />
                        <span className="text-[#00ff88]">SYSTEM ONLINE</span>
                    </div>
                </div>
            </div>

            {/* Platform overview (super_admin only) */}
            {role === 'super_admin' && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Platform Overview</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {PLATFORM_ORGS.map(org => (
                            <div key={org.name} className="bg-[#0f1117] border border-white/10 rounded-lg p-5">
                                <p className="text-sm font-semibold text-white mb-3">{org.name}</p>
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Cameras</p>
                                        <p className="text-lg font-bold font-mono text-[#00d4ff]">{org.cameras}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Alerts</p>
                                        <p className="text-lg font-bold font-mono text-[#ffaa00]">{org.alerts}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[
                    { label: 'Active Cameras', value: '4', color: '#00ff88' },
                    { label: 'Alerts Today', value: String(totalAlertsFired), color: '#ff3b3b' },
                    { label: 'Unacknowledged', value: String(unacknowledgedCount), color: '#ffaa00' },
                    { label: 'Avg Response Time', value: `${avgResponseTime}s`, color: '#00d4ff' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#0f1117] border border-white/10 rounded-lg p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className="text-3xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Camera grid + Alert feed */}
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                <div className="lg:w-[65%] flex flex-col">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Surveillance Feed</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3 h-[500px]">
                        {CAMERAS.map((cam, idx) => {
                            const hasAlert = alertingCameras.has(idx)
                            const hasVideoError = videoErrors.has(idx)
                            return (
                                <div key={cam.id} className={['relative w-full h-full rounded-lg overflow-hidden group', hasAlert ? 'demo-alert-border border-2' : 'border border-white/10'].join(' ')} style={{ background: '#0d0d14' }}>
                                    {hasVideoError ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                                            <span className="text-[11px] text-gray-500 font-mono uppercase tracking-wide">{cam.label}</span>
                                            <span className="text-[9px] text-gray-700 mt-2">Video unavailable</span>
                                        </div>
                                    ) : (
                                        <video src={cam.video} autoPlay muted loop playsInline onError={() => handleVideoError(idx)} className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute top-0 left-0 right-0 p-3 z-10 flex justify-between items-start">
                                        <span className="text-[11px] text-white font-mono bg-black/60 px-2 py-1 rounded backdrop-blur border border-white/10">{cam.label}</span>
                                        <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded border border-[#00ff88]/30">
                                            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] demo-pulse" style={{ boxShadow: '0 0 5px #00ff88' }} />
                                            <span className="text-[10px] text-[#00ff88] font-bold tracking-wider">LIVE</span>
                                        </span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-3 z-10 bg-gradient-to-t from-black/90 to-transparent pt-8">
                                        <p className="text-xs font-medium text-white truncate">{cam.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wide mt-0.5">{cam.label}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="lg:w-[35%] flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                            Live Alerts
                            {unacknowledgedCount > 0 && <span className="h-2 w-2 bg-[#ff3b3b] rounded-full demo-pulse" style={{ boxShadow: '0 0 8px #ff3b3b' }} />}
                        </h2>
                        <span className="bg-[#ff3b3b]/20 text-[#ff3b3b] text-[10px] font-mono px-2 py-0.5 rounded border border-[#ff3b3b]/30">{unacknowledgedCount}</span>
                    </div>

                    {role === 'viewer' && (
                        <div className="bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded px-3 py-2 mb-3 text-[10px] text-[#ffaa00] font-mono uppercase tracking-wider">
                            You are in View-Only mode. Contact an operator to acknowledge alerts.
                        </div>
                    )}

                    <div className="bg-[#0f1117] flex-1 rounded-lg border border-white/10 flex flex-col overflow-hidden relative">
                        <div className="absolute inset-0 overflow-y-auto soc-scrollbar p-3 space-y-2">
                            {unacknowledgedCount === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <span className="h-3 w-3 rounded-full bg-[#00ff88] mb-3" style={{ boxShadow: '0 0 15px #00ff88' }} />
                                    <p className="text-sm text-white uppercase tracking-widest font-semibold">All Clear</p>
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase">No active threats</p>
                                </div>
                            ) : (
                                alerts.filter(a => !a.acknowledged).map(alert => {
                                    void tick
                                    const elapsedNow = Math.round((Date.now() - alert.firedAt) / 1000)
                                    const timerColor = elapsedNow < 60 ? '#fff' : elapsedNow < 120 ? '#ffaa00' : '#ff3b3b'
                                    const isOverdue = elapsedNow >= 120
                                    return (
                                        <div key={alert.id} className="bg-black/50 border border-white/5 rounded p-3 hover:bg-black/80 transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border" style={{ color: threatColor(alert.threat), borderColor: `${threatColor(alert.threat)}50`, backgroundColor: `${threatColor(alert.threat)}15` }}>
                                                    {alert.threat}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-mono font-bold" style={{ color: timerColor }}>{formatTimer(elapsedNow)}</span>
                                                    {isOverdue && <span className="text-[8px] font-bold text-[#ff3b3b] uppercase tracking-wider">OVERDUE</span>}
                                                </div>
                                            </div>
                                            <p className="text-xs text-white mb-2 font-medium font-mono">{alert.camera}</p>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-[#ff3b3b]" style={{ width: `${Math.round(alert.confidence * 100)}%` }} />
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-gray-400 w-8">{Math.round(alert.confidence * 100)}%</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {role === 'viewer' ? (
                                                    <button className="flex-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition">View Details</button>
                                                ) : (
                                                    <button onClick={() => handleAcknowledge(alert.id)} className="flex-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 transition">Acknowledge</button>
                                                )}
                                                <button onClick={() => handleEscalate(alert)} className="flex-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border border-[#ff3b3b]/30 text-[#ff3b3b] hover:bg-[#ff3b3b]/10 transition">Escalate</button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[300px]">
                <div className="lg:w-[60%] bg-[#0f1117] rounded-lg border border-white/10 p-5 flex flex-col">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Incident Trend</h3>
                    <div className="flex-1 min-h-[200px] lg:min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={TREND_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1e2130', borderRadius: '8px' }} itemStyle={{ color: '#00d4ff' }} />
                                <Line type="monotone" dataKey="incidents" stroke="#00d4ff" strokeWidth={3} dot={{ fill: '#0a0a0f', stroke: '#00d4ff', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#00d4ff' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="lg:w-[40%] bg-[#0f1117] rounded-lg border border-white/10 p-5 flex flex-col">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Threat Breakdown</h3>
                    <div className="flex-1 flex min-h-[200px] lg:min-h-0">
                        <div className="w-1/2 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                        {PIE_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1e2130', borderRadius: '8px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 flex flex-col justify-center gap-3 pl-4 border-l border-white/10">
                            {PIE_DATA.map((entry, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }} />
                                    <span className="text-[10px] text-gray-300 uppercase tracking-wider">{entry.name} {entry.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Emergency Panel Modal */}
            {emergencyAlert && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-xl p-7">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-bold text-[#ff3b3b] tracking-wider uppercase">Emergency Response</h2>
                            <button onClick={() => { setEmergencyAlert(null); setReportCopied(false) }} className="text-gray-500 hover:text-white transition p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="bg-black/40 rounded-lg border border-white/10 p-4 mb-5">
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Threat Type</span><p className="text-[#ff3b3b] font-semibold mt-1">{emergencyAlert.threat}</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Camera</span><p className="text-white font-semibold mt-1">{emergencyAlert.camera}</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Confidence</span><p className="text-[#ffaa00] font-semibold mt-1">{Math.round(emergencyAlert.confidence * 100)}%</p></div>
                                <div><span className="text-[9px] text-gray-500 uppercase tracking-widest">Time Detected</span><p className="text-white font-semibold mt-1">{new Date(emergencyAlert.firedAt).toLocaleTimeString()}</p></div>
                            </div>
                        </div>
                        <div className="flex gap-3 mb-5">
                            <button onClick={() => window.open('tel:100')} className="flex-1 py-3.5 rounded-lg bg-[#ff3b3b] text-white text-sm font-bold border-none cursor-pointer tracking-wider hover:bg-[#ff3b3b]/90 transition">Call Police -- 100</button>
                            <button onClick={() => window.open('tel:108')} className="flex-1 py-3.5 rounded-lg bg-[#ffaa00] text-black text-sm font-bold border-none cursor-pointer tracking-wider hover:bg-[#ffaa00]/90 transition">Call Ambulance -- 108</button>
                        </div>
                        <button onClick={() => handleCopyReport(emergencyAlert)} className="w-full py-3 rounded-lg bg-white/5 text-white text-xs font-semibold border border-white/10 cursor-pointer tracking-wider hover:bg-white/10 transition mb-3">
                            {reportCopied ? 'Report Copied to Clipboard' : 'Send Incident Report'}
                        </button>
                        <div className="bg-black/30 rounded-md p-3 text-[10px] font-mono text-gray-400 leading-relaxed mb-4">
                            NETRA.AI ALERT: {emergencyAlert.threat} detected at {emergencyAlert.camera}.<br />
                            Confidence: {Math.round(emergencyAlert.confidence * 100)}%. Time: {new Date(emergencyAlert.firedAt).toLocaleString()}.<br />
                            Location: Saveetha University Campus. Please respond immediately.
                        </div>
                        <p className="text-[9px] text-gray-600 text-center leading-relaxed">Emergency dispatch is the sole responsibility of the operator. Netra.AI provides detection and notification only.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
