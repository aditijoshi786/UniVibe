-- ============================================
-- CIG Platform - Full Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'photographer', 'club_member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('photo', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  full_name   text NOT NULL,
  avatar_url  text,
  role        user_role NOT NULL DEFAULT 'viewer',
  club_name   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 3. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'general',
  date        timestamptz NOT NULL,
  cover_image text,
  is_public   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. ALBUMS TABLE
CREATE TABLE IF NOT EXISTS public.albums (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  cover_image text,
  is_public   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

-- 5. MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id      uuid REFERENCES public.albums(id) ON DELETE SET NULL,
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  url           text NOT NULL,
  thumbnail_url text,
  type          media_type NOT NULL DEFAULT 'photo',
  title         text,
  tags          text[] DEFAULT '{}',
  uploaded_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public     boolean NOT NULL DEFAULT true,
  like_count    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 6. LIKES TABLE
CREATE TABLE IF NOT EXISTS public.likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(media_id, user_id)
);

-- 7. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. FAVOURITES TABLE
CREATE TABLE IF NOT EXISTS public.favourites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(media_id, user_id)
);

-- 9. USER TAGS TABLE
CREATE TABLE IF NOT EXISTS public.user_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  tagger_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tagged_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text NOT NULL,
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz DEFAULT now()
);

-- 11. PHOTOGRAPHER REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.photographer_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id      uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message      text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(photographer_id, club_id)
);

ALTER TABLE public.photographer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photographers see own requests" ON public.photographer_requests FOR SELECT USING (photographer_id = auth.uid());
CREATE POLICY "Admins see all requests" ON public.photographer_requests FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "Photographers insert own requests" ON public.photographer_requests FOR INSERT WITH CHECK (photographer_id = auth.uid());
CREATE POLICY "Admins update requests" ON public.photographer_requests FOR UPDATE USING (public.get_my_role() = 'admin');

-- 12. ROLE CODES TABLE
CREATE TABLE IF NOT EXISTS public.role_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL,
  code       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.role_codes (role, code) VALUES
  ('admin',        'ADMIN2024'),
  ('photographer', 'PHOTO2024'),
  ('club_member',  'CIG2024')
ON CONFLICT (code) DO NOTHING;

-- 12. AUTO-CREATE PROFILE TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer'),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. ROW LEVEL SECURITY
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_codes    ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events policies
CREATE POLICY "events_select_public"  ON public.events FOR SELECT USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "events_insert"         ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "events_update"         ON public.events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "events_delete"         ON public.events FOR DELETE USING (auth.uid() = created_by);

-- Albums policies
CREATE POLICY "albums_select" ON public.albums FOR SELECT USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "albums_insert" ON public.albums FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "albums_update" ON public.albums FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "albums_delete" ON public.albums FOR DELETE USING (auth.uid() = created_by);

-- Media policies
CREATE POLICY "media_select" ON public.media FOR SELECT USING (is_public = true OR auth.uid() = uploaded_by);
CREATE POLICY "media_insert" ON public.media FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "media_delete" ON public.media FOR DELETE USING (auth.uid() = uploaded_by);

-- Likes, comments, favourites, tags — authenticated users only
CREATE POLICY "likes_all"      ON public.likes      FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "comments_all"   ON public.comments   FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "favourites_all" ON public.favourites FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "user_tags_all"  ON public.user_tags  FOR ALL USING (auth.uid() IS NOT NULL);

-- Notifications — own only
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);

-- Role codes — anyone can read (needed for signup validation)
CREATE POLICY "role_codes_select" ON public.role_codes FOR SELECT USING (true);
