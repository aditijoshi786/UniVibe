import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT ?? 4000

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

app.use(cors({ origin: '*', credentials: true }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'UniVibe API running' })
})

// Platform-wide stats
app.get('/api/stats', async (_req, res) => {
  try {
    const [events, media, clubs, users] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('media').select('id',  { count: 'exact', head: true }),
      supabase.from('clubs').select('id',  { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    res.json({
      totalEvents: events.count ?? 0,
      totalMedia:  media.count  ?? 0,
      totalClubs:  clubs.count  ?? 0,
      totalUsers:  users.count  ?? 0,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Search across events and media
app.get('/api/search', async (req, res) => {
  const q = (req.query.q as string)?.trim()
  if (!q) return res.json({ events: [], media: [] })

  try {
    const [eventsRes, mediaRes] = await Promise.all([
      supabase.from('events').select('id, title, description, created_at')
        .ilike('title', `%${q}%`).limit(10),
      supabase.from('media').select('id, title, url, tags, created_at')
        .ilike('title', `%${q}%`).limit(20),
    ])
    res.json({
      events: eventsRes.data ?? [],
      media:  mediaRes.data  ?? [],
    })
  } catch {
    res.status(500).json({ error: 'Search failed' })
  }
})

// Get all media for an album
app.get('/api/albums/:albumId/media', async (req, res) => {
  const { albumId } = req.params
  const page  = parseInt(req.query.page  as string) || 0
  const limit = parseInt(req.query.limit as string) || 20
  const from  = page * limit
  const to    = from + limit - 1

  try {
    const { data, error } = await supabase
      .from('media')
      .select('*, profiles(full_name, avatar_url)')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    res.json({ data: data ?? [], page, limit })
  } catch {
    res.status(500).json({ error: 'Failed to fetch media' })
  }
})

// Get notifications for a user
app.get('/api/notifications/:userId', async (req, res) => {
  const { userId } = req.params
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    res.json(data ?? [])
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to update notification' })
  }
})

// Get public events with optional category filter
app.get('/api/events', async (req, res) => {
  const category = req.query.category as string | undefined
  try {
    let query = supabase
      .from('events')
      .select('*, clubs(name, logo_url)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50)

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch {
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

app.listen(PORT, () => {
  console.log(`UniVibe API running on http://localhost:${PORT}`)
})

export default app
