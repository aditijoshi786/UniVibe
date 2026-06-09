import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type Club = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
}

export function useMyClubs() {
  const { profile } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchMyClubs()
  }, [profile])

  async function fetchMyClubs() {
    setLoading(true)
    if (profile?.role === 'admin') {
      const { data } = await supabase.from('clubs').select('*').eq('is_active', true).order('name')
      setClubs(data ?? [])
    } else if (profile?.role === 'club_member') {
      const { data } = await supabase
        .from('club_memberships')
        .select('clubs(*)')
        .eq('user_id', profile.id)
      const list = (data ?? []).map((d: any) => d.clubs).filter(Boolean)
      setClubs(list)
    } else {
      setClubs([])
    }
    setLoading(false)
  }

  return { clubs, loading }
}

export function useAllClubs() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('clubs').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { setClubs(data ?? []); setLoading(false) })
  }, [])

  return { clubs, loading }
}
