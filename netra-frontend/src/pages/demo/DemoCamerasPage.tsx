import { useState } from 'react'
import { useDemoContext } from './DemoContext'
import { Camera, Plus, Pencil, Trash2, MapPin } from 'lucide-react'

/* ================================================================== */
/*  Demo Cameras Data                                                  */
/* ================================================================== */

const DEMO_CAMERAS = [
    { id: 'cam01', name: 'Main Gate', location: 'Building A, Gate 1', zone: 'Perimeter', status: 'live' as const, video: '/src/assets/demo/campus_chase.mp4', rtsp: 'rtsp://192.168.1.101:554/stream' },
    { id: 'cam02', name: 'Hostel Block A', location: 'Hostel Wing A, Floor 1', zone: 'Residential', status: 'live' as const, video: '/src/assets/demo/hostel_fall.mp4', rtsp: 'rtsp://192.168.1.102:554/stream' },
    { id: 'cam03', name: 'Parking Zone B', location: 'Parking Lot B, Row 3', zone: 'Parking', status: 'live' as const, video: '/src/assets/demo/parking_struggle.mp4', rtsp: 'rtsp://192.168.1.103:554/stream' },
    { id: 'cam04', name: 'Metro Entry', location: 'Metro Station, South Gate', zone: 'Transit', status: 'live' as const, video: '/src/assets/demo/metro_following.mp4', rtsp: 'rtsp://192.168.1.104:554/stream' },
]

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function DemoCamerasPage() {
    const { showDemoToast } = useDemoContext()
    const [videoErrors, setVideoErrors] = useState<Set<string>>(new Set())

    const handleVideoError = (id: string) => {
        setVideoErrors(prev => new Set(prev).add(id))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cameras</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {DEMO_CAMERAS.length} cameras configured
                    </p>
                </div>
                <button
                    onClick={() => showDemoToast()}
                    className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500"
                >
                    <Plus className="h-4 w-4" />
                    Add Camera
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
                {DEMO_CAMERAS.map(cam => {
                    const hasVideoError = videoErrors.has(cam.id)
                    return (
                        <div key={cam.id} className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm transition hover:border-white/10" style={{ height: 320 }}>
                            {/* Video */}
                            {hasVideoError ? (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                                    <Camera className="h-10 w-10 text-slate-700 z-10" />
                                </div>
                            ) : (
                                <video
                                    src={cam.video}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    onError={() => handleVideoError(cam.id)}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            )}

                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                            {/* LIVE badge */}
                            <div className="absolute top-3 right-3 z-10">
                                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-emerald-500/50 animate-pulse" />
                                    Live
                                </span>
                            </div>

                            {/* Bottom info */}
                            <div className="absolute inset-x-0 bottom-0 p-4 z-10">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-white/5">
                                                <Camera className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-semibold text-white">{cam.name}</h3>
                                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                                    <MapPin className="h-3 w-3" />
                                                    {cam.location}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {cam.zone && (
                                        <p className="text-xs text-slate-500">
                                            Zone: <span className="text-slate-400">{cam.zone}</span>
                                        </p>
                                    )}

                                    <p className="truncate rounded-lg bg-slate-800/50 px-3 py-2 font-mono text-xs text-slate-500">
                                        {cam.rtsp}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                                        <button
                                            onClick={() => showDemoToast()}
                                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => showDemoToast()}
                                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
