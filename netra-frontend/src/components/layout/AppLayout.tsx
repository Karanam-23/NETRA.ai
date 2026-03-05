import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { auth } from '@/lib/firebase'
import {
    Shield,
    Camera,
    AlertTriangle,
    BarChart2,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Menu,
    X,
} from 'lucide-react'
import logo from '@/assets/logo.png'

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */

interface NavItem {
    label: string
    to: string
    icon: React.ElementType
}

const mainNav: NavItem[] = [
    { label: 'Dashboard', to: '/dashboard', icon: Shield },
    { label: 'Incidents', to: '/incidents', icon: AlertTriangle },
    { label: 'Cameras', to: '/cameras', icon: Camera },
    { label: 'Analytics', to: '/analytics', icon: BarChart2 },
]

const settingsNav: NavItem[] = [
    { label: 'Settings', to: '/settings', icon: Settings },
]

/* ------------------------------------------------------------------ */
/*  Role badge colors                                                  */
/* ------------------------------------------------------------------ */

function roleBadgeClasses(role: string | null): string {
    switch (role) {
        case 'super_admin':
            return 'bg-[#ff3b3b]/20 text-[#ff3b3b] ring-[#ff3b3b]/30'
        case 'org_admin':
            return 'bg-[#ffaa00]/20 text-[#ffaa00] ring-[#ffaa00]/30'
        case 'operator':
            return 'bg-[#00d4ff]/20 text-[#00d4ff] ring-[#00d4ff]/30'
        case 'viewer':
            return 'bg-[#00ff88]/20 text-[#00ff88] ring-[#00ff88]/30'
        default:
            return 'bg-gray-500/20 text-gray-300 ring-gray-500/30'
    }
}

function formatRole(role: string | null): string {
    if (!role) return 'Viewer'
    return role
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

/* ------------------------------------------------------------------ */
/*  Sidebar link component                                             */
/* ------------------------------------------------------------------ */

function SidebarLink({
    item,
    collapsed,
}: {
    item: NavItem
    collapsed: boolean
}) {
    const Icon = item.icon

    return (
        <NavLink
            to={item.to}
            className={({ isActive }) =>
                [
                    'group flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 border-l-2',
                    collapsed ? 'justify-center border-transparent' : '',
                    isActive
                        ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white',
                ].join(' ')
            }
        >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
        </NavLink>
    )
}

/* ------------------------------------------------------------------ */
/*  Main layout                                                        */
/* ------------------------------------------------------------------ */

export default function AppLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const { email, role, orgId } = useAuthStore()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await auth.signOut()
        navigate('/login')
    }

    /* ---- Sidebar content (shared between desktop & mobile) ---- */
    const sidebarContent = (
        <div className="flex h-full flex-col font-sans">
            {/* Logo */}
            <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4 mb-2">
                <img
                    src={logo}
                    alt="Netra.AI"
                    className="h-8 w-auto flex-shrink-0"
                    style={{ filter: 'brightness(0) invert(1)' }}
                />
                {!collapsed && (
                    <span className="text-lg font-bold tracking-tight text-white">
                        Netra<span className="text-[#00d4ff]">.AI</span>
                    </span>
                )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 space-y-1 overflow-y-auto py-2">
                <p
                    className={[
                        'mb-2 px-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-gray-500',
                        collapsed ? 'sr-only' : '',
                    ].join(' ')}
                >
                    Main
                </p>
                {mainNav.map((item) => (
                    <SidebarLink
                        key={item.to}
                        item={item}
                        collapsed={collapsed}
                    />
                ))}

                <div className="my-6 border-t border-white/5" />

                <p
                    className={[
                        'mb-2 px-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-gray-500',
                        collapsed ? 'sr-only' : '',
                    ].join(' ')}
                >
                    System
                </p>
                {settingsNav.map((item) => (
                    <SidebarLink
                        key={item.to}
                        item={item}
                        collapsed={collapsed}
                    />
                ))}
            </nav>

            {/* Footer Version */}
            {!collapsed && (
                <div className="p-4 text-[10px] font-mono tracking-widest text-gray-600 uppercase text-center border-t border-white/5">
                    v1.0.0
                </div>
            )}

            {/* Collapse toggle (desktop only) */}
            <div className="hidden border-t border-white/5 p-3 lg:block">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center rounded p-2 text-gray-500 transition hover:bg-white/5 hover:text-white"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    )

    return (
        <div className="flex h-screen bg-[#0a0a0f] text-white font-sans selection:bg-[#00d4ff] selection:text-black">
            {/* ---- Mobile overlay ---- */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ---- Mobile sidebar drawer ---- */}
            <aside
                className={[
                    'fixed inset-y-0 left-0 z-50 w-64 transform bg-[#0d0d14] border-r border-white/5 transition-transform duration-300 lg:hidden',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                ].join(' ')}
            >
                {/* Close button */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute right-3 top-4 rounded p-1 text-gray-400 hover:text-white"
                    aria-label="Close sidebar"
                >
                    <X className="h-5 w-5" />
                </button>
                {sidebarContent}
            </aside>

            {/* ---- Desktop sidebar ---- */}
            <aside
                className={[
                    'hidden flex-shrink-0 border-r border-white/5 bg-[#0d0d14] transition-all duration-300 lg:block',
                    collapsed ? 'w-20' : 'w-64',
                ].join(' ')}
            >
                {sidebarContent}
            </aside>

            {/* ---- Main content area ---- */}
            <div className="flex flex-1 flex-col overflow-hidden relative">
                {/* Top header bar */}
                <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0f]/80 px-4 backdrop-blur-md lg:px-6 relative z-10">
                    {/* Cyan Top Border Layer mapped via absolute positioning for header thin line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00d4ff]"></div>

                    {/* Left: mobile menu button */}
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="rounded p-2 text-gray-400 hover:text-white lg:hidden"
                        aria-label="Open menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Org name */}
                    <div className="hidden items-center gap-2 lg:flex">
                        <span className="text-sm font-semibold tracking-wider uppercase text-gray-300">
                            {orgId || 'No Organization'}
                        </span>
                    </div>

                    {/* Right: user info + sign out */}
                    <div className="flex items-center gap-4">
                        {/* Role badge */}
                        <span
                            className={[
                                'hidden rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase ring-1 ring-inset sm:inline-flex',
                                roleBadgeClasses(role),
                            ].join(' ')}
                        >
                            {formatRole(role)}
                        </span>

                        {/* User email */}
                        <span className="max-w-[180px] truncate text-xs font-mono text-gray-400">
                            {email || 'user@netra.ai'}
                        </span>

                        {/* Sign out */}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 transition hover:bg-[#ff3b3b]/10 hover:text-[#ff3b3b]"
                            aria-label="Sign out"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Sign out</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-[#0a0a0f] p-4 lg:p-6 z-0">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
