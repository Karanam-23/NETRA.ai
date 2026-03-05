import { useState, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom'
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
import { DemoContext, type DemoRole } from './DemoContext'

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const ROUTE_TO_ROLE: Record<string, DemoRole> = {
    super_admin: 'super_admin',
    org_admin: 'org_admin',
    operator: 'operator',
    viewer: 'viewer',
}

interface NavItem {
    label: string
    to: string
    icon: React.ElementType
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function roleBadgeClasses(role: DemoRole): string {
    switch (role) {
        case 'super_admin':
            return 'bg-purple-500/20 text-purple-400 ring-purple-500/30'
        case 'org_admin':
            return 'bg-[#00d4ff]/20 text-[#00d4ff] ring-[#00d4ff]/30'
        case 'operator':
            return 'bg-[#ffaa00]/20 text-[#ffaa00] ring-[#ffaa00]/30'
        case 'viewer':
            return 'bg-[#00ff88]/20 text-[#00ff88] ring-[#00ff88]/30'
    }
}

function formatRole(role: DemoRole): string {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/* ================================================================== */
/*  Sidebar link                                                       */
/* ================================================================== */

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
    const Icon = item.icon
    return (
        <NavLink
            to={item.to}
            end
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

/* ================================================================== */
/*  Toast component                                                    */
/* ================================================================== */

function DemoToast({ message, visible }: { message: string; visible: boolean }) {
    if (!visible) return null
    return (
        <div className="fixed top-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-[#ffaa00]/30 bg-[#0f1117] px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-top-2">
            <span className="h-2 w-2 rounded-full bg-[#ffaa00]" />
            <span className="text-sm font-medium text-[#ffaa00]">{message}</span>
        </div>
    )
}

/* ================================================================== */
/*  Main Layout                                                        */
/* ================================================================== */

export default function DemoLayout() {
    const navigate = useNavigate()
    const { role: roleParam } = useParams<{ role: string }>()
    const role: DemoRole = ROUTE_TO_ROLE[roleParam || ''] || 'org_admin'

    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [toastMsg, setToastMsg] = useState('')
    const [toastVisible, setToastVisible] = useState(false)

    const showDemoToast = useCallback((msg?: string) => {
        setToastMsg(msg || 'Not available in demo mode')
        setToastVisible(true)
        setTimeout(() => setToastVisible(false), 2500)
    }, [])

    const prefix = `/demo/${roleParam}`

    const mainNav: NavItem[] = [
        { label: 'Dashboard', to: prefix, icon: Shield },
        { label: 'Incidents', to: `${prefix}/incidents`, icon: AlertTriangle },
        { label: 'Cameras', to: `${prefix}/cameras`, icon: Camera },
        { label: 'Analytics', to: `${prefix}/analytics`, icon: BarChart2 },
    ]

    const systemNav: NavItem[] = []
    if (role === 'super_admin' || role === 'org_admin') {
        systemNav.push({ label: 'Settings', to: `${prefix}/settings`, icon: Settings })
    }

    const sidebarContent = (
        <div className="flex h-full flex-col font-sans">
            <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4 mb-2">
                <img src={logo} alt="Netra.AI" className="h-8 w-auto flex-shrink-0" style={{ filter: 'brightness(0) invert(1)' }} />
                {!collapsed && (
                    <span className="text-lg font-bold tracking-tight text-white">
                        Netra<span className="text-[#00d4ff]">.AI</span>
                    </span>
                )}
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto py-2">
                <p className={['mb-2 px-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-gray-500', collapsed ? 'sr-only' : ''].join(' ')}>
                    Main
                </p>
                {mainNav.map(item => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}

                <div className="my-6 border-t border-white/5" />

                {systemNav.length > 0 && (
                    <>
                        <p className={['mb-2 px-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-gray-500', collapsed ? 'sr-only' : ''].join(' ')}>
                            System
                        </p>
                        {systemNav.map(item => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}
                    </>
                )}
            </nav>

            {!collapsed && (
                <div className="p-4 text-[10px] font-mono tracking-widest text-gray-600 uppercase text-center border-t border-white/5">
                    v1.0.0 DEMO
                </div>
            )}

            <div className="hidden border-t border-white/5 p-3 lg:block">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center rounded p-2 text-gray-500 transition hover:bg-white/5 hover:text-white"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>
        </div>
    )

    return (
        <DemoContext.Provider value={{ role, showDemoToast }}>
            <div className="flex h-screen bg-[#0a0a0f] text-white font-sans selection:bg-[#00d4ff] selection:text-black">
                <DemoToast message={toastMsg} visible={toastVisible} />

                {mobileOpen && (
                    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
                )}

                <aside className={['fixed inset-y-0 left-0 z-50 w-64 transform bg-[#0d0d14] border-r border-white/5 transition-transform duration-300 lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full'].join(' ')}>
                    <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded p-1 text-gray-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                    {sidebarContent}
                </aside>

                <aside className={['hidden flex-shrink-0 border-r border-white/5 bg-[#0d0d14] transition-all duration-300 lg:block', collapsed ? 'w-20' : 'w-64'].join(' ')}>
                    {sidebarContent}
                </aside>

                <div className="flex flex-1 flex-col overflow-hidden relative">
                    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0f]/80 px-4 backdrop-blur-md lg:px-6 relative z-10">
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00d4ff]" />

                        <button onClick={() => setMobileOpen(true)} className="rounded p-2 text-gray-400 hover:text-white lg:hidden">
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="hidden items-center gap-3 lg:flex">
                            <span className="text-sm font-semibold tracking-wider uppercase text-gray-300">
                                Netra.AI Demo
                            </span>
                            <span className="rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-[#ffaa00]/20 text-[#ffaa00] ring-1 ring-inset ring-[#ffaa00]/30">
                                DEMO MODE
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className={['hidden rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase ring-1 ring-inset sm:inline-flex', roleBadgeClasses(role)].join(' ')}>
                                {formatRole(role)}
                            </span>
                            <span className="max-w-[180px] truncate text-xs font-mono text-gray-400">
                                demo@netra.ai
                            </span>
                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 transition hover:bg-[#ff3b3b]/10 hover:text-[#ff3b3b]"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:inline">Exit Demo</span>
                            </button>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto bg-[#0a0a0f] p-4 lg:p-6 z-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </DemoContext.Provider>
    )
}
