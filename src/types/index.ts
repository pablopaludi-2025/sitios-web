export type Rubro = 'pizzeria' | 'restaurant' | 'bar' | 'veterinaria' | 'heladeria' | 'peluqueria' | 'gym' | 'otro'

export const RUBRO_LABELS: Record<Rubro, string> = {
  pizzeria: 'Pizzería',
  restaurant: 'Restaurant',
  bar: 'Bar',
  veterinaria: 'Veterinaria',
  heladeria: 'Heladería',
  peluqueria: 'Peluquería',
  gym: 'Gimnasio',
  otro: 'Otro',
}

export const RUBRO_ICONS: Record<Rubro, string> = {
  pizzeria: '🍕',
  restaurant: '🍽️',
  bar: '🍸',
  veterinaria: '🐾',
  heladeria: '🍦',
  peluqueria: '💇',
  gym: '💪',
  otro: '🏢',
}

export const RUBRO_COLORS: Record<Rubro, { from: string; to: string; badge: string; solid: string }> = {
  pizzeria:   { from: 'from-orange-500', to: 'to-red-500',     badge: 'bg-orange-100 text-orange-700',   solid: 'bg-red-600' },
  veterinaria:{ from: 'from-emerald-500',to: 'to-teal-500',    badge: 'bg-emerald-100 text-emerald-700', solid: 'bg-green-600' },
  bar:        { from: 'from-purple-600', to: 'to-indigo-600',  badge: 'bg-purple-100 text-purple-700',   solid: 'bg-violet-700' },
  heladeria:  { from: 'from-pink-400',   to: 'to-rose-500',    badge: 'bg-pink-100 text-pink-700',       solid: 'bg-amber-600' },
  restaurant: { from: 'from-amber-500',  to: 'to-orange-500',  badge: 'bg-amber-100 text-amber-700',     solid: 'bg-orange-500' },
  peluqueria: { from: 'from-fuchsia-500',to: 'to-pink-500',    badge: 'bg-fuchsia-100 text-fuchsia-700', solid: 'bg-fuchsia-600' },
  gym:        { from: 'from-blue-600',   to: 'to-cyan-500',    badge: 'bg-blue-100 text-blue-700',       solid: 'bg-blue-600' },
  otro:       { from: 'from-gray-600',   to: 'to-slate-600',   badge: 'bg-gray-100 text-gray-700',       solid: 'bg-slate-600' },
}

export type ProductKey = 'landing' | 'catalogo' | 'ecommerce' | 'chatbot' | 'video_ia' | 'redes_sociales' | 'plan_contenido'
export type PlanKey = 'redes_chatbot' | 'presencia_web' | 'venta_online'
export type ClientStatus = 'active' | 'inactive' | 'setup'
export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type JobStatus = 'pending' | 'generating_text' | 'generating_images' | 'completed' | 'failed'
export type AppRole = 'admin' | 'client'

export interface Client {
  id: string
  name: string
  slug: string
  rubro: Rubro
  email: string
  phone?: string
  whatsapp?: string
  plan?: PlanKey
  enabled_products: ProductKey[]
  template_id?: string
  chatbot_enabled: boolean
  ecommerce_enabled: boolean
  mercadopago_enabled: boolean
  status: ClientStatus
  setup_fee: number
  monthly_fee: number
  created_at: string
}

export interface CatalogProduct {
  id: string
  client_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  category?: string
  available: boolean
}

export interface ContentPost {
  id: string
  client_id: string
  day: number
  photo_name?: string
  photo_description?: string
  copy: string
  image_url?: string
  scheduled_date?: string
}

export interface ContentPlanJob {
  id: string
  client_id: string
  status: JobStatus
  progress: number
  posts_count?: number
  images_count?: number
  error?: string
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  rubro: Rubro
  description?: string
  preview_color?: string
}

export interface TemplateSection {
  id: string
  template_id: string
  type: 'hero' | 'about' | 'services' | 'gallery' | 'contact' | 'products' | 'testimonials'
  title?: string
  content?: string
  image_url?: string
  visible: boolean
  sort_order: number
}

export interface ChatbotConversation {
  id: string
  client_id: string
  visitor_name?: string
  visitor_email?: string
  visitor_phone?: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface Order {
  id: string
  client_id: string
  customer_name: string
  customer_email?: string
  customer_phone: string
  customer_address?: string
  customer_notes?: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  created_at: string
  updated_at: string
}

export interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
  image_url?: string
}

export interface Profile {
  id: string
  user_id: string
  full_name?: string
  client_id?: string
}

export interface UserRole {
  id: string
  user_id: string
  role: AppRole
}
