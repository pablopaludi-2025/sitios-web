import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Palette, LogOut, Menu, X, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/templates', icon: Palette, label: 'Templates' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sidebar-collapsed') === 'true'
    return false
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        'bg-primary text-primary-foreground',
        !mobile && (collapsed ? 'w-16' : 'w-60')
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-white/20">
        <span className="text-2xl shrink-0">✨</span>
        {(!collapsed || mobile) && (
          <span className="font-black text-lg leading-tight">Vendé más IA</span>
        )}
        {!mobile && (
          <button
            onClick={() => {
              const next = !collapsed
              setCollapsed(next)
              localStorage.setItem('sidebar-collapsed', String(next))
            }}
            className="ml-auto p-1 rounded hover:bg-white/20 transition-colors"
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {!collapsed && (
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider px-3 pb-1">Menú</p>
        )}
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => mobile && setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon size={20} className="shrink-0" />
            {(!collapsed || mobile) && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/20">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut size={20} className="shrink-0" />
          {(!collapsed || mobile) && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-full shadow-lg">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full shadow-xl">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </Button>
          <span className="font-bold text-foreground">Panel de Administración</span>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(d => !d)}
              title={dark ? 'Modo claro' : 'Modo oscuro'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
