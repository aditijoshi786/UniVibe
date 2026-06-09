import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAllClubs } from '../hooks/useClubs'
import EventCard from '../components/EventCard'
import CreateEventModal from '../components/CreateEventModal'

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'
type EventRow = {
  id: string; title: string; description: string | null
  category: string; date: string; cover_image: string | null
  is_public: boolean; created_by: string; club_id: string | null
  clubs: { name: string } | null
  profiles: { full_name: string } | null
  media_count: number
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc',  label: 'Oldest first' },
  { value: 'name_asc',  label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
]

const CATEGORIES = ['All', 'General', 'Workshop', 'Competition', 'Cultural Fest', 'Trip', 'Photoshoot', 'Party', 'Seminar', 'Sports']

export default function EventsPage() {
  const { profile } = useAuth()
  const { clubs } = useAllClubs()

  const [events, setEvents]           = useState<EventRow[]>([])
  const [userClubIds, setUserClubIds] = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState<SortKey>('date_desc')
  const [categoryFilter, setCategory] = useState('All')
  const [clubFilter, setClubFilter]   = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const canCreate = profile?.role === 'admin' || profile?.role === 'club_member'

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('events')
      .select(`*, clubs(name), profiles(full_name)`)

    // Viewers + photographers only see public events
    if (profile?.role === 'viewer' || profile?.role === 'photographer') {
      query = query.eq('is_public', true)
    } else if (profile?.role === 'club_member') {
      // club members see public events + private events of their clubs
      const { data: memberships } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', profile.id)
      const clubIds = (memberships ?? []).map((m: any) => m.club_id)
      setUserClubIds(clubIds)
      if (clubIds.length > 0) {
        query = query.or(`is_public.eq.true,club_id.in.(${clubIds.join(',')})`)
      } else {
        query = query.eq('is_public', true)
      }
    }

    if (categoryFilter !== 'All') query = query.eq('category', categoryFilter)
    if (clubFilter !== 'all')      query = query.eq('club_id', clubFilter)

    const [col, dir] = sort === 'date_desc' ? ['date', false]
      : sort === 'date_asc' ? ['date', true]
      : sort === 'name_asc' ? ['title', true]
      : ['title', false]

    query = query.order(col as string, { ascending: dir as boolean })

    const { data, error } = await query
    if (error) { setLoading(false); return }

    // Attach media count
    const withCounts = await Promise.all((data ?? []).map(async (ev) => {
      const { count } = await supabase
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', ev.id)
      return { ...ev, media_count: count ?? 0 }
    }))

    setEvents(withCounts as EventRow[])
    setLoading(false)
  }, [profile, sort, categoryFilter, clubFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.clubs?.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  const activeFilters = (categoryFilter !== 'All' ? 1 : 0) + (clubFilter !== 'all' ? 1 : 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-college-navy">Events</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Event
          </button>
        )}
      </div>

      {/* Search + controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Search events, clubs, categories..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <select className="input w-auto text-sm" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              showFilters || activeFilters > 0 ? 'border-college-amber bg-amber-50 text-college-amber' : 'border-gray-200 text-gray-600 hover:border-amber-200'
            }`}>
            <SlidersHorizontal size={15} />
            Filters
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-college-amber text-white text-xs flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    categoryFilter === c ? 'bg-college-amber text-white border-college-amber' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label text-xs">Club</label>
            <select className="input text-sm w-44" value={clubFilter} onChange={e => setClubFilter(e.target.value)}>
              <option value="all">All clubs</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setCategory('All'); setClubFilter('all') }}
              className="text-sm text-red-400 hover:text-red-600 underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Events grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Search size={28} className="text-amber-200" />
          </div>
          <h3 className="font-semibold text-college-navy">No events found</h3>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">
            {search ? `No results for "${search}"` : 'No events match the selected filters.'}
          </p>
          {canCreate && !search && (
            <button onClick={() => setShowModal(true)} className="btn-primary mt-5 flex items-center gap-2">
              <Plus size={15} /> Create First Event
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(event => (
            <EventCard key={event.id} event={event} onDeleted={fetchEvents} userClubIds={userClubIds} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateEventModal onClose={() => setShowModal(false)} onCreated={fetchEvents} />
      )}
    </div>
  )
}
