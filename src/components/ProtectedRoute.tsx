import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { AppRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRole: AppRole
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin">✨</div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role !== allowedRole) {
    if (role === 'admin') return <Navigate to="/" replace />
    if (role === 'client') return <Navigate to="/portal" replace />
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
