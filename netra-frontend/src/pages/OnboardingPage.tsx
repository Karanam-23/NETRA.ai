import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/apiClient'
import {
    Shield,
    Camera,
    Users,
    ChevronRight,
    ChevronLeft,
    Check,
    Plus,
    Trash2,
    Loader2,
    Sparkles,
} from 'lucide-react'

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const STEPS = ['Welcome', 'Add Camera', 'Invite Team'] as const
const ROLES = ['org_admin', 'operator', 'viewer', 'responder'] as const

/* ================================================================== */
/*  Schemas                                                            */
/* ================================================================== */

const cameraSchema = z.object({
    name: z.string().min(2, 'Camera name is required'),
    rtspUrl: z
        .string()
        .min(1, 'RTSP URL is required')
        .regex(
            /^rtsp:\/\//,
            'Must start with rtsp://'
        ),
    location: z.string().min(1, 'Location is required'),
})

type CameraFormValues = z.infer<typeof cameraSchema>

const inviteSchema = z.object({
    email: z.string().email('Enter a valid email'),
    role: z.enum(ROLES, { required_error: 'Select a role' }),
})

type InviteFormValues = z.infer<typeof inviteSchema>

/* ================================================================== */
/*  Progress Bar                                                       */
/* ================================================================== */

function ProgressBar({ currentStep }: { currentStep: number }) {
    return (
        <div className="mb-10">
            <div className="flex items-center justify-between">
                {STEPS.map((label, i) => {
                    const completed = i < currentStep
                    const active = i === currentStep

                    return (
                        <div key={label} className="flex flex-1 items-center">
                            {/* Step circle */}
                            <div className="flex flex-col items-center">
                                <div
                                    className={[
                                        'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300',
                                        completed
                                            ? 'bg-netra-600 text-white'
                                            : active
                                                ? 'bg-netra-600/20 text-netra-400 ring-2 ring-netra-500'
                                                : 'bg-slate-800 text-slate-500 ring-1 ring-white/10',
                                    ].join(' ')}
                                >
                                    {completed ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                <span
                                    className={[
                                        'mt-2 text-xs font-medium',
                                        active
                                            ? 'text-netra-400'
                                            : completed
                                                ? 'text-slate-300'
                                                : 'text-slate-600',
                                    ].join(' ')}
                                >
                                    {label}
                                </span>
                            </div>

                            {/* Connector line */}
                            {i < STEPS.length - 1 && (
                                <div
                                    className={[
                                        'mx-3 h-0.5 flex-1 rounded-full transition-colors duration-300',
                                        i < currentStep
                                            ? 'bg-netra-600'
                                            : 'bg-slate-800',
                                    ].join(' ')}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Step 1: Welcome                                                    */
/* ================================================================== */

function WelcomeStep() {
    const { orgId, email } = useAuthStore()

    return (
        <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-netra-600/20 ring-1 ring-netra-500/20">
                <Sparkles className="h-10 w-10 text-netra-400" />
            </div>

            <div>
                <h2 className="text-2xl font-bold text-white">
                    Welcome to Netra.AI
                </h2>
                <p className="mt-2 text-slate-400">
                    Let's get your security operations centre set up in a few quick
                    steps.
                </p>
            </div>

            <div className="mx-auto max-w-sm rounded-xl border border-white/5 bg-slate-800/50 p-5 text-left">
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Organization</span>
                        <span className="font-medium text-white">
                            {orgId || 'Your Org'}
                        </span>
                    </div>
                    <div className="border-t border-white/5" />
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Account</span>
                        <span className="font-medium text-white">
                            {email || '—'}
                        </span>
                    </div>
                    <div className="border-t border-white/5" />
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Plan</span>
                        <span className="inline-flex items-center rounded-full bg-netra-600/20 px-2.5 py-0.5 text-xs font-medium text-netra-400 ring-1 ring-inset ring-netra-500/30">
                            Starter
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Step 2: Add Camera                                                 */
/* ================================================================== */

function CameraStep({
    cameras,
    onAdd,
    onRemove,
}: {
    cameras: CameraFormValues[]
    onAdd: (c: CameraFormValues) => Promise<void>
    onRemove: (i: number) => void
}) {
    const [saving, setSaving] = useState(false)
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CameraFormValues>({
        resolver: zodResolver(cameraSchema),
        defaultValues: { name: '', rtspUrl: '', location: '' },
    })

    const submit = async (data: CameraFormValues) => {
        setSaving(true)
        try {
            await onAdd(data)
            reset()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-netra-600/20 ring-1 ring-netra-500/20">
                    <Camera className="h-7 w-7 text-netra-400" />
                </div>
                <h2 className="text-xl font-bold text-white">
                    Add Your First Camera
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                    Connect an RTSP camera feed to start monitoring.
                </p>
            </div>

            {/* Already-added cameras */}
            {cameras.length > 0 && (
                <div className="space-y-2">
                    {cameras.map((cam, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/50 px-4 py-3"
                        >
                            <div>
                                <p className="text-sm font-medium text-white">
                                    {cam.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {cam.location} · {cam.rtspUrl}
                                </p>
                            </div>
                            <button
                                onClick={() => onRemove(i)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                                aria-label="Remove camera"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add camera form */}
            <form onSubmit={handleSubmit(submit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                            'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition font-mono',
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

                <button
                    type="submit"
                    disabled={saving}
                    className={[
                        'flex items-center gap-2 rounded-lg border border-netra-500/30 bg-netra-600/10 px-4 py-2 text-sm font-medium text-netra-400 transition',
                        'hover:bg-netra-600/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                    ].join(' ')}
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    {saving ? 'Saving…' : 'Add Camera'}
                </button>
            </form>
        </div>
    )
}

/* ================================================================== */
/*  Step 3: Invite Team                                                */
/* ================================================================== */

interface Invite {
    email: string
    role: string
}

function InviteStep({
    invites,
    onAdd,
    onRemove,
}: {
    invites: Invite[]
    onAdd: (inv: Invite) => Promise<void>
    onRemove: (i: number) => void
}) {
    const [saving, setSaving] = useState(false)
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { email: '', role: 'operator' },
    })

    const submit = async (data: InviteFormValues) => {
        setSaving(true)
        try {
            await onAdd(data)
            reset()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-netra-600/20 ring-1 ring-netra-500/20">
                    <Users className="h-7 w-7 text-netra-400" />
                </div>
                <h2 className="text-xl font-bold text-white">
                    Invite Your Team
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                    Add team members to collaborate on security monitoring. You can
                    skip this and do it later.
                </p>
            </div>

            {/* Already-invited members */}
            {invites.length > 0 && (
                <div className="space-y-2">
                    {invites.map((inv, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/50 px-4 py-3"
                        >
                            <div>
                                <p className="text-sm font-medium text-white">
                                    {inv.email}
                                </p>
                                <p className="text-xs capitalize text-slate-500">
                                    {inv.role.replace('_', ' ')}
                                </p>
                            </div>
                            <button
                                onClick={() => onRemove(i)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                                aria-label="Remove invite"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Invite form */}
            <form onSubmit={handleSubmit(submit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="colleague@company.com"
                            {...register('email')}
                            className={[
                                'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition',
                                'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                errors.email ? 'border-red-500/50' : 'border-white/10',
                            ].join(' ')}
                        />
                        {errors.email && (
                            <p className="text-xs text-red-400">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">
                            Role
                        </label>
                        <select
                            {...register('role')}
                            className={[
                                'block w-full rounded-lg border bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none transition',
                                'focus:border-netra-500 focus:ring-2 focus:ring-netra-500/20',
                                errors.role ? 'border-red-500/50' : 'border-white/10',
                            ].join(' ')}
                        >
                            <option value="org_admin">Org Admin</option>
                            <option value="operator">Operator</option>
                            <option value="viewer">Viewer</option>
                            <option value="responder">Responder</option>
                        </select>
                        {errors.role && (
                            <p className="text-xs text-red-400">
                                {errors.role.message}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className={[
                        'flex items-center gap-2 rounded-lg border border-netra-500/30 bg-netra-600/10 px-4 py-2 text-sm font-medium text-netra-400 transition',
                        'hover:bg-netra-600/20',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                    ].join(' ')}
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    {saving ? 'Inviting…' : 'Send Invite'}
                </button>
            </form>
        </div>
    )
}

/* ================================================================== */
/*  Main wizard component                                              */
/* ================================================================== */

export default function OnboardingPage() {
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [cameras, setCameras] = useState<CameraFormValues[]>([])
    const [invites, setInvites] = useState<Invite[]>([])
    const [error, setError] = useState<string | null>(null)

    /* ---- Camera handlers ---- */
    const addCamera = async (cam: CameraFormValues) => {
        setError(null)
        try {
            await apiClient.post('/cameras/', cam)
            setCameras((prev) => [...prev, cam])
        } catch (err: any) {
            setError(
                err?.response?.data?.detail || 'Failed to add camera. Try again.'
            )
        }
    }

    const removeCamera = (index: number) => {
        setCameras((prev) => prev.filter((_, i) => i !== index))
    }

    /* ---- Invite handlers ---- */
    const addInvite = async (inv: Invite) => {
        setError(null)
        try {
            await apiClient.post('/org/members/invite', inv)
            setInvites((prev) => [...prev, inv])
        } catch (err: any) {
            setError(
                err?.response?.data?.detail || 'Failed to send invite. Try again.'
            )
        }
    }

    const removeInvite = (index: number) => {
        setInvites((prev) => prev.filter((_, i) => i !== index))
    }

    /* ---- Navigation ---- */
    const isLastStep = step === STEPS.length - 1
    const canGoBack = step > 0

    const handleNext = () => {
        if (isLastStep) {
            navigate('/dashboard', { replace: true })
        } else {
            setStep((s) => s + 1)
            setError(null)
        }
    }

    const handleBack = () => {
        setStep((s) => Math.max(0, s - 1))
        setError(null)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
            {/* Radial glow */}
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-center gap-3">
                    <Shield className="h-7 w-7 text-netra-400" />
                    <span className="text-xl font-bold tracking-tight text-white">
                        Netra<span className="text-netra-400">.AI</span>
                    </span>
                </div>

                {/* Progress bar */}
                <ProgressBar currentStep={step} />

                {/* Step card */}
                <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-8 shadow-xl backdrop-blur-sm">
                    {/* Error banner */}
                    {error && (
                        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Step content */}
                    {step === 0 && <WelcomeStep />}
                    {step === 1 && (
                        <CameraStep
                            cameras={cameras}
                            onAdd={addCamera}
                            onRemove={removeCamera}
                        />
                    )}
                    {step === 2 && (
                        <InviteStep
                            invites={invites}
                            onAdd={addInvite}
                            onRemove={removeInvite}
                        />
                    )}

                    {/* Navigation buttons */}
                    <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                        {canGoBack ? (
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </button>
                        ) : (
                            <div />
                        )}

                        <div className="flex items-center gap-3">
                            {/* Skip (only on invite step) */}
                            {step === 2 && invites.length === 0 && (
                                <button
                                    onClick={() =>
                                        navigate('/dashboard', { replace: true })
                                    }
                                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-300"
                                >
                                    Skip for now
                                </button>
                            )}

                            <button
                                onClick={handleNext}
                                className={[
                                    'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition',
                                    'bg-netra-600 hover:bg-netra-500 active:bg-netra-700',
                                ].join(' ')}
                            >
                                {isLastStep ? 'Finish Setup' : 'Next'}
                                {!isLastStep && (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                                {isLastStep && <Check className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
