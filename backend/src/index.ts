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

app.use(cors({ origin: '*' }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'UniVibe API running' })
})

// Platform-wide stats — used by AdminPage
app.get('/api/stats', async (_req, res) => {
  try {
    const [events, media, clubs, users] = await Promise.all([
      supabase.from('events').select('id',    { count: 'exact', head: true }),
      supabase.from('media').select('id',     { count: 'exact', head: true }),
      supabase.from('clubs').select('id',     { count: 'exact', head: true }),
      supabase.from('profiles').select('id',  { count: 'exact', head: true }),
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

app.listen(PORT, () => {
  console.log(`UniVibe API running on http://localhost:${PORT}`)
})

export default app
