import { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, Trash2, RefreshCw, ShieldCheck, Users, Camera, Crown, Search, ChevronDown, CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import type { Profile } from '../types'

type RoleCode = {
  id: string
  role: string
  code: string
  is_active: boolean
  max_uses: number | null
  use_count: number
  expires_at: string | null
  created_at: string
}

type Tab = 'clubs' | 'codes' | 'users' | 'requests'

type PhotographerRequest = {
  id: string
  status: string
  message: string | null
  created_at: string
  photographer_id: string
  club_id: string
  profiles: { full_name: string; email: string } | null
  clubs: { name: string } | null
}

const roleConfig = {
  club_member:  { label: 'Club Member',  icon: Users,  color: 'bg-pink-100 text-pink-800'  },
  photographer: { label: 'Photographer', icon: Camera, color: 'bg-green-100 text-green-700' },
  admin:        { label: 'Admin',        icon: Crown,  color: 'bg-red-100 text-red-700'     },
}

const allRoles = ['viewer', 'club_member', 'photographer', 'admin'] as const

function generateCode(role: string, clubSlug?: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  if (role === 'club_member' && clubSlug) {
    const slug = clubSlug.toUpperCase().replace(/-/g, '').slice(0, 6)
    return `MEM-${slug}-${rand}`
  }
  const prefix = role === 'admin' ? 'ADM' : 'PHO'
  return `${prefix}-${rand}`
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin:        'bg-red-100 text-red-700',
    photographer: 'bg-green-100 text-green-700',
    club_member:  'bg-pink-100 text-pink-800',
    viewer:       'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`badge capitalize ${map[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role.replace('_', ' ')}
    </span>
  )
}

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'clubs')

  // clubs state
  const [clubs, setClubs]             = useState<{id:string; name:string; slug:string; description:string|null; is_active:boolean; created_at:string}[]>([])
  const [clubsLoading, setClubsLoading] = useState(false)
  const [newClubName, setNewClubName] = useState('')
  const [newClubDesc, setNewClubDesc] = useState('')
  const [creatingClub, setCreatingClub] = useState(false)

  // selected club for code generation
  const [selectedClubId, setSelectedClubId] = useState<string>('')

  // codes state
  const [codes, setCodes]     = useState<RoleCode[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [creating, setCreating]         = useState(false)
  const [newRole, setNewRole]     = useState<'club_member' | 'photographer' | 'admin'>('club_member')
  const [maxUses, setMaxUses]     = useState('1')
  const [unlimited, setUnlimited] = useState(false)
  const [expiryDays, setExpiryDays] = useState('7')
  const [noExpiry, setNoExpiry]   = useState(false)

  // photographer requests state
  const [requests, setRequests] = useState<PhotographerRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  // users state
  const [users, setUsers]           = useState<Profile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [search, setSearch]         = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Access denied')
      navigate('/dashboard')
    }
  }, [profile, navigate])

  const fetchCodes = useCallback(async () => {
    setCodesLoading(true)
    const { data, error } = await supabase
      .from('role_codes')
      .select('*')
      .neq('code', 'ADMIN2024')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load codes')
    else setCodes(data ?? [])
    setCodesLoading(false)
  }, [])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load users')
    else setUsers(data ?? [])
    setUsersLoading(false)
  }, [])

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true)

    // Step 1: fetch requests + clubs (clubs FK is reliable)
    const { data: rows, error } = await supabase
      .from('photographer_requests')
      .select('*, clubs(name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[AdminPage] photographer_requests error:', error)
      toast.error('Failed to load requests')
      setRequestsLoading(false)
      return
    }

    // Step 2: enrich each row with profile data via a separate query
    // (avoids FK join issues when photographer_id → auth.users not profiles)
    const withProfiles = await Promise.all(
      (rows ?? []).map(async (req: any) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', req.photographer_id)
          .maybeSingle()
        return { ...req, profiles: prof ?? null }
      })
    )

    setRequests(withProfiles as PhotographerRequest[])
    setRequestsLoading(false)
  }, [])

  async function handleRequest(id: string, status: 'approved' | 'rejected', photographerId: string, clubId: string) {
    const { error } = await supabase
      .from('photographer_requests')
      .update({ status })
      .eq('id', id)
    if (error) {
      console.error('[handleRequest] update error:', error)
      toast.error(`Update failed: ${error.message}`)
      return
    }
    if (status === 'approved') {
      // Add photographer to club_memberships
      await supabase.from('club_memberships').upsert({
        user_id: photographerId, club_id: clubId
      }, { onConflict: 'user_id,club_id' })
      toast.success('Request approved — photographer added to club')
    } else {
      toast.success('Request rejected')
    }
    fetchRequests()
  }

  const fetchClubs = useCallback(async () => {
    setClubsLoading(true)
    const { data } = await supabase.from('clubs').select('*').order('created_at', { ascending: false })
    setClubs(data ?? [])
    setClubsLoading(false)
  }, [])

  async function handleCreateClub() {
    if (!newClubName.trim()) { toast.error('Enter a club name'); return }
    setCreatingClub(true)
    const slug = newClubName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { error } = await supabase.from('clubs').insert({
      name: newClubName.trim(),
      slug,
      description: newClubDesc.trim() || null,
      created_by: profile!.id,
    })
    if (error) toast.error(error.message)
    else { toast.success(`Club "${newClubName}" created`); setNewClubName(''); setNewClubDesc(''); fetchClubs() }
    setCreatingClub(false)
  }

  useEffect(() => { fetchCodes() }, [fetchCodes])
  useEffect(() => { if (tab === 'users') fetchUsers() }, [tab, fetchUsers])
  useEffect(() => { if (tab === 'clubs' || tab === 'codes') fetchClubs() }, [tab, fetchClubs])
  useEffect(() => { if (tab === 'requests') fetchRequests() }, [tab, fetchRequests])

  async function handleCreate() {
    if (newRole === 'club_member' && !selectedClubId) {
      toast.error('Select a club for this member code')
      return
    }
    setCreating(true)
    const club = clubs.find(c => c.id === selectedClubId)
    const code = generateCode(newRole, club?.slug)
    const expires_at = noExpiry ? null : new Date(Date.now() + parseInt(expiryDays) * 86400000).toISOString()
    const { error } = await supabase.from('role_codes').insert({
      role: newRole,
      code,
      is_active: true,
      max_uses: unlimited ? null : parseInt(maxUses),
      use_count: 0,
      expires_at,
      club_id: newRole === 'club_member' ? selectedClubId : null,
    })
    if (error) toast.error('Failed to create code')
    else { toast.success(`Code ${code} created`); fetchCodes() }
    setCreating(false)
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from('role_codes').update({ is_active: !current }).eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success(current ? 'Deactivated' : 'Activated'); fetchCodes() }
  }

  async function deleteCode(id: string) {
    const { error } = await supabase.from('role_codes').delete().eq('id', id)
    if (error) toast.error('Delete failed')
    else { toast.success('Code deleted'); fetchCodes() }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success('Copied!')
  }

  async function changeUserRole(userId: string, newUserRole: string) {
    if (userId === profile?.id && newUserRole !== 'admin') {
      toast.error("You can't demote yourself")
      return
    }
    setUpdatingId(userId)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newUserRole, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) toast.error('Failed to update role')
    else {
      toast.success('Role updated')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newUserRole as Profile['role'] } : u))
    }
    setUpdatingId(null)
  }

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:  codes.length,
    active: codes.filter(c => c.is_active).length,
    used:   codes.reduce((s, c) => s + c.use_count, 0),
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-college-navy flex items-center justify-center">
          <ShieldCheck size={20} className="text-college-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-college-navy">Admin Panel</h1>
          <p className="text-gray-500 text-sm">Manage access codes and user roles</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8 flex-wrap">
        {(['clubs', 'codes', 'users', 'requests'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white text-college-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'clubs' ? 'Clubs' : t === 'codes' ? 'Access Codes' : t === 'users' ? 'User Management' : 'Photographer Requests'}
          </button>
        ))}
      </div>

      {/* CLUBS TAB */}
      {tab === 'clubs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create club form */}
          <div className="card h-fit">
            <h2 className="font-semibold text-college-navy mb-4 flex items-center gap-2">
              <Plus size={16} className="text-college-amber" /> Create New Club
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label">Club Name</label>
                <input type="text" className="input" placeholder="e.g. NSCC, GDSC, Rotaract"
                  value={newClubName} onChange={e => setNewClubName(e.target.value)} />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea className="input resize-none" rows={3} placeholder="What does this club do?"
                  value={newClubDesc} onChange={e => setNewClubDesc(e.target.value)} />
              </div>
              <button onClick={handleCreateClub} disabled={creatingClub} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={15} />
                {creatingClub ? 'Creating...' : 'Create Club'}
              </button>
            </div>
          </div>

          {/* Clubs list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-college-navy">{clubs.length} Club{clubs.length !== 1 ? 's' : ''}</h2>
              <button onClick={fetchClubs} className="text-gray-400 hover:text-college-amber p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>
            {clubsLoading ? (
              <div className="card flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-amber-200 border-t-college-amber rounded-full animate-spin" />
              </div>
            ) : clubs.length === 0 ? (
              <div className="card text-center py-12 text-gray-400 text-sm">
                No clubs yet. Create your first one.
              </div>
            ) : (
              <div className="space-y-2">
                {clubs.map(club => (
                  <div key={club.id} className="card py-3 px-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-college-navy flex items-center justify-center shrink-0">
                      <span className="text-college-gold font-bold text-xs">
                        {club.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-college-navy text-sm">{club.name}</p>
                      <p className="text-xs text-gray-400">{club.description ?? 'No description'} · <span className="font-mono">/{club.slug}</span></p>
                    </div>
                    <span className={`badge ${club.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {club.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACCESS CODES TAB */}
      {tab === 'codes' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Codes', value: stats.total },
              { label: 'Active',      value: stats.active },
              { label: 'Total Uses',  value: stats.used },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className="text-3xl font-bold text-college-navy">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generate form */}
            <div className="card h-fit">
              <h2 className="font-semibold text-college-navy mb-4 flex items-center gap-2">
                <Plus size={16} className="text-college-amber" /> Generate Code
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Role</label>
                  <div className="space-y-2">
                    {(['club_member', 'photographer', 'admin'] as const).map(val => {
                      const cfg = roleConfig[val]
                      const Icon = cfg.icon
                      return (
                        <button key={val} type="button" onClick={() => setNewRole(val)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                            newRole === val ? 'border-college-amber bg-amber-50' : 'border-gray-200 hover:border-amber-200'
                          }`}
                        >
                          <span className={`p-1.5 rounded-md ${cfg.color}`}><Icon size={13} /></span>
                          <span className="font-medium text-gray-700">{cfg.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Club selector — only for member codes */}
                {newRole === 'club_member' && (
                  <div>
                    <label className="label">Select Club</label>
                    <div className="relative">
                      <select
                        className="input appearance-none pr-7 text-sm"
                        value={selectedClubId}
                        onChange={e => setSelectedClubId(e.target.value)}
                      >
                        <option value="">-- Select a club --</option>
                        {clubs.filter(c => c.is_active).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {clubs.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">No clubs yet. Create one in the Clubs tab first.</p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Max uses</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="accent-college-amber" />
                      Unlimited
                    </label>
                  </div>
                  <input type="number" min={1} className="input" value={maxUses}
                    onChange={e => setMaxUses(e.target.value)} disabled={unlimited} placeholder="e.g. 1" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Expires in (days)</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} className="accent-college-amber" />
                      No expiry
                    </label>
                  </div>
                  <input type="number" min={1} className="input" value={expiryDays}
                    onChange={e => setExpiryDays(e.target.value)} disabled={noExpiry} placeholder="e.g. 7" />
                </div>

                <button onClick={handleCreate} disabled={creating} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Plus size={15} />
                  {creating ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </div>

            {/* Codes list */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-college-navy">Generated Codes</h2>
                <button onClick={fetchCodes} className="text-gray-400 hover:text-college-amber p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                  <RefreshCw size={15} />
                </button>
              </div>

              {codesLoading ? (
                <div className="card flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-amber-200 border-t-college-amber rounded-full animate-spin" />
                </div>
              ) : codes.length === 0 ? (
                <div className="card text-center py-12 text-gray-400 text-sm">
                  No codes yet. Generate one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {codes.map(c => {
                    const cfg = roleConfig[c.role as keyof typeof roleConfig]
                    const Icon = cfg?.icon ?? Users
                    const isExpired = c.expires_at ? new Date(c.expires_at) < new Date() : false
                    const isFull    = c.max_uses !== null && c.use_count >= c.max_uses
                    const inactive  = !c.is_active || isExpired || isFull

                    return (
                      <div key={c.id} className={`card py-3 px-4 flex items-center gap-3 ${inactive ? 'opacity-50' : ''}`}>
                        <span className={`p-2 rounded-lg ${cfg?.color ?? 'bg-gray-100 text-gray-500'} shrink-0`}>
                          <Icon size={14} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-college-navy text-sm tracking-wider">{c.code}</span>
                            {!c.is_active && <span className="badge bg-gray-100 text-gray-500">Inactive</span>}
                            {isExpired    && <span className="badge bg-red-100 text-red-600">Expired</span>}
                            {isFull       && <span className="badge bg-orange-100 text-orange-600">Used up</span>}
                            {!inactive    && <span className="badge bg-green-100 text-green-600">Active</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {cfg?.label} · Used {c.use_count}/{c.max_uses ?? '∞'}
                            {c.expires_at && ` · Expires ${format(new Date(c.expires_at), 'dd MMM yyyy')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => copyCode(c.code)} title="Copy"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-college-amber hover:bg-amber-50 transition-colors">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => toggleActive(c.id, c.is_active)} title="Toggle"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-college-navy hover:bg-gray-100 transition-colors">
                            <ShieldCheck size={14} />
                          </button>
                          <button onClick={() => deleteCode(c.id)} title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* USER MANAGEMENT TAB */}
      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={fetchUsers} className="text-gray-400 hover:text-college-amber p-2 rounded-lg hover:bg-amber-50 transition-colors">
              <RefreshCw size={15} />
            </button>
            <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-amber-200 border-t-college-amber rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Role</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-college-amber/20 flex items-center justify-center text-college-amber font-semibold text-xs shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{u.full_name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3 px-2 text-gray-500 text-xs">
                        {format(new Date(u.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-2">
                        <div className="relative w-36">
                          <select
                            value={u.role}
                            disabled={updatingId === u.id}
                            onChange={e => changeUserRole(u.id, e.target.value)}
                            className="w-full appearance-none input py-1.5 pr-7 text-xs cursor-pointer"
                          >
                            {allRoles.map(r => (
                              <option key={r} value={r}>{r.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-10">No users found.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* PHOTOGRAPHER REQUESTS TAB */}
      {tab === 'requests' && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-college-navy">Photographer Access Requests</h2>
              <p className="text-gray-400 text-sm mt-0.5">Approve or reject photographers requesting club access</p>
            </div>
            <button onClick={fetchRequests} className="text-gray-400 hover:text-college-amber p-2 rounded-lg hover:bg-amber-50 transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-amber-200 border-t-college-amber rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <Camera size={36} className="text-amber-200 mx-auto mb-3" />
              <p className="text-college-navy font-semibold">No requests yet</p>
              <p className="text-gray-400 text-sm mt-1">Photographer access requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-amber-200 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Camera size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{req.profiles?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{req.profiles?.email}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requesting access to <span className="font-medium text-college-navy">{req.clubs?.name}</span>
                    </p>
                    <p className="text-xs text-gray-400">{format(new Date(req.created_at), 'dd MMM yyyy, h:mm a')}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleRequest(req.id, 'approved', req.photographer_id, req.club_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleRequest(req.id, 'rejected', req.photographer_id, req.club_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium ${
                        req.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {req.status === 'approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {req.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
