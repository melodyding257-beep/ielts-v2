'use client'

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react'

type Registration = { email: string; password: string; requiresConfirmation: boolean }
const RegistrationContext = createContext<{
  registration: Registration | null
  setRegistration: Dispatch<SetStateAction<Registration | null>>
} | null>(null)

export function useRegistration() {
  const context = useContext(RegistrationContext)
  if (!context) throw new Error('RegistrationContext is required')
  return context
}

export default function RegistrationProvider({ children }: { children: React.ReactNode }) {
  // Only retain credentials in memory during navigation between auth pages.
  const [registration, setRegistration] = useState<Registration | null>(null)
  return (
    <RegistrationContext.Provider value={{ registration, setRegistration }}>
      {children}
    </RegistrationContext.Provider>
  )
}
