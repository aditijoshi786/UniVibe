import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, Calendar, User, Tag, Filter, Image, Folder } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'

type MediaResult = {
  id: string; url: string; thumbnail_url: string | null
  title: string | null; tags: string[]; created_at: string
  event_id: string; album_id: string
  profiles: { full_name: string } | null
  events: { title: string; clubs: { name: string } | null } | null
}

type EventResult = {
  id: string; title: string; date: string; category: string
  cover_image: string | null; is_public: boolean
  clubs: { name: string } | null
}

const COMMON_TAGS = ['outdoors', 'sports', 'crowd', 'people', 'nature', 'food', 'travel', 'music', 'celebration', 'stage', 'technology', 'architecture']

export default function SearchPage() {
  const { profile } = useAuth()
  const [query,       setQuery]       = useState('')
  const [tagFilter,   setTagFilter]   = useState<string[]>([])
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [uploaderName,setUploaderName]= useState('')
  const [activeTab,   setActiveTab]   = useState<'photos' | 'events'>('photos')
  const [showFilters, setShowFilters] = useState(false)

  const [photos,  setPhotos]  = useState<MediaResult[]>([])
  const [events,  setEvents]  = useState<EventResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched,setSearched]= useState(false)

  const runSearch = useCallback(async () => {
    if (!query.trim() && tagFilter.length === 0 && !dateFrom && !dateTo && !uploaderName.trim()) return
    setLoading(true)
    setSearched(true)

    // --- Photos search ---
    let photoQuery = supabase
      .from('media')
      .select('id, url, thumbnail_url, title, tags, created_at, event_id, album_id, profiles(full_name), events(title, clubs(name))')
      .eq('type', 'photo')
      .order('created_at', { ascending: false })
      .limit(60)

    if (profile?.role === 'viewer') photoQuery = photoQuery.eq('is_public', true)

    if (query.trim()) {
      photoQuery = photoQuery.ilike('title', `%${query.trim()}%`)
    }
    if (tagFilter.length > 0) {
      photoQuery = photoQuery.overlaps('tags', tagFilter)
    }
    if (dateFrom) photoQuery = photoQuery.gte('created_at', dateFrom)
    if (dateTo)   photoQuery = photoQuery.lte('created_at', dateTo + 'T23:59:59')

    // --- Events search ---
    let eventQuery = supabase
      .from('events')
      .select('id, title, date, category, cover_image, is_public, clubs(name)')
      .order('date', { ascending: false })
      .limit(30)

    if (profile?.role === 'viewer') eventQuery = eventQuery.eq('is_public', true)
    if (query.trim()) eventQuery = eventQuery.ilike('title', `%${query.trim()}%`)
    if (dateFrom) eventQuery = eventQuery.gte('date', dateFrom)
    if (dateTo)   eventQuery = eventQuery.lte('date', dateTo)

    const [photoRes, eventRes] = await Promise.all([photoQuery, eventQuery])

    let filteredPhotos = (photoRes.data ?? []) as unknown as MediaResult[]

    // Filter by uploader name client-side (can't do ilike on joined column server-side easily)
    if (uploaderName.trim()) {
      const lc = uploaderName.toLowerCase()
      filteredPhotos = filteredPhotos.filter(p =>
        p.profiles?.full_name?.toLowerCase().includes(lc)
      )
    }

    setPhotos(filteredPhotos)
    setEvents((eventRes.data ?? []) as unknown as EventResult[])
    setLoading(false)
  }, [query, tagFilter, dateFrom, dateTo, uploaderName, profile])

  // Search on Enter
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') runSearch()
  }

  function toggleTag(tag: string) {
    setTagFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function clearAll() {
    setQuery(''); setTagFilter([]); setDateFrom(''); setDateTo(''); setUploaderName('')
    setPhotos([]); setEvents([]); setSearched(false)
  }

  const hasFilters = tagFilter.length > 0 || dateFrom || dateTo || uploaderName.trim()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-college-navy mb-1">Advanced Search</h1>
        <p className="text-gray-400 text-sm">Search photos by title, tags, date, or uploader — or find events by name.</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by photo title or event name…"
            className="input pl-9 w-full"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${showFilters || hasFilters ? 'bg-college-amber text-white border-college-amber' : 'border-gray-200 text-gray-600 hover:border-college-amber'}`}>
          <Filter size={14} />
          Filters {hasFilters ? `(${tagFilter.length + (dateFrom?1:0) + (dateTo?1:0) + (uploaderName?1:0)})` : ''}
        </button>
        <button onClick={runSearch} disabled={loading}
          className="btn-primary px-5 flex items-center gap-2">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={15} />}
          Search
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card mb-6 border-college-amber/20 bg-amber-50/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label flex items-center gap-1.5"><User size={12} /> Uploaded by</label>
              <input type="text" className="input" placeholder="Member name…"
                value={uploaderName} onChange={e => setUploaderName(e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Calendar size={12} /> From date</label>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Calendar size={12} /> To date</label>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5 mb-2"><Tag size={12} /> Filter by tags</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tagFilter.includes(tag) ? 'bg-college-amber text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-college-amber'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="mt-3 text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
            <button onClick={() => setActiveTab('photos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'photos' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-500 hover:text-gray-700'}`}>
              <Image size={14} /> Photos ({photos.length})
            </button>
            <button onClick={() => setActiveTab('events')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'events' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-500 hover:text-gray-700'}`}>
              <Folder size={14} /> Events ({events.length})
            </button>
          </div>

          {/* Photos tab */}
          {activeTab === 'photos' && (
            photos.length === 0 ? (
              <div className="card text-center py-16">
                <Search size={36} className="text-amber-200 mx-auto mb-3" />
                <p className="font-semibold text-college-navy">No photos found</p>
                <p className="text-gray-400 text-sm mt-1">Try different keywords or tags.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {photos.map(photo => (
                  <Link key={photo.id}
                    to={`/events/${photo.event_id}/albums/${photo.album_id}?photo=${photo.id}`}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={photo.thumbnail_url ?? photo.url} alt={photo.title ?? ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100">
                      <p className="text-white text-xs font-medium truncate">{photo.title ?? 'Untitled'}</p>
                      <p className="text-white/60 text-xs">{photo.profiles?.full_name}</p>
                      {photo.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {photo.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* Events tab */}
          {activeTab === 'events' && (
            events.length === 0 ? (
              <div className="card text-center py-16">
                <Search size={36} className="text-amber-200 mx-auto mb-3" />
                <p className="font-semibold text-college-navy">No events found</p>
                <p className="text-gray-400 text-sm mt-1">Try a different event name or date range.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(ev => (
                  <Link key={ev.id} to={`/events/${ev.id}`}
                    className="card hover:shadow-md transition-all hover:-translate-y-0.5 p-0 overflow-hidden flex flex-col group">
                    <div className="h-32 bg-gradient-to-br from-college-purple to-college-orange/40 relative overflow-hidden">
                      {ev.cover_image && (
                        <img src={ev.cover_image} alt={ev.title} className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300" />
                      )}
                      <div className="absolute top-2 right-2">
                        <span className="badge bg-college-amber/90 text-white text-xs">{ev.category}</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-college-navy text-sm group-hover:text-college-amber transition-colors">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <Calendar size={11} /> {format(new Date(ev.date), 'dd MMM yyyy')}
                        {ev.clubs?.name && <span className="badge-amber text-xs">{ev.clubs.name}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Empty state before first search */}
      {!searched && (
        <div className="card text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Search size={28} className="text-college-amber" />
          </div>
          <h3 className="font-semibold text-college-navy">Search the platform</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            Find photos by title, auto-generated AI tags, upload date, or uploader name. Search events by name or date range.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {COMMON_TAGS.slice(0, 6).map(tag => (
              <button key={tag} onClick={() => { toggleTag(tag); setShowFilters(true) }}
                className="px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-college-amber hover:text-white transition-colors">
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
