import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/types'
import { RUBRO_ICONS, RUBRO_LABELS, RUBRO_COLORS } from '@/types'
import type { ProductKey } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const PRODUCT_LABELS: Record<ProductKey, string> = {
  landing: 'Landing Page',
  catalogo: 'Catálogo',
  ecommerce: 'E-commerce',
  chatbot: 'Chatbot IA',
  video_ia: 'Videos con IA',
  redes_sociales: 'Redes Sociales',
  plan_contenido: 'Plan de Contenido',
}

const RUBROS = [
  { value: 'pizzeria', label: '🍕 Pizzería' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'bar', label: '🍸 Bar' },
  { value: 'veterinaria', label: '🐾 Veterinaria' },
  { value: 'heladeria', label: '🍦 Heladería' },
  { value: 'peluqueria', label: '💇 Peluquería' },
  { value: 'gym', label: '💪 Gimnasio' },
  { value: 'otro', label: '🏢 Otro' },
]

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rubroFilter, setRubroFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [contentJobProgress, setContentJobProgress] = useState<number | null>(null)
  const [contentJobStatus, setContentJobStatus] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Create form
  const [form, setForm] = useState({ name: '', slug: '', rubro: '', email: '', phone: '', whatsapp: '', password: '' })
  const [creating, setCreating] = useState(false)

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchRubro = rubroFilter === 'all' || c.rubro === rubroFilter
    return matchSearch && matchRubro
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: form.name,
          slug: form.slug,
          rubro: form.rubro,
          email: form.email,
          phone: form.phone,
          whatsapp: form.whatsapp,
          enabled_products: [],
          chatbot_enabled: false,
          ecommerce_enabled: false,
          mercadopago_enabled: false,
          status: 'setup',
          setup_fee: 0,
          monthly_fee: 0,
        })
        .select()
        .single()

      if (clientError) throw clientError

      const { error: fnError } = await supabase.functions.invoke('create-client-user', {
        body: {
          email: form.email,
          password: form.password,
          fullName: form.name,
          clientId: clientData.id,
        },
      })

      if (fnError) throw fnError

      toast.success(`Cliente ${form.name} creado correctamente`)
      setShowCreate(false)
      setForm({ name: '', slug: '', rubro: '', email: '', phone: '', whatsapp: '', password: '' })
      fetchClients()
    } catch (err) {
      toast.error(`Error al crear cliente: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
    setCreating(false)
  }

  const handleNameToSlug = (name: string) => {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const copyUrl = async (slug: string) => {
    const url = `${window.location.origin}/site/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const { error } = await supabase.from('clients').update(updates).eq('id', id)
    if (error) {
      toast.error('Error al actualizar')
      return
    }
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (selectedClient?.id === id) {
      setSelectedClient(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const toggleProduct = (client: Client, product: ProductKey) => {
    const current = client.enabled_products ?? []
    const updated = current.includes(product)
      ? current.filter(p => p !== product)
      : [...current, product]
    updateClient(client.id, { enabled_products: updated })
  }

  const startContentGeneration = async (clientId: string) => {
    setContentJobProgress(0)
    setContentJobStatus('pending')
    try {
      const { error } = await supabase.functions.invoke('generate-content-plan', {
        body: { clientId },
      })
      if (error) throw error

      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('content_plan_jobs')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          setContentJobProgress(data.progress)
          setContentJobStatus(data.status)
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current)
            if (data.status === 'completed') {
              toast.success('¡Plan de contenido generado!')
            } else {
              toast.error('Error al generar el plan')
            }
          }
        }
      }, 3000)
    } catch {
      toast.error('Error al iniciar la generación')
      setContentJobProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">{clients.length} clientes en total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nuevo Cliente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={rubroFilter} onValueChange={setRubroFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por rubro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los rubros</SelectItem>
            {RUBROS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <p className="text-muted-foreground">Cargando clientes...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron clientes.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => {
            const colors = RUBRO_COLORS[client.rubro]
            const siteUrl = `${window.location.origin}/site/${client.slug}`
            return (
              <Card
                key={client.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClient(client)}
              >
                <div className={`h-1.5 bg-gradient-to-r ${colors.from} ${colors.to}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{RUBRO_ICONS[client.rubro]}</span>
                      <div>
                        <p className="font-bold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{RUBRO_LABELS[client.rubro]}</p>
                      </div>
                    </div>
                    <Badge
                      variant={client.status === 'active' ? 'success' : client.status === 'setup' ? 'warning' : 'secondary'}
                    >
                      {client.status === 'active' ? 'Activo' : client.status === 'setup' ? 'Config.' : 'Inactivo'}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">{client.email}</p>

                  {/* Site URL */}
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1.5" onClick={e => e.stopPropagation()}>
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex-1 truncate flex items-center gap-1"
                    >
                      <ExternalLink size={10} />
                      /site/{client.slug}
                    </a>
                    <button
                      onClick={() => copyUrl(client.slug)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {copied === client.slug ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Enabled products badges */}
                  {(client.enabled_products ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(client.enabled_products ?? []).map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">{PRODUCT_LABELS[p]}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Integrations */}
                  <div className="flex gap-1 flex-wrap">
                    {client.chatbot_enabled && <Badge variant="default" className="text-xs">🤖 Chatbot IA</Badge>}
                    {client.ecommerce_enabled && <Badge variant="default" className="text-xs">🛒 E-commerce</Badge>}
                    {client.mercadopago_enabled && <Badge variant="default" className="text-xs">💳 Mercado Pago</Badge>}
                  </div>

                  {/* Fees */}
                  {(client.setup_fee > 0 || client.monthly_fee > 0) && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {client.setup_fee > 0 && <span>Setup: <strong>${client.setup_fee.toLocaleString('es-AR')}</strong></span>}
                      {client.monthly_fee > 0 && <span>Mensual: <strong>${client.monthly_fee.toLocaleString('es-AR')}</strong></span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Client Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del negocio</Label>
              <Input
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: handleNameToSlug(name) }))
                }}
                placeholder="Pizza al Paso"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="pizza-al-paso"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Select value={form.rubro} onValueChange={v => setForm(f => ({ ...f, rubro: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un rubro" />
                </SelectTrigger>
                <SelectContent>
                  {RUBROS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="dueño@negocio.com" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+54 11..." />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+54 11..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contraseña (portal cliente)</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required minLength={6} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating || !form.rubro}>
                {creating ? 'Creando...' : 'Crear Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedClient && RUBRO_ICONS[selectedClient.rubro]}
              {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-2">
                {/* Products */}
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Productos habilitados</h3>
                  <div className="space-y-2">
                    {(Object.keys(PRODUCT_LABELS) as ProductKey[]).map(product => (
                      <div key={product} className="flex items-center justify-between py-1">
                        <span className="text-sm font-semibold">{PRODUCT_LABELS[product]}</span>
                        <Switch
                          checked={(selectedClient.enabled_products ?? []).includes(product)}
                          onCheckedChange={() => toggleProduct(selectedClient, product)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Content plan generation */}
                  {(selectedClient.enabled_products ?? []).includes('plan_contenido') && (
                    <div className="mt-3 p-3 bg-primary/10 rounded-lg space-y-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => startContentGeneration(selectedClient.id)}
                        disabled={contentJobProgress !== null && contentJobProgress < 100}
                      >
                        <RefreshCw size={14} />
                        {contentJobProgress !== null && contentJobProgress < 100
                          ? `Generando... ${contentJobProgress}%`
                          : '✨ Generar / Regenerar Plan de Contenido'
                        }
                      </Button>
                      {contentJobProgress !== null && (
                        <div className="space-y-1">
                          <Progress value={contentJobProgress} />
                          <p className="text-xs text-muted-foreground text-center">
                            {contentJobStatus === 'generating_text' && 'Generando textos...'}
                            {contentJobStatus === 'generating_images' && 'Generando imágenes...'}
                            {contentJobStatus === 'completed' && '¡Completado!'}
                            {contentJobStatus === 'failed' && 'Error en la generación'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Integrations */}
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Integraciones</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm font-semibold">🤖 Chatbot IA</span>
                      <Switch
                        checked={selectedClient.chatbot_enabled}
                        onCheckedChange={v => updateClient(selectedClient.id, { chatbot_enabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm font-semibold">🛒 E-commerce</span>
                      <Switch
                        checked={selectedClient.ecommerce_enabled}
                        onCheckedChange={v => updateClient(selectedClient.id, { ecommerce_enabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm font-semibold">💳 Mercado Pago</span>
                      <Switch
                        checked={selectedClient.mercadopago_enabled}
                        onCheckedChange={v => updateClient(selectedClient.id, { mercadopago_enabled: v })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Precios</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Setup fee ($)</Label>
                      <Input
                        type="number"
                        value={selectedClient.setup_fee}
                        onChange={e => updateClient(selectedClient.id, { setup_fee: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mensual ($)</Label>
                      <Input
                        type="number"
                        value={selectedClient.monthly_fee}
                        onChange={e => updateClient(selectedClient.id, { monthly_fee: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Status */}
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Estado</h3>
                  <Select
                    value={selectedClient.status}
                    onValueChange={v => updateClient(selectedClient.id, { status: v as Client['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="setup">⚙️ En configuración</SelectItem>
                      <SelectItem value="active">✅ Activo</SelectItem>
                      <SelectItem value="inactive">❌ Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pb-2">
                  <Link
                    to={`/site/${selectedClient.slug}`}
                    target="_blank"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Ver sitio público
                  </Link>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
