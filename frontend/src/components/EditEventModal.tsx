import { useState } from 'react'
import { X, Calendar, Globe, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CATEGORIES = ['General', 'Workshop', 'Competition', 'Cultural Fest', 'Trip', 'Photoshoot', 'Party', 'Seminar', 'Sports']

type Event = {
  id: string; title: string; description: string | null
  category: string; date: string; is_public: boolean
}

type Props = {
  event: Event
  onClose: () => void
  onUpdated: () => void
}

export default function EditEventModal({ event, onClose, onUpdated }: Props) {
  const [title, setTitle]       = useState(event.title)
  const [description, setDesc]  = useState(event.description ?? '')
  const [category, setCategory] = useState(event.category)
  const [date, setDate]         = useState(format(new Date(event.date), 'yyyy-MM-dd'))
  const [isPublic, setIsPublic] = useState(event.is_public)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('events').update({
      title:       title.trim(),
      description: description.trim() || null,
      category,
      date:        new Date(date).toISOString(),
      is_public:   isPublic,
      updated_at:  new Date().toISOString(),
    }).eq('id', event.id)

    if (error) toast.error(error.message)
    else { toast.success('Event updated'); onUpdated(); onClose() }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-display font-bold text-college-navy">Edit Event</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Event Title</label>
            <input type="text" className="input" value={title}
              onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={description}
              onChange={e => setDesc(e.target.value)} />
          </div>
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
                <input type="date" className="input pr-9" value={date}
                  onChange={e => setDate(e.target.value)} required />
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Visibility</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  isPublic ? 'border-college-amber bg-amber-50 text-college-navy' : 'border-gray-200 text-gray-500'
                }`}>
                <Globe size={15} className={isPublic ? 'text-college-amber' : 'text-gray-400'} /> Public
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  !isPublic ? 'border-college-crimson bg-rose-50 text-college-crimson' : 'border-gray-200 text-gray-500'
                }`}>
                <Lock size={15} className={!isPublic ? 'text-college-crimson' : 'text-gray-400'} /> Private
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
