import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ClubWithStats = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  created_at: string
  member_count: number
  event_count: number
}

export default function ClubsPage() {
  const [clubs, setClubs]   = useState<ClubWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    async function fetchClubs() {
      const { data } = await supabase
        .from('clubs')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (!data) { setLoading(false); return }

      const withStats = await Promise.all(data.map(async (club) => {
        const [{ count: memberCount }, { count: eventCount }] = await Promise.all([
          supabase.from('club_memberships').select('id', { count: 'exact', head: true }).eq('club_id', club.id),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('is_public', true),
        ])
        return { ...club, member_count: memberCount ?? 0, event_count: eventCount ?? 0 }
      }))

      setClubs(withStats)
      setLoading(false)
    }
    fetchClubs()
  }, [])

  const filtered = clubs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-college-navy">Clubs</h1>
        <p className="text-gray-500 text-sm mt-1">Browse all clubs and their events</p>
      </div>

      <div className="relative max-w-md mb-8">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" className="input pl-9" placeholder="Search clubs..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-40">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="text-amber-200 mx-auto mb-3" />
          <p className="text-college-navy font-semibold">No clubs found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search ? `No clubs matching "${search}"` : 'No clubs have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(club => (
            <Link key={club.id} to={`/clubs/${club.slug}`} className="group block">
              <div className="card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-college-navy flex items-center justify-center shrink-0 group-hover:bg-college-amber transition-colors">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-college-gold group-hover:text-white font-bold text-sm transition-colors">
                        {club.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-college-navy group-hover:text-college-amber transition-colors">
                      {club.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">
                      {club.description ?? 'No description provided.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-50 pt-3">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {club.member_count} member{club.member_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {club.event_count} event{club.event_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
