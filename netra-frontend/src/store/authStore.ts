import { create } from 'zustand'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export type UserRole = 'super_admin' | 'org_admin' | 'operator' | 'viewer' | 'responder'

interface AuthState {
    user: User | null
    uid: string | null
    email: string | null
    orgId: string | null
    role: UserRole | null
    loading: boolean
    setUser: (user: User | null) => void
    setLoading: (loading: boolean) => void
    reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    uid: null,
    email: null,
    orgId: null,
    role: null,
    loading: true,
    setUser: (user) => {
        if (user) {
            // getIdTokenResult returns custom claims
            user.getIdTokenResult().then((tokenResult) => {
                const claims = tokenResult.claims
                set({
                    user,
                    uid: user.uid,
                    email: user.email,
                    orgId: (claims.orgId as string) || null,
                    role: (claims.role as UserRole) || null,
                    loading: false,
                })
            })
        } else {
            set({
                user: null,
                uid: null,
                email: null,
                orgId: null,
                role: null,
                loading: false,
            })
        }
    },
    setLoading: (loading) => set({ loading }),
    reset: () =>
        set({
            user: null,
            uid: null,
            email: null,
            orgId: null,
            role: null,
            loading: false,
        }),
}))

/**
 * Call this once at app startup (e.g., in main.tsx).
 * Subscribes to Firebase Auth state changes and auto-refreshes custom claims.
 */
export function listenToAuthChanges(): () => void {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        useAuthStore.getState().setUser(user)
    })
    return unsubscribe
}
