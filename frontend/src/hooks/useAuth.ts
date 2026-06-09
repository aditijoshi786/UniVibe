import { useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existing) {
      setProfile(existing)
      setLoading(false)
      return
    }

    // Profile missing — create it from auth user data
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const role = (user.user_metadata?.role ?? 'viewer') as string
      const full_name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, email: user.email!, full_name, role })
        .select()
        .single()
      setProfile(created)
    }
    setLoading(false)
  }

  async function signUp(email: string, password: string, fullName: string, role: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    return { data: data ?? null, error }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, profile, session, loading, signUp, signIn, signOut }
}
