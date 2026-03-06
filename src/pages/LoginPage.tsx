import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const { user, role, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [adminCount, setAdminCount] = useState<number | null>(null)

  // Check admin count on mount
  useState(() => {
    supabase
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .then(({ count }) => setAdminCount(count ?? 0))
  })

  if (!loading && user && role === 'admin') return <Navigate to="/" replace />
  if (!loading && user && role === 'client') return <Navigate to="/portal" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      toast.error('Email o contraseña incorrectos')
    }
    setSubmitting(false)
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const { error } = await supabase.functions.invoke('seed-data')
      if (error) throw error
      toast.success('¡Datos iniciales cargados! Podés hacer login con admin@vendemas.soynico.ai / 123456')
    } catch {
      toast.error('Error al cargar datos iniciales')
    }
    setSeeding(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary to-secondary">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="text-5xl mb-2">✨</div>
          <CardTitle className="text-2xl font-black">Vendé más IA</CardTitle>
          <CardDescription>Plataforma SaaS para agencias digitales</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Ingresar'}
            </Button>
          </form>

          {adminCount === 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Primera vez usando la app
              </p>
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? 'Cargando datos...' : '🌱 Configuración inicial (primera vez)'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
