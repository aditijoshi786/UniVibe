import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { Upload, Image, Grid3X3, List, Camera, Share2, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MediaUploader from '../components/MediaUploader'
import MediaGrid from '../components/MediaGrid'
import QRModal from '../components/QRModal'
import toast from 'react-hot-toast'

type Album = {
  id: string; title: string; description: string | null
  is_public: boolean; event_id: string; cover_image: string | null
  events: { title: string; club_id: string | null; clubs: { name: string } | null } | null
}

type MediaItem = {
  id: string; url: string; thumbnail_url: string | null
  type: string; title: string | null; tags: string[]
  caption?: string | null
  uploaded_by: string; like_count: number; created_at: string
  event_id: string; album_id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

const PAGE_SIZE = 20

export default function AlbumPage() {
  const { id: eventId, albumId } = useParams<{ id: string; albumId: string }>()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [album, setAlbum]     = useState<Album | null>(null)
  const [media, setMedia]     = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [view, setView]       = useState<'grid' | 'list'>('grid')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [isMemberOfClub, setIsMemberOfClub]                     = useState(false)
  const [isApprovedPhotographerForClub, setIsApprovedPhotographer] = useState(false)
  const [hasMore, setHasMore]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef       = useRef(0)
  const [showQR, setShowQR]           = useState(false)
  const autoOpenedRef = useRef<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [initialLightboxIndex, setInitialLightboxIndex] = useState<number | null>(null)

  const isAdmin          = profile?.role === 'admin'
  const clubMemberCanAct = profile?.role === 'club_member' && isMemberOfClub
  // Photographer can only upload/manage if approved for THIS club
  const canUpload = isAdmin || isApprovedPhotographerForClub || clubMemberCanAct
  const canManage = isAdmin || isApprovedPhotographerForClub || clubMemberCanAct

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !album) return
    setUploadingCover(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    // Include timestamp so each upload gets a unique URL — prevents browser caching old cover
    const path = `album-covers/${album.id}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
    if (error) { toast.error('Cover upload failed'); setUploadingCover(false); return }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(data.path)
    const { error: dbErr } = await supabase.from('albums').update({ cover_image: publicUrl }).eq('id', album.id)
    if (dbErr) { toast.error('Failed to save cover'); setUploadingCover(false); return }
    toast.success('Album cover updated')
    fetchAlbum()
    setUploadingCover(false)
    e.target.value = ''
  }

  const fetchAlbum = useCallback(async () => {
    const { data } = await supabase
      .from('albums')
      .select('*, events(title, club_id, clubs(name))')
      .eq('id', albumId)
      .single()
    setAlbum(data)
    const clubId = data?.events?.club_id

    if (profile?.role === 'club_member' && clubId) {
      const { data: membership } = await supabase
        .from('club_memberships')
        .select('id')
        .eq('club_id', clubId)
        .eq('user_id', profile.id)
        .single()
      setIsMemberOfClub(!!membership)
    } else {
      setIsMemberOfClub(false)
    }

    // Photographer: check they have an APPROVED request for this specific club
    if (profile?.role === 'photographer' && clubId) {
      const { data: req } = await supabase
        .from('photographer_requests')
        .select('id')
        .eq('photographer_id', profile.id)
        .eq('club_id', clubId)
        .eq('status', 'approved')
        .maybeSingle()
      setIsApprovedPhotographer(!!req)
    } else {
      setIsApprovedPhotographer(false)
    }
  }, [albumId, profile])

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    pageRef.current = 0
    const { data } = await supabase
      .from('media')
      .select('*, profiles(full_name, avatar_url)')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    const list = (data ?? []) as MediaItem[]
    setMedia(list)
    setHasMore(list.length === PAGE_SIZE)
    setLoading(false)

    const photoId = searchParams.get('photo')
    if (photoId && autoOpenedRef.current !== photoId) {
      const idx = list.findIndex(m => m.id === photoId)
      if (idx !== -1) {
        autoOpenedRef.current = photoId
        setInitialLightboxIndex(idx)
      }
    }
  }, [albumId, searchParams])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = pageRef.current + 1
    const from = nextPage * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const { data } = await supabase
      .from('media')
      .select('*, profiles(full_name, avatar_url)')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .range(from, to)
    const list = (data ?? []) as MediaItem[]
    setMedia(prev => [...prev, ...list])
    setHasMore(list.length === PAGE_SIZE)
    pageRef.current = nextPage
    setLoadingMore(false)
  }, [albumId, hasMore, loadingMore])

  useEffect(() => {
    fetchAlbum()
    fetchMedia()
  }, [fetchAlbum, fetchMedia])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/events" className="hover:text-college-amber transition-colors">Events</Link>
        <span>/</span>
        <Link to={`/events/${eventId}`} className="hover:text-college-amber transition-colors">
          {album?.events?.title ?? 'Event'}
        </Link>
        <span>/</span>
        <span className="text-college-navy font-medium">{album?.title}</span>
      </div>

      {/* Album cover banner */}
      <div className="rounded-2xl overflow-hidden mb-6 relative" style={{ background: '#1a0a14' }}>
        <div className="h-48 relative">
          {album?.cover_image ? (
            <img src={album.cover_image} alt={album.title} className="w-full h-full object-cover object-center" style={{ opacity: 0.80 }} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-college-purple to-college-orange/40 flex items-center justify-center">
              <Image size={36} className="text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 p-6 flex flex-col justify-end">
            <h1 className="text-2xl font-display font-bold text-white">{album?.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {album?.description && <p className="text-white/60 text-sm">{album.description}</p>}
              {album?.events?.clubs?.name && (
                <span className="badge-amber text-xs">{album.events.clubs.name}</span>
              )}
              <span className="text-white/50 text-xs">{media.length} photo{media.length !== 1 ? 's' : ''}</span>
              {canUpload && (
                <>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <Camera size={12} />
                    {uploadingCover ? 'Uploading...' : album?.cover_image ? 'Change Cover' : 'Add Cover'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-end mb-6 gap-2">
        <button
          onClick={() => setShowQR(true)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-college-orange text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-college-orange transition-colors">
          <QrCode size={13} /> QR Code
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!') }}
          className="flex items-center gap-1.5 text-gray-400 hover:text-college-amber text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-college-amber transition-colors">
          <Share2 size={13} /> Share
        </button>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button onClick={() => setView('grid')}
            className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-400 hover:text-gray-600'}`}>
            <Grid3X3 size={15} />
          </button>
          <button onClick={() => setView('list')}
            className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-college-navy' : 'text-gray-400 hover:text-gray-600'}`}>
            <List size={15} />
          </button>
        </div>
        {canUpload && (
          <button onClick={() => setShowUploader(!showUploader)} className="btn-primary flex items-center gap-2">
            <Upload size={15} /> Upload
          </button>
        )}
      </div>

      {/* Uploader */}
      {showUploader && (
        <div className="mb-6">
          <MediaUploader
            eventId={eventId!}
            albumId={albumId!}
            isPublic={album?.is_public ?? true}
            eventName={album?.events?.title ?? ''}
            clubName={album?.events?.clubs?.name ?? ''}
            onUploaded={() => { fetchMedia(); setShowUploader(false) }}
            onCancel={() => setShowUploader(false)}
          />
        </div>
      )}

      {/* Media — hidden while uploader is open to keep the focus on uploading */}
      {showUploader ? null : media.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Image size={28} className="text-amber-300" />
          </div>
          <h3 className="font-semibold text-college-navy">No photos yet</h3>
          <p className="text-gray-400 text-sm mt-1">
            {canUpload ? 'Upload photos to this album.' : 'No media has been uploaded yet.'}
          </p>
          {canUpload && (
            <button onClick={() => setShowUploader(true)} className="btn-primary mt-5 flex items-center gap-2">
              <Upload size={15} /> Upload Photos
            </button>
          )}
        </div>
      ) : (
        <MediaGrid
          media={media}
          view={view}
          canManage={canManage}
          initialLightboxIndex={initialLightboxIndex}
          onDeleted={fetchMedia}
          eventName={album?.events?.title ?? ''}
          clubName={album?.events?.clubs?.name ?? ''}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}
      {/* QR share modal */}
      {showQR && (
        <QRModal
          url={window.location.href}
          title={album?.title ?? 'Album'}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  )
}
