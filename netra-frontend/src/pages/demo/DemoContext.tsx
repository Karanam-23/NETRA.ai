import { createContext, useContext } from 'react'

export type DemoRole = 'super_admin' | 'org_admin' | 'operator' | 'viewer'

interface DemoContextValue {
    role: DemoRole
    showDemoToast: (msg?: string) => void
}

export const DemoContext = createContext<DemoContextValue>({
    role: 'org_admin',
    showDemoToast: () => { },
})

export function useDemoContext() {
    return useContext(DemoContext)
}
