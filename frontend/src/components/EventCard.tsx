import { Link } from 'react-router-dom'
import { Calendar, Image, Lock, Globe, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

type Props = {
  event: {
    id: string
    title: string
    description: string | null
    category: string
    date: string
    cover_image: string | null
    is_public: boolean
    created_by: string
    club_id: string | null
    clubs?: { name: string } | null
    profiles?: { full_name: string } | null
    media_count?: number
  }
  onDeleted?: () => void
  userClubIds?: string[]
}

const CATEGORY_COLORS: Record<string, string> = {
  Workshop:      'bg-college-teal/25 text-college-black',
  Competition:   'bg-college-orange/20 text-college-black',
  'Cultural Fest':'bg-college-fuchsia/15 text-college-black',
  Trip:          'bg-college-coral/25 text-college-black',
  Photoshoot:    'bg-college-fuchsia/15 text-college-black',
  Party:         'bg-college-orange/20 text-college-black',
  Seminar:       'bg-college-teal/25 text-college-black',
  Sports:        'bg-college-coral/25 text-college-black',
  General:       'bg-white text-college-black',
}

export default function EventCard({ event, onDeleted, userClubIds = [] }: Props) {
  const { profile } = useAuth()
  // Admin can delete any event; club_members can delete events of their own clubs
  const isClubMemberOfEventClub =
    profile?.role === 'club_member' && event.club_id !== null && userClubIds.includes(event.club_id)
  const canDelete = profile?.role === 'admin' || isClubMemberOfEventClub

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) toast.error('Failed to delete event')
    else { toast.success('Event deleted'); onDeleted?.() }
  }

  const categoryColor = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.General

  return (
    <Link to={`/events/${event.id}`} className="group block">
      <div className="card overflow-hidden p-0 transition-all duration-200">
        {/* Cover image */}
        <div className="comic-burst relative h-40 overflow-hidden">
          {event.cover_image ? (
            <img src={event.cover_image} alt={event.title}
              className="h-full w-full object-cover saturate-125 transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <Image size={34} className="mx-auto mb-1 text-college-black" />
                <p className="text-xs font-black uppercase text-college-black">No cover image</p>
              </div>
            </div>
          )}
          {/* Visibility badge */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1 rounded-full border-2 border-college-black px-2 py-0.5 text-xs font-black uppercase shadow-[2px_2px_0_#0A0A0C] ${
              event.is_public ? 'bg-college-teal text-college-black' : 'bg-college-fuchsia text-white'
            }`}>
              {event.is_public ? <Globe size={10} /> : <Lock size={10} />}
              {event.is_public ? 'Public' : 'Private'}
            </span>
          </div>
          {/* Delete button */}
          {canDelete && (
            <button onClick={handleDelete}
              className="absolute right-3 top-3 rounded-lg border-2 border-college-black bg-college-orange p-1.5 text-white opacity-0 shadow-[2px_2px_0_#0A0A0C] transition-opacity hover:bg-college-fuchsia group-hover:opacity-100"
              title="Delete event">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="line-clamp-2 text-sm font-black uppercase leading-snug text-college-black transition-colors group-hover:text-college-fuchsia">
              {event.title}
            </h3>
            <span className={`badge shrink-0 text-xs ${categoryColor}`}>{event.category}</span>
          </div>

          {event.description && (
            <p className="mb-3 line-clamp-2 text-xs font-semibold text-black/55">{event.description}</p>
          )}

          <div className="mt-auto flex items-center justify-between text-xs font-bold text-black/50">
            <div className="flex items-center gap-1">
              <Calendar size={11} />
              <span>{format(new Date(event.date), 'dd MMM yyyy')}</span>
            </div>
            <div className="flex items-center gap-3">
              {event.clubs?.name && (
                <span className="badge-amber text-xs">{event.clubs.name}</span>
              )}
              {event.media_count !== undefined && (
                <span className="flex items-center gap-1">
                  <Image size={11} />
                  {event.media_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
