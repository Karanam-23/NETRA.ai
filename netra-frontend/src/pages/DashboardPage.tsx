import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';
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
} from 'recharts';
import { Plus, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

/* ================================================================== */
/*  CSS Inject for specific animations                                 */
/* ================================================================== */
const socStyles = `
  .soc-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .soc-scrollbar::-webkit-scrollbar-track {
    background: #0f1117;
  }
  .soc-scrollbar::-webkit-scrollbar-thumb {
    background: #1e2130;
    border-radius: 3px;
  }
  .soc-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #00d4ff;
  }
`;

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */
interface LiveAlert {
    key: string;
    incidentId: string;
    threatType: string;
    cameraName: string;
    zoneName: string;
    confidence: number;
    snapshotUrl: string;
    status: string;
    timestamp: number;
    expiresAt: number;
}

interface CameraStatus {
    id: string;
    name: string;
    location: string;
    status: 'live' | 'offline' | 'degraded';
}

interface DashboardStats {
    activeCameras: number;
    alertsToday: number;
    unacknowledged: number;
    avgResponseTime: number;
}

interface TrendPoint {
    date: string;
    incidents: number;
}

function formatTime(date: Date) {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function threatColorHex(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('intrusion') || t.includes('weapon') || t.includes('assault') || t.includes('fire')) return '#ff3b3b';
    return '#ffaa00';
}

export default function DashboardPage() {
    const { orgId } = useAuthStore();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Firebase live alerts
    const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);

    useEffect(() => {
        if (!orgId) return;
        const alertsRef = ref(realtimeDb, `alerts/${orgId}/live`);
        const handleValue = (snapshot: any) => {
            const data = snapshot.val();
            if (!data) {
                setLiveAlerts([]);
                return;
            }
            const alertsList: LiveAlert[] = Object.entries(data).map(
                ([key, val]: [string, any]) => ({
                    key,
                    incidentId: val.incidentId ?? '',
                    threatType: val.threatType ?? 'Unknown',
                    cameraName: val.cameraName ?? 'Unknown Camera',
                    zoneName: val.zoneName ?? '',
                    confidence: val.confidence ?? 0,
                    snapshotUrl: val.snapshotUrl ?? '',
                    status: val.status ?? 'alerted',
                    timestamp: val.timestamp ?? Date.now(),
                    expiresAt: val.expiresAt ?? 0,
                })
            );
            alertsList.sort((a, b) => b.timestamp - a.timestamp);
            setLiveAlerts(alertsList);
        };
        onValue(alertsRef, handleValue);
        return () => off(alertsRef, 'value', handleValue);
    }, [orgId]);

    // Stats
    const { data: stats } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/dashboard/${orgId}/stats`);
            return data;
        },
        enabled: !!orgId,
        refetchInterval: 30_000,
        placeholderData: {
            activeCameras: 0,
            alertsToday: 0,
            unacknowledged: 0,
            avgResponseTime: 0,
        },
    });

    // Cameras
    const { data: cameras } = useQuery<CameraStatus[]>({
        queryKey: ['camera-statuses', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/cameras/?orgId=${orgId}`);
            return data;
        },
        enabled: !!orgId,
        refetchInterval: 30_000,
        placeholderData: [],
    });

    // Trend
    const { data: trendData } = useQuery<TrendPoint[]>({
        queryKey: ['incident-trend', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/analytics/${orgId}/summary`);
            return data.trend ?? data;
        },
        enabled: !!orgId,
        refetchInterval: 60_000,
        placeholderData: [],
    });

    const displayStats = stats ?? {
        activeCameras: 0,
        alertsToday: 0,
        unacknowledged: 0,
        avgResponseTime: 0,
    };

    const cameraList = cameras ?? [];

    // Camera Grid - Default 4, can expand to 9 or 16
    const gridSlots = useMemo(() => {
        let count = 4;
        if (cameraList.length > 4) count = 9;
        if (cameraList.length > 9) count = 16;

        const slots = [...cameraList];
        while (slots.length < count) {
            slots.push({ id: `empty-${slots.length}`, name: '', location: '', status: 'offline' } as any);
        }
        return slots.slice(0, count);
    }, [cameraList]);

    const getGridCols = (count: number) => {
        if (count === 4) return 'grid-cols-2';
        if (count === 9) return 'grid-cols-3';
        return 'grid-cols-4';
    };

    const chartData = useMemo(() => {
        if (trendData && trendData.length > 0) return trendData;
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                incidents: Math.floor(Math.random() * 20),
            };
        });
    }, [trendData]);

    const pieData = [
        { name: 'Intrusion', value: 45, color: '#ff3b3b' },
        { name: 'Loitering', value: 25, color: '#ffaa00' },
        { name: 'Suspicious Object', value: 20, color: '#00d4ff' },
        { name: 'Assault', value: 10, color: '#f43f5e' }
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0f] p-4 text-white font-sans mt-[-1rem] mx-[-1rem]">
            <style>{socStyles}</style>

            {/* ----- TOP HEADER BAR ----- */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Netra.AI" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1) hue-rotate(180deg) saturate(300%) contrast(200%)' }} />
                    <span className="text-xl font-bold tracking-widest text-white">
                        NETRA<span className="text-[#00d4ff]">.AI</span>
                    </span>
                </div>

                <div className="flex-1 flex justify-center">
                    <div className="font-mono text-2xl tracking-[0.2em] font-light bg-black/40 px-6 py-2 border border-white/5 rounded text-[#00d4ff]">
                        {formatTime(currentTime)}
                    </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-widest">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_8px_#00ff88]"></span>
                    <span className="text-[#00ff88]">SYSTEM ONLINE</span>
                </div>
            </div>

            {/* ----- 4 STAT CARDS ROW ----- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[
                    { label: 'Active Cameras', value: displayStats.activeCameras, color: '#00ff88' },
                    { label: 'Alerts Today', value: displayStats.alertsToday, color: '#ff3b3b' },
                    { label: 'Unacknowledged', value: displayStats.unacknowledged, color: '#ffaa00' },
                    { label: 'Avg Response Time', value: `${displayStats.avgResponseTime}s`, color: '#00d4ff' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#0f1117] border border-white/10 rounded-lg p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className="text-3xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* ----- MAIN SECTION (2 COLUMN) ----- */}
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                {/* LEFT (65%): Camera Grid */}
                <div className="lg:w-[65%] flex flex-col">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">
                            Surveillance Feed
                        </h2>
                    </div>

                    <div className={`grid ${getGridCols(gridSlots.length)} gap-3 h-[500px]`}>
                        {gridSlots.map((cam, idx) => {
                            const isEmpty = !cam.name;
                            const isLive = cam.status === 'live';
                            return (
                                <div key={cam.id} className={`relative w-full h-full bg-[#0d0d14] rounded-lg overflow-hidden group ${isEmpty ? 'border border-dashed border-white/20' : 'border border-white/10'}`}>
                                    {isEmpty ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                            <Link to="/cameras" className="p-4 rounded-full bg-white/5 hover:bg-[#00d4ff]/20 hover:text-[#00d4ff] text-gray-500 transition border border-transparent hover:border-[#00d4ff]/50">
                                                <Plus className="h-8 w-8" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="absolute inset-0 bg-black z-0">
                                                {/* Fallback pattern for video stream */}
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                                            </div>

                                            {/* Top info */}
                                            <div className="absolute top-0 left-0 right-0 p-3 z-10 flex justify-between items-start">
                                                <span className="text-[11px] text-white font-mono bg-black/60 px-2 py-1 rounded backdrop-blur border border-white/10">
                                                    CAM {String(idx + 1).padStart(2, '0')}
                                                </span>
                                                {isLive ? (
                                                    <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded border border-[#00ff88]/30">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_5px_#00ff88]"></span>
                                                        <span className="text-[10px] text-[#00ff88] font-bold tracking-wider">LIVE</span>
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded border border-gray-600/30">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                                                        <span className="text-[10px] text-gray-400 font-bold tracking-wider">OFFLINE</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* View Stream Button (Hover) */}
                                            <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                                                <button className="bg-[#00d4ff] text-black text-xs font-bold px-4 py-2 rounded uppercase tracking-wider hover:bg-[#00d4ff]/80 flex items-center gap-2 transition">
                                                    <Video className="h-4 w-4" /> View Stream
                                                </button>
                                            </div>

                                            {/* Bottom info */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 z-10 bg-gradient-to-t from-black/90 to-transparent pt-8">
                                                <p className="text-xs font-medium text-white truncate">{cam.name}</p>
                                                <p className="text-[10px] text-gray-400 flex gap-1 items-center mt-0.5 truncate uppercase tracking-wide">{cam.location}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT (35%): Live Alert Feed */}
                <div className="lg:w-[35%] flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                            Live Alerts
                            {liveAlerts.length > 0 && <span className="h-2 w-2 bg-[#ff3b3b] rounded-full animate-pulse shadow-[0_0_8px_#ff3b3b]"></span>}
                        </h2>
                        <span className="bg-[#ff3b3b]/20 text-[#ff3b3b] text-[10px] font-mono px-2 py-0.5 rounded border border-[#ff3b3b]/30">
                            {liveAlerts.length}
                        </span>
                    </div>

                    <div className="bg-[#0f1117] flex-1 rounded-lg border border-white/10 flex flex-col overflow-hidden relative">
                        {/* Scrollable content area */}
                        <div className="absolute inset-0 overflow-y-auto soc-scrollbar p-3 space-y-2">
                            {liveAlerts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <span className="h-3 w-3 rounded-full bg-[#00ff88] mb-3 shadow-[0_0_15px_#00ff88]"></span>
                                    <p className="text-sm text-white uppercase tracking-widest font-semibold">All Clear</p>
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase">No active threats detected</p>
                                </div>
                            ) : (
                                liveAlerts.map(alert => (
                                    <div key={alert.key} className="bg-black/50 border border-white/5 rounded p-3 hover:bg-black/80 transition group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border" style={{ color: threatColorHex(alert.threatType), borderColor: `${threatColorHex(alert.threatType)}50`, backgroundColor: `${threatColorHex(alert.threatType)}15` }}>
                                                {alert.threatType}
                                            </span>
                                            <span className="text-[10px] font-mono text-gray-500">{timeAgo(alert.timestamp)}</span>
                                        </div>
                                        <p className="text-xs text-white mb-2 font-medium">{alert.cameraName}</p>

                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#ff3b3b]" style={{ width: `${Math.round(alert.confidence * 100)}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-gray-400 w-8">{Math.round(alert.confidence * 100)}%</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ----- BOTTOM SECTION (2 COLUMN) ----- */}
            <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[300px]">
                {/* LEFT (60%): Incident Trend */}
                <div className="lg:w-[60%] bg-[#0f1117] rounded-lg border border-white/10 p-5 flex flex-col">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Incident Trend</h3>
                    <div className="flex-1 min-h-[200px] lg:min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1e2130', borderRadius: '8px' }} itemStyle={{ color: '#00d4ff' }} />
                                <Line type="monotone" dataKey="incidents" stroke="#00d4ff" strokeWidth={3} dot={{ fill: '#0a0a0f', stroke: '#00d4ff', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#00d4ff' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RIGHT (40%): Threat Breakdown */}
                <div className="lg:w-[40%] bg-[#0f1117] rounded-lg border border-white/10 p-5 flex flex-col">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Threat Breakdown</h3>
                    <div className="flex-1 flex min-h-[200px] lg:min-h-0">
                        <div className="w-1/2 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1e2130', borderRadius: '8px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 flex flex-col justify-center gap-3 pl-4 border-l border-white/10">
                            {pieData.map((entry, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }}></div>
                                    <span className="text-[10px] text-gray-300 uppercase tracking-wider">{entry.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
