import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import apiClient from '@/lib/apiClient'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import logo from '@/assets/logo.png'

/* ------------------------------------------------------------------ */
/*  Validation schema                                                  */
/* ------------------------------------------------------------------ */

const signupSchema = z
    .object({
        orgName: z
            .string()
            .min(2, 'Organization name must be at least 2 characters')
            .max(80, 'Organization name is too long'),
        displayName: z
            .string()
            .min(2, 'Full name must be at least 2 characters')
            .max(60, 'Name is too long'),
        email: z.string().email('Enter a valid email address'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Must contain at least one number'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    })

type SignupFormValues = z.infer<typeof signupSchema>

/* ------------------------------------------------------------------ */
/*  Reusable input component                                           */
/* ------------------------------------------------------------------ */

interface FieldProps {
    id: string
    label: string
    type?: string
    placeholder?: string
    autoComplete?: string
    error?: string
    register: any
    showToggle?: boolean
    showPassword?: boolean
    onToggle?: () => void
}

function Field({
    id,
    label,
    type = 'text',
    placeholder,
    autoComplete,
    error,
    register,
    showToggle,
    showPassword,
    onToggle,
}: FieldProps) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={showToggle ? (showPassword ? 'text' : 'password') : type}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    {...register}
                    className={[
                        'block w-full rounded border bg-black/40 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition',
                        'focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]',
                        showToggle ? 'pr-10' : '',
                        error ? 'border-[#ff3b3b]/50' : 'border-white/10',
                    ].join(' ')}
                />
                {showToggle && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-[#ff3b3b]">{error}</p>}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SignupPage() {
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            orgName: '',
            displayName: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
    })

    const onSubmit = async (data: SignupFormValues) => {
        setServerError(null)
        setLoading(true)
        try {
            await apiClient.post('/onboarding/create-org', {
                email: data.email,
                password: data.password,
                displayName: data.displayName,
                orgName: data.orgName,
            })
            await signInWithEmailAndPassword(auth, data.email, data.password)
            navigate('/onboarding', { replace: true })
        } catch (err: any) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Something went wrong. Please try again.'
            setServerError(typeof msg === 'string' ? msg : JSON.stringify(msg))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-10 font-sans relative overflow-hidden text-white">
            {/* Animated dotted background */}
            <div className="absolute inset-0 z-0 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
                animation: 'moveBg 20s linear infinite'
            }} />
            <style>
                {`
                    @keyframes moveBg {
                        0% { background-position: 0 0; }
                        100% { background-position: 300px 300px; }
                    }
                `}
            </style>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo & Header */}
                <div className="mb-6 flex flex-col items-center text-center">
                    <img
                        src={logo}
                        alt="Netra.AI Logo"
                        className="h-14 w-auto mb-4"
                        style={{ filter: 'brightness(0) invert(1)' }}
                    />
                    <h1 className="text-2xl font-bold tracking-tight mb-2">Create Organization</h1>
                    <p className="text-sm text-gray-400">Join the Netra.AI Global Security Network</p>
                </div>

                {/* Card */}
                <div className="rounded-xl border border-white/10 bg-[#0f1117]/80 p-8 shadow-2xl backdrop-blur-md">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {serverError && (
                            <div className="rounded border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-sm text-[#ff3b3b]">
                                {serverError}
                            </div>
                        )}

                        <Field
                            id="orgName"
                            label="Organization Name"
                            placeholder="Acme Security Corp"
                            autoComplete="organization"
                            register={register('orgName')}
                            error={errors.orgName?.message}
                        />

                        <Field
                            id="displayName"
                            label="Full Name"
                            placeholder="Jane Doe"
                            autoComplete="name"
                            register={register('displayName')}
                            error={errors.displayName?.message}
                        />

                        <Field
                            id="email"
                            label="Email"
                            type="email"
                            placeholder="operator@command.center"
                            autoComplete="email"
                            register={register('email')}
                            error={errors.email?.message}
                        />

                        <Field
                            id="password"
                            label="Password"
                            placeholder="••••••••"
                            autoComplete="new-password"
                            register={register('password')}
                            error={errors.password?.message}
                            showToggle
                            showPassword={showPassword}
                            onToggle={() => setShowPassword(!showPassword)}
                        />

                        <Field
                            id="confirmPassword"
                            label="Confirm Password"
                            placeholder="••••••••"
                            autoComplete="new-password"
                            register={register('confirmPassword')}
                            error={errors.confirmPassword?.message}
                            showToggle
                            showPassword={showPassword}
                            onToggle={() => setShowPassword(!showPassword)}
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className={[
                                'flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-sm font-bold uppercase tracking-widest text-black transition mt-6',
                                'bg-[#00d4ff] hover:bg-[#00d4ff]/90 active:scale-[0.98]',
                                'disabled:cursor-not-allowed disabled:opacity-60',
                            ].join(' ')}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Creating Account…' : 'Create Organization'}
                        </button>
                    </form>
                </div>

                {/* Footer link */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-[#00d4ff] hover:underline transition">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
