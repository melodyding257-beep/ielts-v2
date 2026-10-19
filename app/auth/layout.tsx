import RegistrationProvider from './registration-context'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <RegistrationProvider>{children}</RegistrationProvider>
}
