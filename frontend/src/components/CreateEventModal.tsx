import { useState } from 'react'
import { X, Calendar, Lock, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMyClubs } from '../hooks/useClubs'
import toast from 'react-hot-toast'

const CATEGORIES = ['General', 'Workshop', 'Competition', 'Cultural Fest', 'Trip', 'Photoshoot', 'Party', 'Seminar', 'Sports']

type Props = {
  onClose: () => void
  onCreated: () => void
}

export default function CreateEventModal({ onClose, onCreated }: Props) {
  const { profile } = useAuth()
  const { clubs } = useMyClubs()

  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [category, setCategory]   = useState('General')
  const [date, setDate]           = useState('')
  const [clubId, setClubId]       = useState('')
  const [isPublic, setIsPublic]   = useState(true)
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clubId) { toast.error('Select a club for this event'); return }
    if (!date)   { toast.error('Select an event date'); return }

    setLoading(true)
    const { error } = await supabase.from('events').insert({
      title:       title.trim(),
      description: description.trim() || null,
      category,
      date:        new Date(date).toISOString(),
      club_id:     clubId,
      is_public:   isPublic,
      created_by:  profile!.id,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Event created!')
      onCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-display font-bold text-college-navy">Create New Event</h2>
            <p className="text-gray-400 text-xs mt-0.5">Fill in the details for your event</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Club selector */}
          <div>
            <label className="label">Club</label>
            <select className="input" value={clubId} onChange={e => setClubId(e.target.value)} required>
              <option value="">Select club...</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {clubs.length === 0 && (
              <p className="text-xs text-red-400 mt-1">
                {profile?.role === 'club_member' ? "You're not a member of any club yet." : 'No clubs created yet.'}
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="label">Event Title</label>
            <input type="text" className="input" placeholder="e.g. Annual Photography Walk"
              value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={3}
              placeholder="What's this event about?"
              value={description} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Category + Date side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <div className="relative">
                <input type="date" className="input pr-9"
                  value={date} onChange={e => setDate(e.target.value)} required />
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Visibility toggle */}
          <div>
            <label className="label">Visibility</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  isPublic ? 'border-college-amber bg-amber-50 text-college-navy' : 'border-gray-200 text-gray-500 hover:border-amber-200'
                }`}>
                <Globe size={15} className={isPublic ? 'text-college-amber' : 'text-gray-400'} />
                Public
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  !isPublic ? 'border-college-crimson bg-rose-50 text-college-crimson' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <Lock size={15} className={!isPublic ? 'text-college-crimson' : 'text-gray-400'} />
                Private
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isPublic ? 'Visible to everyone including viewers.' : 'Visible to club members only.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
