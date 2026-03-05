import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, DollarSign, TrendingUp, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Client } from '@/types'
import { RUBRO_ICONS, RUBRO_LABELS } from '@/types'

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients(data ?? [])
        setLoading(false)
      })
  }, [])

  const activeClients = clients.filter(c => c.status === 'active')
  const setupClients = clients.filter(c => c.status === 'setup')
  const mrr = activeClients.reduce((sum, c) => sum + (c.monthly_fee ?? 0), 0)
  const totalSetup = clients.reduce((sum, c) => sum + (c.setup_fee ?? 0), 0)

  const metrics = [
    { title: 'Clientes Activos', value: activeClients.length, icon: Users, color: 'text-[hsl(262,83%,58%)]', bg: 'bg-purple-50' },
    { title: 'MRR', value: `$${mrr.toLocaleString('es-AR')}`, icon: TrendingUp, color: 'text-[hsl(142,71%,45%)]', bg: 'bg-green-50' },
    { title: 'Setup cobrado', value: `$${totalSetup.toLocaleString('es-AR')}`, icon: DollarSign, color: 'text-[hsl(38,92%,50%)]', bg: 'bg-orange-50' },
    { title: 'En configuración', value: setupClients.length, icon: Settings, color: 'text-[hsl(199,89%,48%)]', bg: 'bg-cyan-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[hsl(240,10%,12%)]">Dashboard</h1>
        <p className="text-[hsl(240,5%,45%)] mt-1">Resumen de tu agencia</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[hsl(240,5%,45%)] font-semibold uppercase tracking-wide">{title}</p>
                  <p className="text-2xl font-black mt-1 text-[hsl(240,10%,12%)]">{loading ? '...' : value}</p>
                </div>
                <div className={`p-3 rounded-full ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos clientes</CardTitle>
          <Link to="/clients" className="text-sm text-[hsl(262,83%,58%)] font-semibold hover:underline">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-[hsl(240,5%,45%)] text-sm">Cargando...</p>
          ) : clients.length === 0 ? (
            <p className="text-[hsl(240,5%,45%)] text-sm">No hay clientes aún.</p>
          ) : (
            <div className="space-y-3">
              {clients.slice(0, 8).map(client => (
                <div key={client.id} className="flex items-center justify-between py-2 border-b border-[hsl(240,6%,90%)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{RUBRO_ICONS[client.rubro]}</span>
                    <div>
                      <p className="font-semibold text-sm text-[hsl(240,10%,12%)]">{client.name}</p>
                      <p className="text-xs text-[hsl(240,5%,45%)]">{RUBRO_LABELS[client.rubro]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.monthly_fee > 0 && (
                      <span className="text-sm font-bold text-[hsl(240,10%,12%)]">
                        ${client.monthly_fee.toLocaleString('es-AR')}/mes
                      </span>
                    )}
                    <Badge
                      variant={client.status === 'active' ? 'success' : client.status === 'setup' ? 'warning' : 'secondary'}
                    >
                      {client.status === 'active' ? 'Activo' : client.status === 'setup' ? 'Config.' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
