import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Camera, LogOut, Bell, User, Menu, X, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-college-fuchsia',
  photographer: 'text-college-orange',
  club_member: 'text-college-teal',
  student: 'text-college-coral',
}

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/clubs', label: 'Clubs' },
    { to: '/events', label: 'Events' },
    { to: '/search', label: 'Search' },
    { to: '/find-my-photos', label: 'Find Me' },
    ...(profile?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  const roleLabel = profile?.role?.replace('_', ' ') ?? ''

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-college-black bg-white shadow-[0_5px_0_#0A0A0C]">
      <div
        className="h-2 w-full"
        style={{ background: 'linear-gradient(90deg, #FF007F, #00CED1, #FF6F61, #FF4500, #FF007F)' }}
      />

      <div
        className="relative"
        style={{
          background: 'rgba(255,255,255,0.92)',
        }}
      >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[74px] items-center justify-between gap-4 py-3">
          <Link to={user ? '/dashboard' : '/'} className="group flex items-center gap-3">
            <div className="relative rounded-2xl border-2 border-college-black bg-college-teal p-2 text-college-black shadow-[4px_4px_0_#0A0A0C] transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
              <Camera size={22} />
              <span className="absolute -right-1 -top-2 h-3 w-3 rounded-full border-2 border-college-black bg-college-fuchsia" />
            </div>
            <span className="text-xl font-black uppercase text-college-black">
              Uni<span className="text-college-fuchsia">Vibe</span>
            </span>
          </Link>

          {user && (
            <div className="hidden items-center gap-2 md:flex">
              {navLinks.map(link => {
                const active = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative rounded-full border-2 border-college-black px-4 py-2 text-sm font-black transition-all duration-200 ${
                      active
                        ? 'bg-college-fuchsia text-white shadow-[4px_4px_0_#0A0A0C]'
                        : 'bg-white text-college-black hover:-translate-y-0.5 hover:bg-college-teal/30 hover:shadow-[3px_3px_0_#0A0A0C]'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                <div ref={bellRef} className="relative">
                  <button
                    onClick={() => setBellOpen(o => !o)}
                    className="relative rounded-xl border-2 border-college-black bg-white p-2 text-college-black shadow-[3px_3px_0_#00CED1] transition-all duration-200 hover:-translate-y-0.5 hover:bg-college-teal/30"
                    title="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-college-black bg-college-orange px-1 text-[10px] font-black leading-none text-white animate-pulse-ring">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {bellOpen && (
                    <div className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border-2 border-college-black bg-white shadow-pop animate-slide-down">
                      <div className="flex items-center justify-between border-b-2 border-college-black bg-college-teal px-4 py-3">
                        <h3 className="text-sm font-black uppercase text-college-black">Notifications</h3>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-black text-college-black hover:text-college-fuchsia">
                            <Check size={11} /> Read all
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y-2 divide-black/10">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-college-black bg-college-fuchsia text-white shadow-[3px_3px_0_#0A0A0C]">
                              <Bell size={20} />
                            </div>
                            <p className="text-sm font-bold text-college-black">All caught up!</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => { markRead(n.id); if (n.link) navigate(n.link); setBellOpen(false) }}
                              className={`w-full px-4 py-3 text-left transition-colors hover:bg-college-teal/15 ${!n.is_read ? 'bg-college-fuchsia/10' : 'bg-white'}`}
                            >
                              <div className="flex items-start gap-2.5">
                                {!n.is_read && <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-college-fuchsia" />}
                                <div className={!n.is_read ? '' : 'ml-5'}>
                                  <p className="text-sm font-semibold text-college-black">{n.message}</p>
                                  <p className="mt-0.5 text-xs font-bold text-black/45">
                                    {format(new Date(n.created_at), 'dd MMM, h:mm a')}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="hidden items-center gap-2 rounded-2xl border-2 border-college-black bg-white px-3 py-1.5 shadow-[3px_3px_0_#FF6F61] md:flex">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-college-black bg-college-fuchsia text-xs font-black text-white">
                    {profile?.full_name?.[0]?.toUpperCase() ?? <User size={14} />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black leading-tight text-college-black">{profile?.full_name ?? 'User'}</p>
                    <p className={`text-xs font-black capitalize leading-tight ${ROLE_COLORS[profile?.role ?? ''] ?? 'text-black/60'}`}>
                      {roleLabel}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="rounded-xl border-2 border-college-black bg-college-orange p-2 text-white shadow-[3px_3px_0_#0A0A0C] transition-all duration-200 hover:-translate-y-0.5 hover:bg-college-fuchsia hover:text-white"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-secondary px-4 py-2 text-xs">Login</Link>
                <Link to="/register" className="btn-primary px-4 py-2 text-xs">Sign Up</Link>
              </div>
            )}

            {user && (
              <button
                className="rounded-xl border-2 border-college-black bg-white p-2 text-college-black shadow-[3px_3px_0_#00CED1] md:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                title="Menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {mobileOpen && user && (
        <div className="flex flex-col gap-2 border-t-2 border-college-black bg-white px-4 py-3 md:hidden animate-slide-down">
          {navLinks.map(link => {
            const active = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border-2 border-college-black px-4 py-2.5 text-sm font-black transition-all ${
                  active ? 'bg-college-fuchsia text-white shadow-[3px_3px_0_#0A0A0C]' : 'bg-white text-college-black'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
