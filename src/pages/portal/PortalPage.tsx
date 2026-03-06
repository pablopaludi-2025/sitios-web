import { useEffect, useState } from 'react'
import { ExternalLink, LogOut, Upload, Download, Copy, Check, Plus, Trash2, Save, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Client, CatalogProduct, ContentPost, Order, TemplateSection, ChatbotConversation } from '@/types'
import { RUBRO_ICONS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function PortalPage() {
  const { clientId, signOut } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!clientId) return
    supabase.from('clients').select('*').eq('id', clientId).single().then(({ data }) => {
      setClient(data)
      setLoading(false)
    })
  }, [clientId])

  const handleSignOut = async () => {
    await signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-spin">✨</div>
          <p className="text-muted-foreground">Cargando tu portal...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No se encontró tu negocio. Contactá con el administrador.</p>
      </div>
    )
  }

  const siteUrl = `${window.location.origin}/site/${client.slug}`
  const enabledProducts = client.enabled_products ?? []

  const tabs = [
    enabledProducts.includes('plan_contenido') || enabledProducts.includes('redes_sociales') ? 'contenido' : null,
    enabledProducts.includes('catalogo') ? 'catalogo' : null,
    client.ecommerce_enabled ? 'pedidos' : null,
    enabledProducts.includes('landing') ? 'landing' : null,
    client.chatbot_enabled ? 'conversaciones' : null,
    client.chatbot_enabled ? 'leads' : null,
  ].filter(Boolean) as string[]

  const defaultTab = tabs[0] ?? 'contenido'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{RUBRO_ICONS[client.rubro]}</span>
            <div>
              <span className="font-black text-foreground">{client.name}</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">Portal de gestión</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink size={14} /> Ver sitio
              </Button>
            </a>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut size={14} /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {tabs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-lg font-bold">Tu portal está siendo configurado</p>
            <p className="text-sm mt-1">Próximamente vas a tener acceso a todas las herramientas.</p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <ScrollArea className="w-full">
              <TabsList className="mb-6 flex-nowrap">
                {tabs.includes('contenido') && <TabsTrigger value="contenido">📅 Contenido</TabsTrigger>}
                {tabs.includes('catalogo') && <TabsTrigger value="catalogo">🛍️ Catálogo</TabsTrigger>}
                {tabs.includes('pedidos') && <TabsTrigger value="pedidos">📦 Pedidos</TabsTrigger>}
                {tabs.includes('landing') && <TabsTrigger value="landing">🌐 Landing</TabsTrigger>}
                {tabs.includes('conversaciones') && <TabsTrigger value="conversaciones">💬 Chat</TabsTrigger>}
                {tabs.includes('leads') && <TabsTrigger value="leads">👥 Leads</TabsTrigger>}
              </TabsList>
            </ScrollArea>

            {tabs.includes('contenido') && (
              <TabsContent value="contenido">
                <ContentTab clientId={client.id} clientName={client.name} />
              </TabsContent>
            )}
            {tabs.includes('catalogo') && (
              <TabsContent value="catalogo">
                <CatalogTab clientId={client.id} />
              </TabsContent>
            )}
            {tabs.includes('pedidos') && (
              <TabsContent value="pedidos">
                <OrdersTab clientId={client.id} />
              </TabsContent>
            )}
            {tabs.includes('landing') && (
              <TabsContent value="landing">
                <LandingTab clientId={client.id} templateId={client.template_id} siteUrl={siteUrl} />
              </TabsContent>
            )}
            {tabs.includes('conversaciones') && (
              <TabsContent value="conversaciones">
                <ConversationsTab clientId={client.id} />
              </TabsContent>
            )}
            {tabs.includes('leads') && (
              <TabsContent value="leads">
                <LeadsTab clientId={client.id} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}

// ---- CONTENT TAB ----
function ContentTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editCopy, setEditCopy] = useState('')
  const [savingCopy, setSavingCopy] = useState(false)

  useEffect(() => {
    supabase
      .from('content_posts')
      .select('*')
      .eq('client_id', clientId)
      .order('day', { ascending: true })
      .then(({ data }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [clientId])

  const copyCopy = async (postId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(postId)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copy copiado al portapapeles')
  }

  const downloadImage = async (imageUrl: string, day: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clientName.replace(/\s+/g, '-')}-dia-${day}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar la imagen')
    }
  }

  const downloadAllZip = async () => {
    const postsWithImages = posts.filter(p => p.image_url)
    if (postsWithImages.length === 0) {
      toast.error('No hay imágenes para descargar')
      return
    }
    setDownloadingZip(true)
    try {
      const zip = new JSZip()
      const imgFolder = zip.folder('imagenes')!
      const copyLines: string[] = ['PLAN DE CONTENIDO - ' + clientName, '='.repeat(50), '']

      await Promise.all(
        postsWithImages.map(async (post) => {
          try {
            const response = await fetch(post.image_url!)
            const blob = await response.blob()
            imgFolder.file(`dia-${post.day}.jpg`, blob)
          } catch {
            // skip if image fails
          }
          copyLines.push(`DÍA ${post.day}`)
          if (post.scheduled_date) copyLines.push(`Fecha: ${post.scheduled_date}`)
          if (post.photo_name) copyLines.push(`Foto: ${post.photo_name}`)
          copyLines.push(`Copy: ${post.copy}`)
          copyLines.push('')
        })
      )

      zip.file('copies.txt', copyLines.join('\n'))
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clientName.replace(/\s+/g, '-')}-plan-contenido.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ZIP descargado correctamente')
    } catch {
      toast.error('Error al generar el ZIP')
    }
    setDownloadingZip(false)
  }

  const uploadImage = async (postId: string, file: File) => {
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${postId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('content-images').upload(path, file, { upsert: true })
    if (uploadError) { toast.error('Error al subir imagen'); return }
    const { data: { publicUrl } } = supabase.storage.from('content-images').getPublicUrl(path)
    const { error } = await supabase.from('content_posts').update({ image_url: publicUrl }).eq('id', postId)
    if (error) { toast.error('Error al actualizar'); return }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, image_url: publicUrl } : p))
    toast.success('Imagen actualizada')
  }

  const startEditCopy = (post: ContentPost) => {
    setEditingPost(post.id)
    setEditCopy(post.copy)
  }

  const saveCopy = async (postId: string) => {
    setSavingCopy(true)
    const { error } = await supabase.from('content_posts').update({ copy: editCopy }).eq('id', postId)
    if (error) {
      toast.error('Error al guardar el copy')
    } else {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, copy: editCopy } : p))
      toast.success('Copy actualizado')
      setEditingPost(null)
    }
    setSavingCopy(false)
  }

  const cancelEditCopy = () => {
    setEditingPost(null)
    setEditCopy('')
  }

  if (loading) return <p className="text-muted-foreground">Cargando contenido...</p>

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📅</div>
        <p className="font-bold text-foreground">No hay plan de contenido generado aún</p>
        <p className="text-sm text-muted-foreground mt-1">El administrador puede generar tu plan desde el panel.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{posts.length} posts en tu plan</p>
        <Button variant="outline" size="sm" onClick={downloadAllZip} disabled={downloadingZip}>
          <Download size={14} />
          {downloadingZip ? 'Generando ZIP...' : 'Descargar todo (ZIP)'}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {posts.map(post => (
          <Card key={post.id} className="overflow-hidden">
            {/* Image area - aspect 4:5 */}
            <div className="relative bg-muted" style={{ aspectRatio: '4/5' }}>
              {post.image_url ? (
                <img src={post.image_url} alt={`Día ${post.day}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sin imagen
                </div>
              )}
              {/* Hover overlay */}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex gap-2">
                  <div className="bg-white rounded-full p-2">
                    <Upload size={16} className="text-foreground" />
                  </div>
                  {post.image_url && (
                    <button
                      className="bg-white rounded-full p-2"
                      onClick={e => { e.preventDefault(); downloadImage(post.image_url!, post.day) }}
                    >
                      <Download size={16} className="text-foreground" />
                    </button>
                  )}
                </div>
                <input type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && uploadImage(post.id, e.target.files[0])} />
              </label>
            </div>

            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Día {post.day}</Badge>
                {post.scheduled_date && (
                  <span className="text-xs text-muted-foreground">{post.scheduled_date}</span>
                )}
              </div>
              {post.photo_name && (
                <p className="text-xs font-semibold text-primary">{post.photo_name}</p>
              )}

              {/* Copy section - editable */}
              {editingPost === post.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editCopy}
                    onChange={e => setEditCopy(e.target.value)}
                    className="text-xs min-h-[80px]"
                    rows={4}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1 text-xs h-7" onClick={() => saveCopy(post.id)} disabled={savingCopy}>
                      {savingCopy ? '...' : <><Save size={10} /> Guardar</>}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={cancelEditCopy}>
                      <X size={10} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-xs text-muted-foreground line-clamp-4">{post.copy}</p>
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => copyCopy(post.id, post.copy)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {copied === post.id ? <Check size={10} /> : <Copy size={10} />}
                      {copied === post.id ? 'Copiado' : 'Copiar copy'}
                    </button>
                    <button
                      onClick={() => startEditCopy(post)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary ml-auto"
                    >
                      <Edit2 size={10} /> Editar
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---- CATALOG TAB ----
function CatalogTab({ clientId }: { clientId: string }) {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('catalog_products').select('*').eq('client_id', clientId).order('created_at').then(({ data }) => {
      setProducts(data ?? [])
      setLoading(false)
    })
  }, [clientId])

  const updateProduct = (id: string, field: keyof CatalogProduct, value: string | number | boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const addProduct = () => {
    const newProduct: CatalogProduct = {
      id: `new-${Date.now()}`,
      client_id: clientId,
      name: '',
      description: '',
      price: 0,
      available: true,
    }
    setProducts(prev => [...prev, newProduct])
  }

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const product of products) {
        const isNew = product.id.startsWith('new-')
        const { id: _id, ...data } = product
        if (isNew) {
          await supabase.from('catalog_products').insert({ ...data, client_id: clientId })
        } else {
          await supabase.from('catalog_products').update(data).eq('id', product.id)
        }
      }
      // Reload
      const { data } = await supabase.from('catalog_products').select('*').eq('client_id', clientId).order('created_at')
      setProducts(data ?? [])
      toast.success('Catálogo guardado correctamente')
    } catch {
      toast.error('Error al guardar')
    }
    setSaving(false)
  }

  const uploadProductImage = async (productId: string, file: File) => {
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${productId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (error) { toast.error('Error al subir imagen'); return }
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
    updateProduct(productId, 'image_url', publicUrl)
  }

  if (loading) return <p className="text-muted-foreground">Cargando catálogo...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} productos</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addProduct}>
            <Plus size={14} /> Agregar
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {products.map(product => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Image */}
                <div className="relative shrink-0 w-20 h-20 bg-muted rounded-xl overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                    <Upload size={16} className="text-white" />
                    <input type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && uploadProductImage(product.id, e.target.files[0])} />
                  </label>
                </div>

                {/* Fields */}
                <div className="flex-1 grid sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Nombre del producto"
                    value={product.name}
                    onChange={e => updateProduct(product.id, 'name', e.target.value)}
                    className="text-sm"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      placeholder="Precio"
                      value={product.price}
                      onChange={e => updateProduct(product.id, 'price', Number(e.target.value))}
                      className="text-sm pl-7"
                    />
                  </div>
                  <Input
                    placeholder="Descripción"
                    value={product.description ?? ''}
                    onChange={e => updateProduct(product.id, 'description', e.target.value)}
                    className="text-sm sm:col-span-2"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <Switch
                    checked={product.available}
                    onCheckedChange={v => updateProduct(product.id, 'available', v)}
                  />
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No hay productos. ¡Agregá el primero!</p>
        )}
      </div>
    </div>
  )
}

// ---- ORDERS TAB ----
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  confirmed: 'default',
  completed: 'success',
  cancelled: 'destructive',
}

function OrdersTab({ clientId }: { clientId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('orders').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).then(({ data }) => {
      setOrders(data ?? [])
      setLoading(false)
    })
  }, [clientId])

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o))
  }

  if (loading) return <p className="text-muted-foreground">Cargando pedidos...</p>

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📦</div>
        <p className="font-bold text-foreground">No hay pedidos aún</p>
        <p className="text-sm text-muted-foreground mt-1">Los pedidos de tu tienda aparecerán acá.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <Card key={order.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{order.customer_name}</p>
                  <Badge variant={ORDER_STATUS_COLORS[order.status] as 'warning' | 'default' | 'success' | 'destructive'}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{order.customer_email} · {order.customer_phone}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {order.items.map((item, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{item.quantity}× {item.name}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-primary">${order.total.toLocaleString('es-AR')}</span>
                <Select value={order.status} onValueChange={v => updateStatus(order.id, v)}>
                  <SelectTrigger className="w-36 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---- LANDING TAB ----
function LandingTab({ templateId, siteUrl }: { clientId: string; templateId?: string; siteUrl: string }) {
  const [sections, setSections] = useState<TemplateSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!templateId) { setLoading(false); return }
    supabase
      .from('template_sections')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')
      .then(({ data }) => {
        setSections(data ?? [])
        setLoading(false)
      })
  }, [templateId])

  const updateSection = (id: string, field: keyof TemplateSection, value: string | boolean) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const section of sections) {
        await supabase.from('template_sections').update({
          title: section.title,
          content: section.content,
          image_url: section.image_url,
          visible: section.visible,
        }).eq('id', section.id)
      }
      toast.success('Landing guardada correctamente')
    } catch {
      toast.error('Error al guardar')
    }
    setSaving(false)
  }

  if (!templateId) return <p className="text-muted-foreground">No tenés un template asignado.</p>
  if (loading) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sections.length} secciones</p>
        <div className="flex gap-2">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink size={14} /> Ver sitio</Button>
          </a>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {sections.map(section => (
          <Card key={section.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{section.type}</Badge>
                <Switch checked={section.visible} onCheckedChange={v => updateSection(section.id, 'visible', v)} />
                <span className="text-xs text-muted-foreground">{section.visible ? 'Visible' : 'Oculta'}</span>
              </div>
              <Input placeholder="Título" value={section.title ?? ''} onChange={e => updateSection(section.id, 'title', e.target.value)} />
              <Textarea placeholder="Contenido" value={section.content ?? ''} onChange={e => updateSection(section.id, 'content', e.target.value)} rows={3} />
              <Input placeholder="URL de imagen (https://...)" value={section.image_url ?? ''} onChange={e => updateSection(section.id, 'image_url', e.target.value)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---- CONVERSATIONS TAB ----
function ConversationsTab({ clientId }: { clientId: string }) {
  const [conversations, setConversations] = useState<ChatbotConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ChatbotConversation | null>(null)

  useEffect(() => {
    supabase
      .from('chatbot_conversations')
      .select('*')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setConversations(data ?? [])
        setLoading(false)
      })
  }, [clientId])

  if (loading) return <p className="text-muted-foreground">Cargando conversaciones...</p>

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">💬</div>
        <p className="font-bold text-foreground">No hay conversaciones aún</p>
        <p className="text-sm text-muted-foreground mt-1">Las conversaciones del chatbot aparecerán acá.</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        {conversations.map(conv => (
          <Card
            key={conv.id}
            className={`cursor-pointer hover:shadow-md transition-shadow ${selected?.id === conv.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelected(conv)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm">{conv.visitor_name ?? 'Visitante anónimo'}</p>
                  {conv.visitor_email && <p className="text-xs text-muted-foreground">{conv.visitor_email}</p>}
                  {conv.visitor_phone && <p className="text-xs text-muted-foreground">{conv.visitor_phone}</p>}
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{conv.messages.length} msgs</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(conv.updated_at).toLocaleDateString('es-AR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {selected && (
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-bold">{selected.visitor_name ?? 'Visitante'}</p>
              {selected.visitor_email && <p className="text-xs text-muted-foreground">{selected.visitor_email}</p>}
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-2 pr-2">
                {selected.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---- LEADS TAB ----
function LeadsTab({ clientId }: { clientId: string }) {
  const [leads, setLeads] = useState<ChatbotConversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('chatbot_conversations')
      .select('*')
      .eq('client_id', clientId)
      .not('visitor_name', 'is', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setLeads(data ?? [])
        setLoading(false)
      })
  }, [clientId])

  if (loading) return <p className="text-muted-foreground">Cargando leads...</p>

  if (leads.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">👥</div>
        <p className="font-bold text-foreground">No hay leads aún</p>
        <p className="text-sm text-muted-foreground mt-1">Los contactos capturados por el chatbot aparecerán acá.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 font-bold text-muted-foreground text-xs uppercase">Nombre</th>
            <th className="text-left py-3 px-2 font-bold text-muted-foreground text-xs uppercase">Email</th>
            <th className="text-left py-3 px-2 font-bold text-muted-foreground text-xs uppercase">Teléfono</th>
            <th className="text-left py-3 px-2 font-bold text-muted-foreground text-xs uppercase">Fecha</th>
            <th className="text-left py-3 px-2 font-bold text-muted-foreground text-xs uppercase">Mensajes</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-border hover:bg-muted/50">
              <td className="py-3 px-2 font-semibold">{lead.visitor_name}</td>
              <td className="py-3 px-2 text-muted-foreground">{lead.visitor_email ?? '-'}</td>
              <td className="py-3 px-2 text-muted-foreground">{lead.visitor_phone ?? '-'}</td>
              <td className="py-3 px-2 text-muted-foreground">{new Date(lead.updated_at).toLocaleDateString('es-AR')}</td>
              <td className="py-3 px-2">
                <Badge variant="secondary">{lead.messages.length}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
