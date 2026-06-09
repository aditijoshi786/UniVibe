import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Image, Calendar, Bookmark, Users, ArrowRight, Globe, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type RecentEvent = {
  id: string; title: string; date: string; category: string
  cover_image: string | null; is_public: boolean
  clubs: { name: string } | null
}

type Club = {
  id: string; name: string; slug: string
}


const CATEGORY_COLORS: Record<string, string> = {
  Workshop:      'bg-college-teal/25 text-college-black',
  Competition:   'bg-college-orange/20 text-college-black',
  'Cultural Fest': 'bg-college-fuchsia/15 text-college-black',
  Trip:          'bg-college-coral/25 text-college-black',
  Photoshoot:    'bg-college-fuchsia/15 text-college-black',
  Party:         'bg-college-orange/20 text-college-black',
  Seminar:       'bg-college-teal/25 text-college-black',
  Sports:        'bg-college-coral/25 text-college-black',
  General:       'bg-white text-college-black',
}

export default function DashboardPage() {
  const { profile } = useAuth()

  const [stats, setStats] = useState({ events: 0, photos: 0, albums: 0, favourites: 0 })
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [myClubs, setMyClubs]           = useState<Club[]>([])
  const [loading, setLoading]           = useState(true)

  const loadDashboard = useCallback(async () => {
    if (!profile) return

    const isAdmin = profile.role === 'admin'

    // Fetch stats in parallel
    const [photosRes, albumsRes, favsRes, clubsRes] = await Promise.all([
      supabase.from('media').select('id', { count: 'exact', head: true }).eq('uploaded_by', profile.id),
      supabase.from('albums').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
      supabase.from('favourites').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
      isAdmin
        ? supabase.from('clubs').select('id, name, slug').limit(5)
        : supabase.from('club_memberships')
            .select('clubs(id, name, slug)')
            .eq('user_id', profile.id),
    ])

    // Events count — events they created or attended (via club membership)
    let eventsCount = 0
    if (isAdmin) {
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true })
      eventsCount = count ?? 0
    } else {
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('created_by', profile.id)
      eventsCount = count ?? 0
    }

    setStats({
      events:     eventsCount,
      photos:     photosRes.count ?? 0,
      albums:     albumsRes.count ?? 0,
      favourites: favsRes.count ?? 0,
    })

    // Clubs
    if (isAdmin) {
      setMyClubs((clubsRes.data ?? []) as Club[])
    } else {
      const list = (clubsRes.data ?? []).map((d: any) => d.clubs).filter(Boolean) as Club[]
      setMyClubs(list)
    }

    // Recent events (last 6, role-filtered)
    let eventsQuery = supabase
      .from('events')
      .select('id, title, date, category, cover_image, is_public, clubs(name)')
      .order('date', { ascending: false })
      .limit(6)
    if (profile.role === 'viewer') eventsQuery = eventsQuery.eq('is_public', true)
    const { data: evData } = await eventsQuery
    setRecentEvents((evData ?? []) as unknown as RecentEvent[])

    setLoading(false)
  }, [profile])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Re-fetch when user returns to this tab (e.g. after liking photos elsewhere)
  useEffect(() => {
    function onFocus() { loadDashboard() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadDashboard])

  const statCards = [
    { label: profile?.role === 'admin' ? 'Total Events' : 'Events Created', value: stats.events, icon: Calendar, color: 'bg-college-fuchsia text-white border-2 border-college-black shadow-[3px_3px_0_#0A0A0C]', to: '/events' },
    { label: 'Photos Uploaded', value: stats.photos, icon: Camera, color: 'bg-college-coral text-college-black border-2 border-college-black shadow-[3px_3px_0_#0A0A0C]', to: null },
    { label: 'Albums Created', value: stats.albums, icon: Image, color: 'bg-college-teal text-college-black border-2 border-college-black shadow-[3px_3px_0_#0A0A0C]', to: null },
    { label: 'Saved Favourites', value: stats.favourites, icon: Bookmark, color: 'bg-college-orange text-white border-2 border-college-black shadow-[3px_3px_0_#0A0A0C]', to: '/favourites' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-college-navy">
          Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening across your club events.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, to }) => {
          const inner = (
            <>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                {loading ? (
                  <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-college-navy">{value}</p>
                )}
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </>
          )
          return to ? (
            <Link key={label} to={to} className="card flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              {inner}
            </Link>
          ) : (
            <div key={label} className="card flex items-center gap-4">
              {inner}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent events */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-college-navy">Recent Events</h2>
            <Link to="/events" className="text-xs text-college-amber hover:text-college-gold font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={36} className="text-amber-200 mb-3" />
              <p className="text-gray-400 text-sm">No events yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map(ev => (
                <Link key={ev.id} to={`/events/${ev.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-amber-50 transition-colors group">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {ev.cover_image ? (
                      <img src={ev.cover_image} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-college-purple to-college-orange/40 flex items-center justify-center">
                        <Calendar size={16} className="text-white/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate group-hover:text-college-amber transition-colors">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {ev.clubs?.name && <span className="text-xs text-gray-400">{ev.clubs.name}</span>}
                      <span className={`badge text-xs ${CATEGORY_COLORS[ev.category] ?? 'bg-gray-100 text-gray-600'}`}>{ev.category}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{format(new Date(ev.date), 'dd MMM')}</p>
                    <span className="text-xs text-gray-400">
                      {ev.is_public ? <Globe size={11} className="inline" /> : <Lock size={11} className="inline" />}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Profile card */}
          <div className="card">
            <h2 className="font-semibold text-college-navy mb-4">Your Profile</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-800">{profile?.full_name ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Role</span>
                <span className="badge-amber capitalize">{profile?.role?.replace('_', ' ') ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-800 text-xs truncate max-w-[140px]">{profile?.email ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Joined</span>
                <span className="font-medium text-gray-800">
                  {profile?.created_at ? format(new Date(profile.created_at), 'MMM yyyy') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* My Clubs */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-college-navy">
                {profile?.role === 'admin' ? 'All Clubs' : 'My Clubs'}
              </h2>
              <Link to="/clubs" className="text-xs text-college-amber hover:text-college-gold font-medium transition-colors">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : myClubs.length === 0 ? (
              <div className="text-center py-6">
                <Users size={28} className="text-amber-200 mx-auto mb-2" />
                <p className="text-gray-400 text-xs">Not in any clubs yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myClubs.map(club => (
                  <Link key={club.id} to={`/clubs/${club.slug}`}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-college-navy flex items-center justify-center shrink-0">
                      <span className="text-college-gold text-xs font-bold">{club.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-college-amber transition-colors">{club.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
