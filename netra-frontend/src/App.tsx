import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/store/authStore'
import React, { Suspense } from 'react'

// ---------- Layout ----------
import AppLayout from '@/components/layout/AppLayout'

// ---------- Lazy-loaded Page Components ----------
const LoginPage = React.lazy(() => import('@/pages/LoginPage'))
const SignupPage = React.lazy(() => import('@/pages/SignupPage'))
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'))
const IncidentsPage = React.lazy(() => import('@/pages/IncidentsPage'))
const IncidentDetailPage = React.lazy(() => import('@/pages/IncidentDetailPage'))
const CamerasPage = React.lazy(() => import('@/pages/CamerasPage'))
const AnalyticsPage = React.lazy(() => import('@/pages/AnalyticsPage'))
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'))
const OnboardingPage = React.lazy(() => import('@/pages/OnboardingPage'))
const ZonesPage = React.lazy(() => import('@/pages/ZonesPage'))
const DemoLayout = React.lazy(() => import('@/pages/demo/DemoLayout'))
const DemoPage = React.lazy(() => import('@/pages/demo/DemoPage'))
const DemoCamerasPage = React.lazy(() => import('@/pages/demo/DemoCamerasPage'))
const DemoIncidentsPage = React.lazy(() => import('@/pages/demo/DemoIncidentsPage'))
const DemoIncidentDetailPage = React.lazy(() => import('@/pages/demo/DemoIncidentDetailPage'))
const DemoAnalyticsPage = React.lazy(() => import('@/pages/demo/DemoAnalyticsPage'))
const DemoSettingsPage = React.lazy(() => import('@/pages/demo/DemoSettingsPage'))

// ---------- Loading Spinner ----------
function LoadingScreen() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-netra-400 border-t-transparent" />
                <p className="text-sm text-netra-300">Loading Netra.AI...</p>
            </div>
        </div>
    )
}

// ---------- Protected Route Wrapper ----------
interface ProtectedRouteProps {
    allowedRoles?: UserRole[]
}

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { user, role, loading, orgId } = useAuthStore()

    if (loading) return <LoadingScreen />
    if (!user) return <Navigate to="/login" replace />

    // If user has no org yet, redirect to onboarding
    if (!orgId && window.location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />
    }

    // Role-based access control
    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" replace />
    }

    return <Outlet />
}

// ---------- Public Route Wrapper ----------
function PublicRoute() {
    const { user, loading } = useAuthStore()
    if (loading) return <LoadingScreen />
    if (user) return <Navigate to="/dashboard" replace />
    return <Outlet />
}

// ---------- Root App ----------
export default function App() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <Routes>
                {/* Public routes — redirect to /dashboard if already logged in */}
                <Route element={<PublicRoute />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                </Route>

                {/* Demo routes — public, no auth, wrapped in DemoLayout */}
                <Route path="/demo/:role" element={<DemoLayout />}>
                    <Route index element={<DemoPage />} />
                    <Route path="incidents" element={<DemoIncidentsPage />} />
                    <Route path="incidents/:id" element={<DemoIncidentDetailPage />} />
                    <Route path="cameras" element={<DemoCamerasPage />} />
                    <Route path="analytics" element={<DemoAnalyticsPage />} />
                    <Route path="settings" element={<DemoSettingsPage />} />
                </Route>

                {/* Protected routes inside AppLayout — all authenticated users */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/incidents" element={<IncidentsPage />} />
                        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
                        <Route path="/cameras" element={<CamerasPage />} />
                        <Route path="/zones" element={<ZonesPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                    </Route>
                    {/* Onboarding is full-screen, no layout */}
                    <Route path="/onboarding" element={<OnboardingPage />} />
                </Route>

                {/* Protected routes — org_admin and super_admin only */}
                <Route element={<ProtectedRoute allowedRoles={['org_admin', 'super_admin']} />}>
                    <Route element={<AppLayout />}>
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                </Route>

                {/* Fallback */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    )
}
