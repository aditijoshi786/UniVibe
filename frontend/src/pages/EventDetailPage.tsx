import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Calendar, Globe, Lock, ArrowLeft, Plus, Image, Folder, Trash2, Pencil, Camera, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import EditEventModal from '../components/EditEventModal'
import toast from 'react-hot-toast'

type Event = {
  id: string; title: string; description: string | null
  category: string; date: string; cover_image: string | null
  is_public: boolean; created_by: string; club_id: string | null
  clubs: { name: string } | null
  profiles: { full_name: string } | null
}

type Album = {
  id: string; title: string; description: string | null
  is_public: boolean; created_at: string
  media_count?: number
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [event, setEvent]     = useState<Event | null>(null)
  const [albums, setAlbums]   = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [showAlbumForm, setShowAlbumForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [isMemberOfClub, setIsMemberOfClub]                       = useState(false)
  const [isApprovedPhotographerForClub, setIsApprovedPhotographer] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [newAlbumTitle, setNewAlbumTitle] = useState('')
  const [newAlbumDesc, setNewAlbumDesc]   = useState('')
  const [creatingAlbum, setCreatingAlbum] = useState(false)

  const isAdmin        = profile?.role === 'admin'
  const isClubMember   = profile?.role === 'club_member'
  const isCreator      = profile?.id === event?.created_by

  // Club members can only act within their own clubs
  const clubMemberCanAct = isClubMember && isMemberOfClub
  // Photographer can only act if approved for this event's club
  const canEdit   = isAdmin || clubMemberCanAct || isCreator
  const canUpload = isAdmin || isApprovedPhotographerForClub || clubMemberCanAct
  const canManage = isAdmin || isApprovedPhotographerForClub || clubMemberCanAct

  const fetchEvent = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, clubs(name), profiles(full_name)')
      .eq('id', id)
      .single()
    if (error || !data) { navigate('/events'); return }
    setEvent(data)
    // Check if current user is a member of this event's club
    if (profile?.role === 'club_member' && data.club_id) {
      const { data: membership } = await supabase
        .from('club_memberships')
        .select('id')
        .eq('club_id', data.club_id)
        .eq('user_id', profile.id)
        .single()
      setIsMemberOfClub(!!membership)
    } else {
      setIsMemberOfClub(false)
    }

    // Check if photographer is approved for this event's club
    if (profile?.role === 'photographer' && data.club_id) {
      const { data: req } = await supabase
        .from('photographer_requests')
        .select('id')
        .eq('photographer_id', profile.id)
        .eq('club_id', data.club_id)
        .eq('status', 'approved')
        .maybeSingle()
      setIsApprovedPhotographer(!!req)
    } else {
      setIsApprovedPhotographer(false)
    }
  }, [id, navigate, profile])

  const fetchAlbums = useCallback(async () => {
    const { data } = await supabase
      .from('albums')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    const withCounts = await Promise.all((data ?? []).map(async (album) => {
      const { count } = await supabase
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('album_id', album.id)
      return { ...album, media_count: count ?? 0 }
    }))

    setAlbums(withCounts)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchEvent()
    fetchAlbums()
  }, [fetchEvent, fetchAlbums])

  async function handleCreateAlbum(e: React.FormEvent) {
    e.preventDefault()
    if (!newAlbumTitle.trim()) return
    setCreatingAlbum(true)
    const { error } = await supabase.from('albums').insert({
      event_id:    id,
      title:       newAlbumTitle.trim(),
      description: newAlbumDesc.trim() || null,
      is_public:   event?.is_public ?? true,
      created_by:  profile!.id,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Album created')
      setNewAlbumTitle('')
      setNewAlbumDesc('')
      setShowAlbumForm(false)
      fetchAlbums()
    }
    setCreatingAlbum(false)
  }

  async function deleteAlbum(albumId: string, title: string) {
    if (!confirm(`Delete album "${title}"?`)) return
    const { error } = await supabase.from('albums').delete().eq('id', albumId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Album deleted'); fetchAlbums() }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-56 bg-gray-200 rounded-2xl" />
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    )
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !event) return
    setUploadingCover(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `covers/${event.id}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
    if (error) { toast.error('Cover upload failed'); setUploadingCover(false); return }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(data.path)
    await supabase.from('events').update({ cover_image: publicUrl }).eq('id', event.id)
    toast.success('Cover image updated')
    fetchEvent()
    setUploadingCover(false)
  }

  if (!event) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-college-amber mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Events
      </Link>

      {/* Event hero */}
      <div className="rounded-2xl overflow-hidden mb-8 relative" style={{ background: '#1a0a14' }}>
        <div className="h-64 relative">
          {event.cover_image ? (
            <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover object-center" style={{ opacity: 0.75 }} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-college-purple via-college-maroon to-college-orange/40" />
          )}
          <div className="absolute inset-0 p-8 flex flex-col justify-end">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {event.clubs?.name && (
                <span className="badge-amber text-xs">{event.clubs.name}</span>
              )}
              <span className="badge bg-white/20 text-white text-xs">{event.category}</span>
              <span className={`badge text-xs flex items-center gap-1 ${event.is_public ? 'bg-white/20 text-white' : 'bg-black/30 text-white'}`}>
                {event.is_public ? <Globe size={10} /> : <Lock size={10} />}
                {event.is_public ? 'Public' : 'Private'}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!') }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg transition-colors ml-auto">
                <Share2 size={11} /> Share
              </button>
            </div>
            <h1 className="text-3xl font-display font-bold text-white">{event.title}</h1>
            {event.description && (
              <p className="text-white/70 text-sm mt-2 max-w-2xl">{event.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-white/60 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {format(new Date(event.date), 'dd MMMM yyyy')}
              </span>
              {event.profiles?.full_name && (
                <span>Organised by {event.profiles.full_name}</span>
              )}
              {canEdit && (
                <div className="flex items-center gap-2 ml-auto">
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  <button onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    <Camera size={12} />
                    {uploadingCover ? 'Uploading...' : 'Change Cover'}
                  </button>
                  <button onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1.5 bg-college-amber/80 hover:bg-college-amber backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    <Pencil size={12} /> Edit Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Albums section */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-display font-bold text-college-navy">Albums</h2>
          <p className="text-gray-400 text-sm mt-0.5">{albums.length} album{albums.length !== 1 ? 's' : ''}</p>
        </div>
        {canUpload && (
          <button onClick={() => setShowAlbumForm(!showAlbumForm)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New Album
          </button>
        )}
      </div>

      {/* Create album form */}
      {showAlbumForm && (
        <form onSubmit={handleCreateAlbum} className="card mb-6 border-2 border-college-amber/30 bg-amber-50/30">
          <h3 className="font-semibold text-college-navy mb-4">Create Album</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Album Title</label>
              <input type="text" className="input" placeholder="e.g. Day 1 Highlights"
                value={newAlbumTitle} onChange={e => setNewAlbumTitle(e.target.value)} required />
            </div>
            <div>
              <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" className="input" placeholder="Brief description"
                value={newAlbumDesc} onChange={e => setNewAlbumDesc(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Album visibility inherits from the event ({event?.is_public ? 'Public' : 'Private'})
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAlbumForm(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
              <button type="submit" disabled={creatingAlbum} className="btn-primary py-2 px-4 text-sm">
                {creatingAlbum ? 'Creating...' : 'Create Album'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Albums grid */}
      {albums.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Folder size={40} className="text-amber-200 mb-3" />
          <h3 className="font-semibold text-college-navy">No albums yet</h3>
          <p className="text-gray-400 text-sm mt-1">
            {canUpload ? 'Create the first album for this event.' : 'No albums have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {albums.map(album => (
            <Link key={album.id} to={`/events/${event.id}/albums/${album.id}`} className="group block">
              <div className="card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 p-0 overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center relative">
                  <Image size={32} className="text-amber-300" />
                  {!album.is_public && (
                    <div className="absolute top-2 right-2">
                      <span className="badge bg-gray-800/60 text-white text-xs flex items-center gap-1">
                        <Lock size={9} /> Private
                      </span>
                    </div>
                  )}
                  {canManage && (
                    <button
                      onClick={e => { e.preventDefault(); deleteAlbum(album.id, album.title) }}
                      className="absolute top-2 left-2 p-1.5 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-college-navy text-sm group-hover:text-college-amber transition-colors">{album.title}</h3>
                  {album.description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{album.description}</p>}
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Image size={10} /> {album.media_count ?? 0} photos
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showEditModal && event && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onUpdated={fetchEvent}
        />
      )}
    </div>
  )
}
