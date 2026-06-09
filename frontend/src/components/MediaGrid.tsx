import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, Download, Trash2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deleteFile } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import MediaLightbox from './MediaLightbox'

type MediaItem = {
  id: string; url: string; thumbnail_url: string | null
  type: string; title: string | null; tags: string[]
  caption?: string | null
  uploaded_by: string; like_count: number; created_at: string
  event_id: string; album_id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

type Props = {
  media: MediaItem[]
  view: 'grid' | 'list'
  canManage?: boolean
  initialLightboxIndex?: number | null
  onDeleted: () => void
  eventName?: string
  clubName?: string
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export default function MediaGrid({ media, view, canManage, initialLightboxIndex, onDeleted, eventName = '', clubName = '', hasMore = false, loadingMore = false, onLoadMore }: Props) {
  const { profile } = useAuth()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [likedIds, setLikedIds]     = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [visibleMedia, setVisibleMedia] = useState<MediaItem[]>(media)
  const didAutoOpen    = useRef(false)
  const skipRefreshIds = useRef(new Set<string>())
  const sentinelRef    = useRef<HTMLDivElement>(null)

  useEffect(() => { setVisibleMedia(media) }, [media])

  useEffect(() => {
    if (initialLightboxIndex != null && !didAutoOpen.current && media.length > 0) {
      didAutoOpen.current = true
      setLightboxIndex(initialLightboxIndex)
    }
  }, [initialLightboxIndex, media])

  useEffect(() => {
    setLikeCounts(prev => {
      const next = { ...prev }
      media.forEach(m => { if (!(m.id in next)) next[m.id] = m.like_count })
      return next
    })
  }, [media])

  useEffect(() => {
    if (!profile || media.length === 0) return
    const ids = media.map(m => m.id)
    supabase
      .from('likes')
      .select('media_id')
      .eq('user_id', profile.id)
      .in('media_id', ids)
      .then(({ data }) => {
        if (data) setLikedIds(new Set(data.map((l: { media_id: string }) => l.media_id)))
      })
  }, [media, profile])

  useEffect(() => {
    if (media.length === 0) return
    const ids = new Set(media.map(m => m.id))
    const albumId = media[0]?.album_id ?? 'unknown'

    async function refreshLikeCount(mediaId: string) {
      const { data } = await supabase.from('media').select('like_count').eq('id', mediaId).single()
      if (data && typeof data.like_count === 'number') {
        setLikeCounts(prev => ({ ...prev, [mediaId]: data.like_count }))
      }
    }

    const channel = supabase
      .channel(`grid_rt_${albumId}`)
      // Like count sync
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const mid = payload.new.media_id as string
        if (ids.has(mid)) refreshLikeCount(mid)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => {
        const mid = payload.old?.media_id as string
        if (mid && ids.has(mid)) refreshLikeCount(mid)
      })
      // Live deletion — remove photo for all users when any user deletes it
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'media' }, (payload) => {
        const deletedId = payload.old?.id as string
        if (deletedId && ids.has(deletedId)) {
          setVisibleMedia(prev => prev.filter(m => m.id !== deletedId))
          setLightboxIndex(prev => {
            if (prev === null) return null
            // Adjust index if deleted item was before or at current index
            const deletedIdx = Array.from(ids).indexOf(deletedId)
            if (deletedIdx < 0) return prev
            return prev > 0 && deletedIdx <= prev ? prev - 1 : prev
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [media])

  const onLoadMoreStable = useCallback(() => { if (onLoadMore) onLoadMore() }, [onLoadMore])
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || !onLoadMore) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loadingMore) onLoadMoreStable() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMoreStable, onLoadMore])

  async function handleLike(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!profile) return
    const isLiked = likedIds.has(mediaId)

    // Optimistic UI update
    setLikedIds(prev => { const s = new Set(prev); isLiked ? s.delete(mediaId) : s.add(mediaId); return s })
    setLikeCounts(prev => ({ ...prev, [mediaId]: Math.max(0, (prev[mediaId] ?? 0) + (isLiked ? -1 : 1)) }))

    if (isLiked) {
      const { data: newCount, error: rpcErr } = await supabase.rpc('decrement_like_count', { p_media_id: mediaId })
      if (rpcErr) console.error('decrement_like_count failed:', rpcErr)
      else if (typeof newCount === 'number') setLikeCounts(prev => ({ ...prev, [mediaId]: newCount }))
      await supabase.from('likes').delete().eq('media_id', mediaId).eq('user_id', profile.id)
    } else {
      const { data: newCount, error: rpcErr } = await supabase.rpc('increment_like_count', { p_media_id: mediaId })
      if (rpcErr) console.error('increment_like_count failed:', rpcErr)
      else if (typeof newCount === 'number') setLikeCounts(prev => ({ ...prev, [mediaId]: newCount }))
      await supabase.from('likes').insert({ media_id: mediaId, user_id: profile.id })
    }
  }

  async function handleDownload(item: MediaItem, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res  = await fetch(item.url)
      const blob = await res.blob()
      const ext  = item.url.split('.').pop()?.split('?')[0] ?? 'jpg'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${item.title ?? 'media'}.${ext}`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    }
  }

  async function handleDelete(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this photo?')) return

    // Remove instantly from local state (realtime will also fire for other users)
    const item = visibleMedia.find(m => m.id === mediaId)
    setVisibleMedia(prev => prev.filter(m => m.id !== mediaId))
    if (lightboxIndex !== null) setLightboxIndex(null)

    const { error } = await supabase.from('media').delete().eq('id', mediaId)
    if (error) {
      // Restore on failure
      if (item) setVisibleMedia(prev => [...prev, item].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      toast.error('Delete failed')
      return
    }

    // Also delete the file from storage (works for both Supabase and S3)
    if (item?.url) {
      try { await deleteFile(item.url) } catch (err) {
        console.warn('[Storage] File delete failed (DB row already removed):', err)
      }
    }

    toast.success('Photo deleted')
    onDeleted()
  }

  function handleLightboxClose() {
    setLightboxIndex(null)
    if (!profile || visibleMedia.length === 0) return
    const ids = visibleMedia.map(m => m.id)
    supabase.from('likes').select('media_id').eq('user_id', profile.id).in('media_id', ids)
      .then(({ data }) => {
        if (data) setLikedIds(new Set(data.map((l: { media_id: string }) => l.media_id)))
      })
    supabase.from('media').select('id, like_count').in('id', ids)
      .then(({ data }) => {
        if (data) setLikeCounts(prev => {
          const next = { ...prev }
          data.forEach((m: { id: string; like_count: number }) => { next[m.id] = m.like_count })
          return next
        })
      })
  }

  if (view === 'list') {
    return (
      <div className="space-y-2">
        {visibleMedia.map((item, i) => (
          <div key={item.id}
            onClick={() => setLightboxIndex(i)}
            className="card flex items-center gap-4 py-3 cursor-pointer hover:shadow-md transition-all group">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <img src={item.thumbnail_url ?? item.url} alt={item.title ?? ''}
                className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{item.title ?? 'Untitled'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.profiles?.full_name} · {new Date(item.created_at).toLocaleDateString()}</p>
              {item.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {item.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="badge bg-amber-50 text-amber-700 text-xs">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => handleLike(item.id, e)}
                className={`flex items-center gap-1 text-xs p-1.5 rounded-lg transition-colors ${likedIds.has(item.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                <Heart size={14} fill={likedIds.has(item.id) ? 'currentColor' : 'none'} />
                {likeCounts[item.id] ?? item.like_count}
              </button>
              <button onClick={e => handleDownload(item, e)} className="text-gray-400 hover:text-college-amber p-1.5 rounded-lg transition-colors">
                <Download size={14} />
              </button>
              {canManage && (
                <button onClick={e => handleDelete(item.id, e)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {lightboxIndex !== null && (
          <MediaLightbox media={visibleMedia} index={lightboxIndex} onClose={handleLightboxClose} onIndexChange={setLightboxIndex} eventName={eventName} clubName={clubName} />
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {visibleMedia.map((item, i) => (
          <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
            onClick={() => setLightboxIndex(i)}>
            <img src={item.thumbnail_url ?? item.url} alt={item.title ?? ''}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end p-2">
              <div className="w-full opacity-0 group-hover:opacity-100 transition-opacity">
                {item.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {item.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button onClick={e => handleLike(item.id, e)}
                      className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${likedIds.has(item.id) ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-red-500'}`}>
                      <Heart size={12} fill={likedIds.has(item.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={e => handleDownload(item, e)}
                      className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-college-amber backdrop-blur-sm transition-colors">
                      <Download size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                      className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/40 backdrop-blur-sm transition-colors">
                      <Eye size={12} />
                    </button>
                  </div>
                  {canManage && (
                    <button onClick={e => handleDelete(item.id, e)}
                      className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-600 backdrop-blur-sm transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* like count */}
            {(likeCounts[item.id] ?? item.like_count) > 0 && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                <Heart size={9} fill="currentColor" className="text-red-400" />
                {likeCounts[item.id] ?? item.like_count}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel — sits just below the grid */}
      <div ref={sentinelRef} />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-college-amber rounded-full animate-spin" />
            Loading more…
          </div>
        </div>
      )}
      {!hasMore && visibleMedia.length >= 20 && onLoadMore && (
        <div className="text-center py-4 text-xs text-gray-400">All photos loaded</div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox media={visibleMedia} index={lightboxIndex} onClose={handleLightboxClose} onIndexChange={setLightboxIndex} eventName={eventName} clubName={clubName} />
      )}
    </>
  )
}
