import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircle, ShoppingCart, X, Send, Plus, Minus, Trash2, Phone, Mail, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Client, CatalogProduct, TemplateSection, OrderItem, ChatMessage } from '@/types'
import { RUBRO_ICONS, RUBRO_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function PublicSitePage() {
  const { slug } = useParams<{ slug: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [sections, setSections] = useState<TemplateSection[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    const load = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!clientData) { setLoading(false); return }
      setClient(clientData)

      const [{ data: sectionsData }, { data: productsData }] = await Promise.all([
        supabase.from('template_sections').select('*').eq('template_id', clientData.template_id).order('sort_order').then(r => r),
        supabase.from('catalog_products').select('*').eq('client_id', clientData.id).eq('available', true).then(r => r),
      ])

      setSections(sectionsData ?? [])
      setProducts(productsData ?? [])
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-spin">✨</div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-4xl">😕</p>
          <p className="text-gray-500">Este sitio no existe.</p>
        </div>
      </div>
    )
  }

  return (
    <SiteContent client={client} sections={sections} products={products} />
  )
}

function SiteContent({ client, sections, products }: {
  client: Client
  sections: TemplateSection[]
  products: CatalogProduct[]
}) {
  const colors = RUBRO_COLORS[client.rubro]
  const [cart, setCart] = useState<OrderItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const catalogRef = useRef<HTMLDivElement>(null)

  const visibleSections = sections.filter(s => s.visible).sort((a, b) => a.sort_order - b.sort_order)
  const heroSection = visibleSections.find(s => s.type === 'hero')
  const otherSections = visibleSections.filter(s => s.type !== 'hero' && s.type !== 'contact')
  const contactSection = visibleSections.find(s => s.type === 'contact')
  const showCatalog = (client.enabled_products ?? []).includes('catalogo') && products.length > 0

  const addToCart = (product: CatalogProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === productId)
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i)
      }
      return prev.filter(i => i.product_id !== productId)
    })
  }

  const deleteFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const getCartQty = (productId: string) => cart.find(i => i.product_id === productId)?.quantity ?? 0

  return (
    <div className="min-h-screen bg-white font-['Nunito',sans-serif]">
      {/* HERO */}
      {heroSection && (
        <section className="relative min-h-[75vh] flex items-end">
          {heroSection.image_url && (
            <img
              src={heroSection.image_url}
              alt={heroSection.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-16 pt-20">
            <p className="text-white/70 font-semibold mb-2">{RUBRO_ICONS[client.rubro]} {client.name}</p>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4">
              {heroSection.title}
            </h1>
            {heroSection.content && (
              <p className="text-white/80 text-lg mb-8 max-w-xl">{heroSection.content}</p>
            )}
            <div className="flex flex-wrap gap-3">
              {showCatalog && (
                <button
                  onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-3 bg-[#2196F3] text-white font-bold rounded-full hover:bg-[#1976D2] transition-colors"
                >
                  Ver Catálogo
                </button>
              )}
              {client.whatsapp && (
                <a
                  href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=Hola! Vi tu sitio web y quería consultarte.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white/20 text-white font-bold rounded-full border border-white/40 hover:bg-white/30 transition-colors"
                >
                  Contactar
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => document.getElementById('content-start')?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce"
          >
            <ChevronDown size={28} />
          </button>
        </section>
      )}

      <div id="content-start" />

      {/* OTHER SECTIONS */}
      {otherSections.map((section, idx) => (
        <section key={section.id} className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className={`grid md:grid-cols-2 gap-12 items-center ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              {section.image_url && (
                <div className={idx % 2 === 1 ? 'md:order-2' : ''}>
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full rounded-2xl object-cover shadow-lg"
                    style={{ maxHeight: '380px' }}
                  />
                </div>
              )}
              <div className={section.image_url && idx % 2 === 1 ? 'md:order-1' : ''}>
                <p className={`text-xs font-black uppercase tracking-widest mb-2 bg-gradient-to-r ${colors.from} ${colors.to} bg-clip-text text-transparent`}>
                  {section.type === 'about' ? 'Sobre nosotros' : 'Nuestros servicios'}
                </p>
                <h2 className="text-3xl font-black text-gray-900 mb-4">{section.title}</h2>
                <p className="text-gray-600 leading-relaxed">{section.content}</p>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CATALOG */}
      {showCatalog && (
        <section ref={catalogRef} className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <p className={`text-xs font-black uppercase tracking-widest mb-2 bg-gradient-to-r ${colors.from} ${colors.to} bg-clip-text text-transparent`}>
                Menú / Catálogo
              </p>
              <h2 className="text-3xl font-black text-gray-900">Nuestros productos</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(product => {
                const qty = getCartQty(product.id)
                return (
                  <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-4xl">
                        {RUBRO_ICONS[client.rubro]}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-gray-900">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`font-black text-lg bg-gradient-to-r ${colors.from} ${colors.to} bg-clip-text text-transparent`}>
                          ${product.price.toLocaleString('es-AR')}
                        </span>
                        {client.ecommerce_enabled && (
                          qty === 0 ? (
                            <button
                              onClick={() => addToCart(product)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 transition-colors"
                            >
                              <Plus size={12} /> Agregar
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeFromCart(product.id)}
                                className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center hover:bg-violet-200 transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-6 text-center font-bold text-sm">{qty}</span>
                              <button
                                onClick={() => addToCart(product)}
                                className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      {contactSection && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-4">{contactSection.title}</h2>
            <p className="text-gray-600 mb-8">{contactSection.content}</p>
            <div className="flex flex-wrap justify-center gap-4">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-sm font-semibold">
                  <Mail size={16} className="text-violet-600" /> {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-sm font-semibold">
                  <Phone size={16} className="text-violet-600" /> {client.phone}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className={`py-8 px-4 bg-gradient-to-r ${colors.from} ${colors.to}`}>
        <div className="max-w-4xl mx-auto text-center text-white">
          <p className="text-2xl mb-2">{RUBRO_ICONS[client.rubro]}</p>
          <p className="font-black text-xl">{client.name}</p>
          {client.email && <p className="text-white/80 text-sm mt-1">{client.email}</p>}
          {client.phone && <p className="text-white/80 text-sm">{client.phone}</p>}
          <p className="text-white/60 text-xs mt-4">Powered by <strong>Vendé más IA</strong> ✨</p>
        </div>
      </footer>

      {/* FLOATING BUTTONS */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-40">
        {/* Cart button */}
        {client.ecommerce_enabled && cartCount > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="relative w-14 h-14 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg hover:bg-violet-700 transition-colors"
          >
            <ShoppingCart size={22} />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          </button>
        )}

        {/* Chat / WhatsApp button */}
        {client.chatbot_enabled ? (
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-14 h-14 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg hover:bg-violet-700 transition-colors"
          >
            {showChat ? <X size={22} /> : <MessageCircle size={22} />}
          </button>
        ) : client.whatsapp ? (
          <a
            href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=Hola! Vi tu sitio web y quería consultarte.`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            style={{ backgroundColor: '#25D366' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        ) : null}
      </div>

      {/* CHAT WIDGET */}
      {client.chatbot_enabled && showChat && (
        <ChatWidget client={client} onClose={() => setShowChat(false)} />
      )}

      {/* CART DIALOG */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🛒 Tu pedido</DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Tu carrito está vacío</p>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center gap-3">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">${item.price.toLocaleString('es-AR')} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => removeFromCart(item.product_id)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                      <Minus size={10} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => addToCart({ id: item.product_id, client_id: '', name: item.name, price: item.price, available: true, image_url: item.image_url })} className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700">
                      <Plus size={10} />
                    </button>
                  </div>
                  <p className="text-sm font-bold w-20 text-right">${(item.price * item.quantity).toLocaleString('es-AR')}</p>
                  <button onClick={() => deleteFromCart(item.product_id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-3 flex justify-between font-black">
                <span>Total</span>
                <span className="text-violet-600">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => { setShowCart(false); setShowCheckout(true) }}
              >
                Realizar Pedido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHECKOUT DIALOG */}
      <CheckoutDialog
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        total={cartTotal}
        clientId={client.id}
        onSuccess={() => {
          setCart([])
          setShowCheckout(false)
          toast.success('¡Pedido realizado! Te contactaremos pronto.')
        }}
      />
    </div>
  )
}

function CheckoutDialog({ open, onClose, cart, total, clientId, onSuccess }: {
  open: boolean
  onClose: () => void
  cart: OrderItem[]
  total: number
  clientId: string
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('orders').insert({
      client_id: clientId,
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      customer_address: form.address,
      customer_notes: form.notes,
      items: cart,
      total,
      status: 'pending',
    })
    if (error) {
      toast.error('Error al realizar el pedido')
    } else {
      onSuccess()
    }
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar pedido</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            {cart.map(item => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span>{item.quantity}× {item.name}</span>
                <span className="font-semibold">${(item.price * item.quantity).toLocaleString('es-AR')}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-1 flex justify-between font-black">
              <span>Total</span>
              <span className="text-violet-600">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
          <Input placeholder="Tu nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input placeholder="WhatsApp *" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
          <Input type="email" placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <Input placeholder="Dirección de entrega *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
          <Textarea placeholder="Notas adicionales (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Confirmando...' : 'Confirmar Pedido'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChatWidget({ client, onClose }: { client: Client; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `¡Hola! 👋 Soy el asistente virtual de ${client.name}. ¿En qué te puedo ayudar hoy?` }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const allMessages = [...messages, userMsg]
      const response = await supabase.functions.invoke('chatbot', {
        body: {
          messages: allMessages,
          clientId: client.id,
          clientName: client.name,
          conversationId,
        }
      })

      if (response.error) throw response.error

      const botMsg: ChatMessage = { role: 'assistant', content: response.data?.content ?? 'No pude procesar tu consulta.' }
      setMessages(prev => [...prev, botMsg])
      if (response.data?.conversationId) setConversationId(response.data.conversationId)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, tuve un problema. ¿Podés intentar de nuevo?' }])
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 shadow-2xl rounded-2xl overflow-hidden bg-white border border-gray-200">
      {/* Header */}
      <div className="bg-violet-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">🤖</div>
          <div>
            <p className="text-white font-bold text-sm">{client.name}</p>
            <p className="text-white/70 text-xs">Asistente virtual</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-64 p-3">
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500">Escribiendo...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* WhatsApp option */}
      {client.whatsapp && (
        <div className="px-3 pb-1">
          <a
            href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=Hola! Quiero hablar con alguien del equipo.`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-center text-green-600 hover:underline block"
          >
            💬 Prefiero hablar por WhatsApp
          </a>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu consulta..."
          className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
