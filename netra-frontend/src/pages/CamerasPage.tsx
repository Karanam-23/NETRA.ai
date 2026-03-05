import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    Camera,
    Plus,
    Pencil,
    Trash2,
    X,
    Loader2,
    MapPin,
    Wifi,
    WifiOff,
    AlertTriangle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface CameraItem {
    id: string
    name: string
    rtspUrl: string
    location: string
    zone?: string
    status: 'live' | 'offline' | 'degraded'
}

/* ================================================================== */
/*  Schema                                                             */
/* ================================================================== */

const cameraSchema = z.object({
    name: z.string().min(2, 'Camera name is required'),
    rtspUrl: z
        .string()
        .min(1, 'RTSP URL is required')
        .regex(/^rtsp:\/\//, 'Must start with rtsp://'),
    location: z.string().min(1, 'Location is required'),
    zone: z.string().optional(),
})

type CameraFormValues = z.infer<typeof cameraSchema>

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function statusConfig(status: string) {
    switch (status) {
        case 'live':
            return {
                dot: 'bg-emerald-500 shadow-emerald-500/50',
                badge: 'bg-emerald-500/15 text-emerald-400',
                icon: Wifi,
                label: 'Live',
            }
        case 'offline':
            return {
                dot: 'bg-red-500 shadow-red-500/50',
                badge: 'bg-red-500/15 text-red-400',
                icon: WifiOff,
                label: 'Offline',
            }
        case 'degraded':
            return {
                dot: 'bg-amber-500 shadow-amber-500/50',
                badge: 'bg-amber-500/15 text-amber-400',
                icon: AlertTriangle,
                label: 'Degraded',
            }
        default:
            return {
                dot: 'bg-slate-500 shadow-slate-500/50',
                badge: 'bg-slate-500/15 text-slate-400',
                icon: Camera,
                label: 'Unknown',
            }
    }
}

/* ================================================================== */
/*  Modal                                                              */
/* ================================================================== */

function CameraModal({
    open,
    camera,
    onClose,
    onSaved,
    orgId,
}: {
    open: boolean
    camera: CameraItem | null // null = add mode
    onClose: () => void
    onSaved: () => void
    orgId: string | null
}) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isEdit = !!camera

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CameraFormValues>({
        resolver: zodResolver(cameraSchema),
        defaultValues: {
            name: camera?.name ?? '',
            rtspUrl: camera?.rtspUrl ?? '',
            location: camera?.location ?? '',
            zone: camera?.zone ?? '',
        },
    })

    const onSubmit = async (data: CameraFormValues) => {
        setSaving(true)
        setError(null)
        try {
            if (isEdit) {
                await apiClient.put(`/cameras/${camera!.id}`, { ...data, orgId })
            } else {
                await apiClient.post('/cameras/', { ...data, orgId })
            }
            reset()
            onSaved()
            onClose()
        } catch (err: any) {
            setError(
                err?.response?.data?.detail || 'Failed to save camera. Try again.'
            )
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-lg rounded-2xl border border-white/5 bg-slate-900 p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">
                            {isEdit ? 'Edit Camera' : 'Add Camera'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 hover:text-white transition"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Camera Name
                            </label>
                            <input
                                placeholder="Front Entrance"
                                {...register('name')}
                                className={[
                                    'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition',
                                    'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                    errors.name ? 'border-red-500/50' : 'border-white/10',
                                ].join(' ')}
                            />
                            {errors.name && (
                                <p className="text-xs text-red-400">{errors.name.message}</p>
                            )}
                        </div>

                        {/* RTSP URL */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                RTSP URL
                            </label>
                            <input
                                placeholder="rtsp://192.168.1.100:554/stream"
                                {...register('rtspUrl')}
                                className={[
                                    'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none transition',
                                    'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                    errors.rtspUrl ? 'border-red-500/50' : 'border-white/10',
                                ].join(' ')}
                            />
                            {errors.rtspUrl && (
                                <p className="text-xs text-red-400">
                                    {errors.rtspUrl.message}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">
                                    Location
                                </label>
                                <input
                                    placeholder="Building A, Floor 1"
                                    {...register('location')}
                                    className={[
                                        'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition',
                                        'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                        errors.location ? 'border-red-500/50' : 'border-white/10',
                                    ].join(' ')}
                                />
                                {errors.location && (
                                    <p className="text-xs text-red-400">
                                        {errors.location.message}
                                    </p>
                                )}
                            </div>

                            {/* Zone */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">
                                    Zone <span className="text-slate-600">(optional)</span>
                                </label>
                                <input
                                    placeholder="Perimeter"
                                    {...register('zone')}
                                    className="block w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className={[
                                    'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition',
                                    'bg-netra-600 hover:bg-netra-500 active:bg-netra-700',
                                    'disabled:cursor-not-allowed disabled:opacity-60',
                                ].join(' ')}
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isEdit ? 'Save Changes' : 'Add Camera'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

/* ================================================================== */
/*  Delete confirmation dialog                                         */
/* ================================================================== */

function DeleteDialog({
    camera,
    onClose,
    onConfirm,
    deleting,
}: {
    camera: CameraItem | null
    onClose: () => void
    onConfirm: () => void
    deleting: boolean
}) {
    if (!camera) return null

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-sm rounded-2xl border border-white/5 bg-slate-900 p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-lg font-semibold text-white">
                        Delete Camera
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Are you sure you want to delete{' '}
                        <span className="font-medium text-white">{camera.name}</span>?
                        This action cannot be undone.
                    </p>
                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={deleting}
                            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                        >
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function CamerasPage() {
    const { orgId } = useAuthStore()
    const queryClient = useQueryClient()

    const [modalOpen, setModalOpen] = useState(false)
    const [editingCamera, setEditingCamera] = useState<CameraItem | null>(null)
    const [deletingCamera, setDeletingCamera] = useState<CameraItem | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    /* ---- Fetch cameras ---- */
    const { data: cameras, isLoading } = useQuery<CameraItem[]>({
        queryKey: ['cameras', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/cameras/?orgId=${orgId}`)
            return data
        },
        enabled: !!orgId,
        placeholderData: [],
    })

    const cameraList = cameras ?? []

    /* ---- Open modal ---- */
    const openAdd = () => {
        setEditingCamera(null)
        setModalOpen(true)
    }

    const openEdit = (cam: CameraItem) => {
        setEditingCamera(cam)
        setModalOpen(true)
    }

    /* ---- Delete ---- */
    const handleDelete = async () => {
        if (!deletingCamera) return
        setIsDeleting(true)
        try {
            await apiClient.delete(`/cameras/${deletingCamera.id}`)
            queryClient.invalidateQueries({ queryKey: ['cameras', orgId] })
        } catch {
            // silently ignore for now
        } finally {
            setIsDeleting(false)
            setDeletingCamera(null)
        }
    }

    /* ---- Refetch after save ---- */
    const handleSaved = () => {
        queryClient.invalidateQueries({ queryKey: ['cameras', orgId] })
    }

    /* ================================================================ */
    /*  Render                                                           */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cameras</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {cameraList.length} camera{cameraList.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500"
                >
                    <Plus className="h-4 w-4" />
                    Add Camera
                </button>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-netra-400" />
                </div>
            ) : cameraList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-slate-900/60 py-20 text-center backdrop-blur-sm">
                    <Camera className="mb-3 h-12 w-12 text-slate-700" />
                    <p className="text-sm font-medium text-slate-400">
                        No cameras added yet
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                        Click "Add Camera" to connect your first RTSP feed
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {cameraList.map((cam) => {
                        const sc = statusConfig(cam.status)
                        const StatusIcon = sc.icon

                        return (
                            <div
                                key={cam.id}
                                className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-sm transition hover:border-white/10"
                            >
                                {/* Camera Header */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-white/5">
                                                    <Camera className="h-5 w-5 text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-sm font-semibold text-white">
                                                        {cam.name}
                                                    </h3>
                                                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                                        <MapPin className="h-3 w-3" />
                                                        {cam.location}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status badge */}
                                            <span
                                                className={[
                                                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                                    sc.badge,
                                                ].join(' ')}
                                            >
                                                <span
                                                    className={[
                                                        'h-1.5 w-1.5 rounded-full shadow-sm',
                                                        sc.dot,
                                                    ].join(' ')}
                                                />
                                                {sc.label}
                                            </span>
                                        </div>

                                        {/* Meta */}
                                        {cam.zone && (
                                            <p className="text-xs text-slate-500">
                                                Zone: <span className="text-slate-400">{cam.zone}</span>
                                            </p>
                                        )}

                                        {/* RTSP URL (truncated) */}
                                        <p className="truncate rounded-lg bg-slate-800/50 px-3 py-2 font-mono text-xs text-slate-500">
                                            {cam.rtspUrl}
                                        </p>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                                            <button
                                                onClick={() => openEdit(cam)}
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => setDeletingCamera(cam)}
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>


                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <CameraModal
                key={editingCamera?.id ?? 'new'}
                open={modalOpen}
                camera={editingCamera}
                onClose={() => {
                    setModalOpen(false);
                    setEditingCamera(null);
                }}
                onSaved={handleSaved}
                orgId={orgId}
            />

            {/* Delete dialog */}
            <DeleteDialog
                camera={deletingCamera}
                onClose={() => setDeletingCamera(null)}
                onConfirm={handleDelete}
                deleting={isDeleting}
            />
        </div>
    );
}
