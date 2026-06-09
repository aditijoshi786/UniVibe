export type UserRole = 'admin' | 'photographer' | 'club_member' | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  club_name: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  category: string
  date: string
  cover_image: string | null
  is_public: boolean
  created_by: string
  created_at: string
  profiles?: Profile
  _count?: { media: number }
}

export interface Album {
  id: string
  event_id: string
  title: string
  description: string | null
  is_public: boolean
  created_by: string
  created_at: string
}

export interface Media {
  id: string
  album_id: string
  event_id: string
  url: string
  thumbnail_url: string | null
  type: 'photo' | 'video'
  title: string | null
  tags: string[]
  uploaded_by: string
  is_public: boolean
  like_count: number
  created_at: string
  profiles?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: 'like' | 'comment' | 'tag' | 'upload'
  message: string
  is_read: boolean
  link: string | null
  created_at: string
}
