import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    MapPin,
    Camera,
    Plus,
    Pencil,
    Trash2,
    X,
    Loader2,
    Clock,
    Shield,
} from 'lucide-react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Zone {
    id: string
    name: string
    cameraId: string
    cameraName: string
    activeHoursStart: string
    activeHoursEnd: string
    confidenceThreshold: number
}

interface CameraOption {
    id: string
    name: string
}

/* ================================================================== */
/*  Schema                                                             */
/* ================================================================== */

const zoneSchema = z.object({
    name: z.string().min(2, 'Zone name is required'),
    cameraId: z.string().min(1, 'Select a camera'),
    activeHoursStart: z.string().min(1, 'Start time required'),
    activeHoursEnd: z.string().min(1, 'End time required'),
    confidenceThreshold: z.coerce
        .number()
        .min(0.1, 'Min 10%')
        .max(1, 'Max 100%'),
})

type ZoneFormValues = z.infer<typeof zoneSchema>

/* ================================================================== */
/*  Zone Modal                                                         */
/* ================================================================== */

function ZoneModal({
    open,
    zone,
    cameras,
    onClose,
    onSaved,
    orgId,
}: {
    open: boolean
    zone: Zone | null
    cameras: CameraOption[]
    onClose: () => void
    onSaved: () => void
    orgId: string | null
}) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isEdit = !!zone

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<ZoneFormValues>({
        resolver: zodResolver(zoneSchema),
        defaultValues: {
            name: zone?.name ?? '',
            cameraId: zone?.cameraId ?? '',
            activeHoursStart: zone?.activeHoursStart ?? '00:00',
            activeHoursEnd: zone?.activeHoursEnd ?? '23:59',
            confidenceThreshold: zone?.confidenceThreshold ?? 0.6,
        },
    })

    const threshold = watch('confidenceThreshold')

    const onSubmit = async (data: ZoneFormValues) => {
        setSaving(true)
        setError(null)
        try {
            if (isEdit) {
                await apiClient.put(`/zones/${zone!.id}`, { ...data, orgId })
            } else {
                await apiClient.post('/zones/', { ...data, orgId })
            }
            onSaved()
            onClose()
        } catch (err: any) {
            setError(
                err?.response?.data?.detail || 'Failed to save zone. Try again.'
            )
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-lg rounded-2xl border border-white/5 bg-slate-900 p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">
                            {isEdit ? 'Edit Zone' : 'Add Zone'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 hover:text-white transition"
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
                        {/* Zone name */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Zone Name
                            </label>
                            <input
                                placeholder="Perimeter North"
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

                        {/* Camera select */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Camera
                            </label>
                            <select
                                {...register('cameraId')}
                                className={[
                                    'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition',
                                    'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                    errors.cameraId ? 'border-red-500/50' : 'border-white/10',
                                ].join(' ')}
                            >
                                <option value="">Select camera…</option>
                                {cameras.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            {errors.cameraId && (
                                <p className="text-xs text-red-400">
                                    {errors.cameraId.message}
                                </p>
                            )}
                        </div>

                        {/* Active hours */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">
                                    Active From
                                </label>
                                <input
                                    type="time"
                                    {...register('activeHoursStart')}
                                    className={[
                                        'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition',
                                        'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                        errors.activeHoursStart
                                            ? 'border-red-500/50'
                                            : 'border-white/10',
                                    ].join(' ')}
                                />
                                {errors.activeHoursStart && (
                                    <p className="text-xs text-red-400">
                                        {errors.activeHoursStart.message}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">
                                    Active Until
                                </label>
                                <input
                                    type="time"
                                    {...register('activeHoursEnd')}
                                    className={[
                                        'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition',
                                        'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                        errors.activeHoursEnd
                                            ? 'border-red-500/50'
                                            : 'border-white/10',
                                    ].join(' ')}
                                />
                                {errors.activeHoursEnd && (
                                    <p className="text-xs text-red-400">
                                        {errors.activeHoursEnd.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Confidence threshold slider */}
                        <div className="space-y-1.5">
                            <label className="flex items-center justify-between text-sm font-medium text-slate-300">
                                <span>Confidence Threshold</span>
                                <span className="text-netra-400">
                                    {Math.round(threshold * 100)}%
                                </span>
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={threshold}
                                onChange={(e) =>
                                    setValue(
                                        'confidenceThreshold',
                                        parseFloat(e.target.value)
                                    )
                                }
                                className="w-full accent-netra-500"
                            />
                            <div className="flex justify-between text-xs text-slate-600">
                                <span>10%</span>
                                <span>100%</span>
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
                                className="flex items-center gap-2 rounded-lg bg-netra-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500 disabled:opacity-60"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isEdit ? 'Save Changes' : 'Add Zone'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

/* ================================================================== */
/*  Delete dialog                                                      */
/* ================================================================== */

function DeleteDialog({
    zone,
    onClose,
    onConfirm,
    deleting,
}: {
    zone: Zone | null
    onClose: () => void
    onConfirm: () => void
    deleting: boolean
}) {
    if (!zone) return null
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
                    <h2 className="text-lg font-semibold text-white">Delete Zone</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Delete{' '}
                        <span className="font-medium text-white">{zone.name}</span>?
                        This cannot be undone.
                    </p>
                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
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
/*  Main Component                                                     */
/* ================================================================== */

export default function ZonesPage() {
    const { orgId } = useAuthStore()
    const queryClient = useQueryClient()

    const [modalOpen, setModalOpen] = useState(false)
    const [editingZone, setEditingZone] = useState<Zone | null>(null)
    const [deletingZone, setDeletingZone] = useState<Zone | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    /* ---- Fetch zones ---- */
    const { data: zones, isLoading } = useQuery<Zone[]>({
        queryKey: ['zones', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/zones/?orgId=${orgId}`)
            return data
        },
        enabled: !!orgId,
        placeholderData: [],
    })

    /* ---- Fetch cameras for dropdown ---- */
    const { data: cameras } = useQuery<CameraOption[]>({
        queryKey: ['cameras-list', orgId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/cameras/?orgId=${orgId}`)
            return data.map((c: any) => ({ id: c.id, name: c.name }))
        },
        enabled: !!orgId,
        placeholderData: [],
    })

    const zoneList = zones ?? []
    const cameraList = cameras ?? []

    const openAdd = () => {
        setEditingZone(null)
        setModalOpen(true)
    }

    const openEdit = (z: Zone) => {
        setEditingZone(z)
        setModalOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingZone) return
        setIsDeleting(true)
        try {
            await apiClient.delete(`/zones/${deletingZone.id}`)
            queryClient.invalidateQueries({ queryKey: ['zones', orgId] })
        } catch {
            // silently
        } finally {
            setIsDeleting(false)
            setDeletingZone(null)
        }
    }

    const handleSaved = () => {
        queryClient.invalidateQueries({ queryKey: ['zones', orgId] })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-6 w-6 animate-spin text-netra-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Zones</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {zoneList.length} zone{zoneList.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 rounded-lg bg-netra-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-netra-500"
                >
                    <Plus className="h-4 w-4" />
                    Add Zone
                </button>
            </div>

            {/* Zone list */}
            {zoneList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-slate-900/60 py-20 text-center backdrop-blur-sm">
                    <MapPin className="mb-3 h-12 w-12 text-slate-700" />
                    <p className="text-sm font-medium text-slate-400">
                        No zones configured yet
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                        Create zones to define monitored areas within camera feeds
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Zone Name
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Camera
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden sm:table-cell">
                                        Active Hours
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400 hidden md:table-cell">
                                        Confidence
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-400">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {zoneList.map((zone) => (
                                    <tr
                                        key={zone.id}
                                        className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                                    >
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-netra-400" />
                                                <span className="font-medium text-white">
                                                    {zone.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Camera className="h-3.5 w-3.5 text-slate-500" />
                                                {zone.cameraName}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 hidden sm:table-cell">
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Clock className="h-3.5 w-3.5" />
                                                {zone.activeHoursStart} — {zone.activeHoursEnd}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 hidden md:table-cell">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-netra-500/10 px-2 py-0.5 text-xs font-medium text-netra-400">
                                                <Shield className="h-3 w-3" />
                                                {Math.round(zone.confidenceThreshold * 100)}%
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEdit(zone)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white transition"
                                                    aria-label="Edit zone"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingZone(zone)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                                                    aria-label="Delete zone"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            <ZoneModal
                key={editingZone?.id ?? 'new'}
                open={modalOpen}
                zone={editingZone}
                cameras={cameraList}
                onClose={() => {
                    setModalOpen(false)
                    setEditingZone(null)
                }}
                onSaved={handleSaved}
                orgId={orgId}
            />

            {/* Delete dialog */}
            <DeleteDialog
                zone={deletingZone}
                onClose={() => setDeletingZone(null)}
                onConfirm={handleDelete}
                deleting={isDeleting}
            />
        </div>
    )
}
