import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import logo from '@/assets/logo.png'

/* ------------------------------------------------------------------ */
/*  Validation schema                                                  */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

/* ------------------------------------------------------------------ */
/*  Firebase error → user-friendly message                             */
/* ------------------------------------------------------------------ */

function firebaseErrorMessage(code: string): string {
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.'
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.'
        case 'auth/user-disabled':
            return 'This account has been disabled.'
        case 'auth/network-request-failed':
            return 'Network error. Check your connection.'
        default:
            return 'Something went wrong. Please try again.'
    }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    const onSubmit = async (data: LoginFormValues) => {
        setServerError(null)
        setLoading(true)
        try {
            await signInWithEmailAndPassword(auth, data.email, data.password)
            navigate('/dashboard', { replace: true })
        } catch (err: any) {
            setServerError(firebaseErrorMessage(err?.code ?? ''))
        } finally {
            setLoading(false)
        }
    }

    const goDemo = (role: string) => {
        navigate(`/demo/${role}`)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 font-sans relative overflow-hidden text-white">
            {/* Animated dotted background (CSS only) */}
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
                        className="h-16 w-auto mb-4"
                        style={{ filter: 'brightness(0) invert(1)' }}
                    />
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Netra.AI</h1>
                    <p className="text-sm font-medium text-[#00d4ff] uppercase tracking-wider mb-5">
                        Intelligent Threat Detection
                    </p>

                    {/* Stat Pills */}
                    <div className="flex flex-wrap justify-center gap-2 mb-2 text-[10px] uppercase font-mono tracking-wider text-gray-400">
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">Sub-3s Alert Response</span>
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">16 Cameras Per Node</span>
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">Zero Victim Interaction</span>
                    </div>
                </div>

                {/* Card */}
                <div className="rounded-xl border border-white/10 bg-[#0f1117]/80 p-8 shadow-2xl backdrop-blur-md">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {serverError && (
                            <div className="rounded border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-sm text-[#ff3b3b]">
                                {serverError}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Email
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                placeholder="operator@command.center"
                                {...register('email')}
                                className={[
                                    'block w-full rounded border bg-black/40 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition',
                                    'focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]',
                                    errors.email ? 'border-[#ff3b3b]/50' : 'border-white/10',
                                ].join(' ')}
                            />
                            {errors.email && <p className="text-xs text-[#ff3b3b]">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Password
                                </label>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    {...register('password')}
                                    className={[
                                        'block w-full rounded border bg-black/40 px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-600 outline-none transition',
                                        'focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]',
                                        errors.password ? 'border-[#ff3b3b]/50' : 'border-white/10',
                                    ].join(' ')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-[#ff3b3b]">{errors.password.message}</p>}
                        </div>

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
                            {loading ? 'Authenticating…' : 'Sign In'}
                        </button>
                    </form>

                    {/* Demo Access */}
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-3">DEMO ACCESS — Click to explore</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => goDemo('super_admin')} type="button" className="text-xs px-2 py-1.5 border border-white/10 rounded text-gray-400 hover:text-white hover:border-white/30 transition">Super Admin</button>
                            <button onClick={() => goDemo('org_admin')} type="button" className="text-xs px-2 py-1.5 border border-white/10 rounded text-gray-400 hover:text-white hover:border-white/30 transition">Organisation Admin</button>
                            <button onClick={() => goDemo('operator')} type="button" className="text-xs px-2 py-1.5 border border-white/10 rounded text-gray-400 hover:text-white hover:border-white/30 transition">Operator</button>
                            <button onClick={() => goDemo('viewer')} type="button" className="text-xs px-2 py-1.5 border border-white/10 rounded text-gray-400 hover:text-white hover:border-white/30 transition">Viewer</button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3 font-mono">Demo mode · No login required · Simulated data</p>
                    </div>
                </div>

                {/* Footer link & Security Badges */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p className="mb-4">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-semibold text-[#00d4ff] hover:underline transition">
                            Create one
                        </Link>
                    </p>
                    <div className="flex justify-center gap-4 text-[9px] uppercase font-mono tracking-widest text-gray-600">
                        <span>AES-256 Encrypted</span>
                        <span>•</span>
                        <span>JWT Secured</span>
                        <span>•</span>
                        <span>RBAC Enforced</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
