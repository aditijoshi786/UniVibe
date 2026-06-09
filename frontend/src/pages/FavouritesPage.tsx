import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Grid3X3, List, ArrowLeft, ImageOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MediaGrid from '../components/MediaGrid'

// Full shape MediaGrid expects
type MediaItem = {
  id: string; url: string; thumbnail_url: string | null
  type: string; title: string | null; tags: string[]
  caption?: string | null
  uploaded_by: string; like_count: number; created_at: string
  event_id: string; album_id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

export default function FavouritesPage() {
  const { profile } = useAuth()

  const [media, setMedia]     = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<'grid' | 'list'>('grid')

  const fetchFavourites = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data, error } = await supabase
      .from('favourites')
      .select(`
        media:media_id(
          id, url, thumbnail_url, type, title, tags, caption,
          uploaded_by, like_count, created_at, event_id, album_id,
          profiles(full_name, avatar_url)
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) { setLoading(false); return }

    // Unwrap the nested media object from each favourite row
    const items = (data ?? [])
      .map((row: any) => row.media)
      .filter(Boolean) as MediaItem[]

    setMedia(items)
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchFavourites() }, [fetchFavourites])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Back + header */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-college-amber mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-college-navy flex items-center gap-2.5">
            <Bookmark size={22} className="text-college-amber" />
            Saved Favourites
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Loading…' : `${media.length} saved photo${media.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* View toggle */}
        {!loading && media.length > 0 && (
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid3X3 size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Decorative header bar */}
      <div
        className="h-1.5 rounded-full mb-8"
        style={{ background: 'linear-gradient(90deg, #FF007F, #00CED1, #FF4500)' }}
      />

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
            <ImageOff size={32} className="text-amber-200" />
          </div>
          <h3 className="font-semibold text-college-navy text-lg">No saved photos yet</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">
            Open any photo in an album and tap the{' '}
            <Bookmark size={12} className="inline text-college-amber" />{' '}
            bookmark icon to save it here.
          </p>
          <Link to="/events" className="btn-primary mt-6 text-sm">
            Browse Events
          </Link>
        </div>
      ) : (
        <MediaGrid
          media={media}
          view={view}
          canManage={false}
          onDeleted={fetchFavourites}
        />
      )}
    </div>
  )
}
