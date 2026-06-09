import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Calendar, Camera, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import EventCard from '../components/EventCard'
import toast from 'react-hot-toast'

type Club = {
  id: string; name: string; slug: string
  description: string | null; logo_url: string | null; created_at: string
}

type EventRow = {
  id: string; title: string; description: string | null
  category: string; date: string; cover_image: string | null
  is_public: boolean; created_by: string; club_id: string | null
  clubs: { name: string } | null
  profiles: { full_name: string } | null
  media_count: number
}

type Member = {
  id: string; full_name: string; role: string; avatar_url: string | null
}

export default function ClubDetailPage() {
  const { slug }  = useParams<{ slug: string }>()
  const { profile } = useAuth()
  const navigate  = useNavigate()

  const [club, setClub]       = useState<Club | null>(null)
  const [events, setEvents]   = useState<EventRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'events' | 'members'>('events')
  const [isMember, setIsMember]   = useState(false)
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
  const [sendingRequest, setSendingRequest] = useState(false)

  const fetchClub = useCallback(async () => {
    const { data, error } = await supabase
      .from('clubs').select('*').eq('slug', slug).single()
    if (error || !data) { navigate('/clubs'); return }
    setClub(data)
    return data
  }, [slug, navigate])

  const fetchEvents = useCallback(async (clubId: string) => {
    let query = supabase
      .from('events')
      .select('*, clubs(name), profiles(full_name)')
      .eq('club_id', clubId)
      .order('date', { ascending: false })

    if (profile?.role === 'viewer') {
      query = query.eq('is_public', true)
    } else if (profile?.role === 'club_member') {
      if (!isMember) query = query.eq('is_public', true)
    }

    const { data } = await query
    const withCounts = await Promise.all((data ?? []).map(async ev => {
      const { count } = await supabase
        .from('media').select('id', { count: 'exact', head: true }).eq('event_id', ev.id)
      return { ...ev, media_count: count ?? 0 }
    }))
    setEvents(withCounts as EventRow[])
  }, [profile, isMember])

  const fetchMembers = useCallback(async (clubId: string) => {
    const { data } = await supabase
      .from('club_memberships')
      .select('profiles(id, full_name, role, avatar_url)')
      .eq('club_id', clubId)
    const list = (data ?? []).map((d: any) => d.profiles).filter(Boolean)
    setMembers(list)
  }, [])

  const checkMembership = useCallback(async (clubId: string) => {
    if (!profile) return
    const { data } = await supabase
      .from('club_memberships')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', profile.id)
      .single()
    setIsMember(!!data)
  }, [profile])

  const checkPhotographerRequest = useCallback(async (clubId: string) => {
    if (!profile || profile.role !== 'photographer') return
    const { data } = await supabase
      .from('photographer_requests')
      .select('status')
      .eq('club_id', clubId)
      .eq('photographer_id', profile.id)
      .single()
    if (data) setRequestStatus(data.status as any)
  }, [profile])

  async function handleRequestAccess() {
    if (!club || !profile) return
    setSendingRequest(true)
    const { error } = await supabase.from('photographer_requests').insert({
      photographer_id: profile.id,
      club_id: club.id,
      status: 'pending',
    })
    if (error) {
      if (error.code === '23505') toast.error('You already sent a request to this club')
      else toast.error(error.message)
    } else {
      setRequestStatus('pending')
      toast.success('Request sent! The admin will review it.')

      // Notify all admins about the new request
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
      if (admins && admins.length > 0) {
        const rows = admins.map((a: { id: string }) => ({
          user_id:  a.id,
          type:     'photographer_request',
          message:  `${profile.full_name} has requested photographer access for ${club.name}`,
          link:     '/admin?tab=requests',
          is_read:  false,
        }))
        await supabase.from('notifications').insert(rows)
      }
    }
    setSendingRequest(false)
  }

  useEffect(() => {
    async function init() {
      const clubData = await fetchClub()
      if (!clubData) return
      await checkMembership(clubData.id)
      await checkPhotographerRequest(clubData.id)
      await Promise.all([fetchEvents(clubData.id), fetchMembers(clubData.id)])
      setLoading(false)
    }
    init()
  }, [fetchClub, checkMembership, checkPhotographerRequest, fetchEvents, fetchMembers])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-4">
        <div className="h-36 bg-gray-200 rounded-2xl" />
        <div className="h-6 bg-gray-200 rounded w-1/4" />
      </div>
    )
  }

  if (!club) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/clubs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-college-amber mb-5 transition-colors">
        <ArrowLeft size={15} /> All Clubs
      </Link>

      {/* Club hero */}
      <div className="card mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-college-navy flex items-center justify-center shrink-0">
          {club.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <span className="text-college-gold font-bold text-xl">{club.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-college-navy">{club.name}</h1>
            {isMember && <span className="badge-amber text-xs">Member</span>}
            {profile?.role === 'admin' && <span className="badge bg-red-100 text-red-700 text-xs">Admin</span>}
          </div>
          <p className="text-gray-500 text-sm mt-1">{club.description ?? 'No description provided.'}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Users size={11} /> {members.length} members</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> {events.length} events</span>
            <span>Est. {format(new Date(club.created_at), 'MMM yyyy')}</span>
          </div>
        </div>
        {profile?.role === 'photographer' && (
          <div className="shrink-0">
            {requestStatus === 'none' && (
              <button onClick={handleRequestAccess} disabled={sendingRequest}
                className="btn-primary flex items-center gap-2 text-sm">
                <Camera size={14} /> {sendingRequest ? 'Sending...' : 'Request Access'}
              </button>
            )}
            {requestStatus === 'pending' && (
              <span className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Request Pending
              </span>
            )}
            {requestStatus === 'approved' && (
              <span className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <CheckCircle size={14} /> Access Approved
              </span>
            )}
            {requestStatus === 'rejected' && (
              <span className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                Request Rejected
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['events', 'members'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === t ? 'bg-white text-college-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t} {t === 'events' ? `(${events.length})` : `(${members.length})`}
          </button>
        ))}
      </div>

      {/* Events tab */}
      {activeTab === 'events' && (
        events.length === 0 ? (
          <div className="card text-center py-16">
            <Calendar size={40} className="text-amber-200 mx-auto mb-3" />
            <p className="text-college-navy font-semibold">No events yet</p>
            <p className="text-gray-400 text-sm mt-1">This club hasn't hosted any events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {events.map(event => (
              <EventCard key={event.id} event={event} onDeleted={() => fetchEvents(club.id)} userClubIds={isMember ? [club.id] : []} />
            ))}
          </div>
        )
      )}

      {/* Members tab */}
      {activeTab === 'members' && (
        members.length === 0 ? (
          <div className="card text-center py-16">
            <Users size={40} className="text-amber-200 mx-auto mb-3" />
            <p className="text-college-navy font-semibold">No members yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="card flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-full bg-college-amber/20 flex items-center justify-center shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-college-amber font-semibold text-sm">{m.full_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-college-navy text-sm">{m.full_name}</p>
                  <span className={`badge text-xs capitalize ${
                    m.role === 'photographer' ? 'bg-green-100 text-green-700' :
                    m.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-pink-100 text-pink-800'
                  }`}>{m.role.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
