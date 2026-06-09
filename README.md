# UniVibe — College Event & Media Platform

> A full-stack web platform for college clubs to manage events, upload media, and let students discover campus moments through AI-powered search and face recognition.

**Live Demo:** https://main.d2pj7l36yjafw8.amplifyapp.com  
**Backend API:** https://univibe-d28d.onrender.com/api/health

---

## Overview

UniVibe is a college event and media management platform built for campus clubs. It allows clubs to create events, upload photos and videos, and lets students find their own photos using AI-powered face recognition — all without any paid AI API calls, since all processing runs directly in the browser.

---

## Features

### Auth & Roles
- Email/password registration and login via Supabase Auth
- Four role tiers: **Viewer → Club Member → Photographer → Admin**
- Role upgrades via admin-generated invite codes (with expiry and max-use limits)

### Events & Albums
- Create and manage events with title, date, venue, category, cover image, public/private toggle
- Albums inside events to group media uploads
- Edit and delete events (admin or creator only)

### Media Upload & Management
- Drag-and-drop multi-file upload (images + videos, up to 20MB each)
- Client-side image compression before upload
- **AI auto-tagging** using Transformers.js + CLIP — runs entirely in the browser, no API cost
- Manual caption input; captions editable later by admin/club members
- Files stored on AWS S3 via presigned PUT URLs (direct browser-to-S3, no proxy)

### Media Browsing
- Responsive grid view and list view toggle
- Infinite scroll (IntersectionObserver, 20 items per page)
- Like/unlike with optimistic UI and realtime sync across all users (Supabase WebSockets)
- **Download with watermark** — branded bar applied via Canvas API on download; original file untouched

### Face Search ("Find Me")
- Upload a selfie → AI scans all event photos for matching faces
- Uses face-api.js (TinyFaceDetector + FaceRecognitionNet) — fully in-browser, no server
- Shows confidence percentage per match; click to jump directly to the photo in its album

### Search
- Search events and photos by name, tag, or keyword
- Filter by date range, uploader, and AI-generated tags
- Events search also surfaces results via photo names and tag matches

### Clubs
- Browse all clubs; club detail page shows events and members
- Photographers can request club access; admin approves/rejects

### Notifications
- Realtime push notifications via Supabase WebSockets
- Bell icon with unread count; mark individual or all as read

### Favourites
- Save any photo to a personal favourites collection
- View in grid or list layout

### Admin Panel
- Platform stats (Total Events, Media, Clubs, Users) fetched from Express backend
- Create clubs, generate role invite codes, manage all users and roles
- Approve or reject photographer access requests

### QR Codes
- QR code generated per event/album for easy sharing
- Download as PNG or copy link

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router DOM v6 |
| Backend API | Express.js, Node.js, TypeScript |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password + JWT) |
| Realtime | Supabase WebSockets (postgres_changes) |
| Storage | AWS S3 (presigned PUT URLs) |
| AI Tagging | Transformers.js + CLIP (in-browser WASM) |
| Face Recognition | face-api.js (TinyFaceDetector, in-browser) |
| Watermarking | Canvas API (client-side) |
| QR Codes | qrcode.react |
| Frontend Hosting | AWS Amplify (CI/CD from GitHub) |
| Backend Hosting | Render.com (Node.js web service) |

---

## Architecture

```
GitHub (main branch)
    │
    ├── CI/CD ──► AWS Amplify (Frontend)
    │                React SPA served via CDN
    │                │
    │                ├──► Supabase (Auth + DB + Realtime)
    │                │    PostgreSQL + RLS + WebSockets
    │                │
    │                ├──► AWS S3 (Media Storage)
    │                │    Direct upload via presigned PUT URL
    │                │
    │                └──► Render.com (Express API)
    │                     GET /api/stats → Supabase DB
    │
    └── CI/CD ──► Render.com (Backend)
```

**In-browser processing (no server required):**
- Transformers.js + CLIP → AI photo tagging
- face-api.js → facial recognition / Find Me
- Canvas API → download watermarking
- Client-side compression → before S3 upload

---

## Prerequisites

- Node.js v18+
- npm v9+
- A [Supabase](https://supabase.com) project
- An [AWS](https://aws.amazon.com) account with an S3 bucket

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/aditijoshi786/UniVibe.git
cd UniVibe
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

### 4. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL schema (create tables: `profiles`, `events`, `albums`, `media`, `clubs`, `club_memberships`, `likes`, `favourites`, `notifications`, `role_codes`, `photographer_requests`)
3. Enable Row Level Security on all tables
4. Create RPC functions: `increment_like_count`, `decrement_like_count`
5. Copy your **Project URL** and **anon key** from Project Settings → API

### 5. Set up AWS S3

1. Create an S3 bucket (e.g. `your-univibe-bucket`) in your preferred region
2. Enable public read or configure a bucket policy for presigned URL access
3. Create an IAM user with `s3:PutObject` and `s3:DeleteObject` permissions on that bucket
4. Generate an **Access Key ID** and **Secret Access Key** for the IAM user
5. Add a CORS rule to the bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

---

## Environment Variables

### Frontend (`frontend/.env`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

VITE_STORAGE_PROVIDER=s3
VITE_AWS_REGION=ap-south-1
VITE_AWS_BUCKET_NAME=your-bucket-name
VITE_AWS_ACCESS_KEY_ID=your-access-key-id
VITE_AWS_SECRET_ACCESS_KEY=your-secret-access-key

VITE_API_URL=http://localhost:4000
```

> Set `VITE_STORAGE_PROVIDER=supabase` to use Supabase Storage instead of S3.

### Backend (`backend/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=4000
```

---

## Running the Project

### Frontend

```bash
cd frontend
npm run dev
```

Runs at `http://localhost:5173`

### Backend

```bash
cd backend
npm run dev
```

Runs at `http://localhost:4000`

Test endpoints:
- `GET http://localhost:4000/api/health`
- `GET http://localhost:4000/api/stats`

---

## Deployment

### Frontend — AWS Amplify

1. Push the repo to GitHub
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
3. Connect your GitHub repository → select branch `main`
4. Set build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add all `VITE_*` environment variables from the table above
6. Deploy — Amplify auto-redeploys on every push to `main`

> **Important:** After changing environment variables in Amplify, trigger a fresh build (not just "Redeploy this version") so Vite bakes in the new values.

### Backend — Render.com

1. Go to [Render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. Settings:
   - Root directory: `backend`
   - Runtime: `Node`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Region: Singapore (or nearest to your users)
4. Add environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT`
5. Deploy — Render auto-redeploys on every push to `main`

> **Note:** Render free tier spins down after inactivity. The first request after idle may take ~30 seconds.

After deploying the backend, update `VITE_API_URL` in Amplify to your Render URL (no trailing slash):
```
VITE_API_URL=https://your-service.onrender.com
```

---

## Project Structure

```
UniVibe/
├── frontend/
│   ├── public/
│   │   └── models/          # face-api.js model weights
│   ├── src/
│   │   ├── components/      # MediaGrid, MediaLightbox, Navbar, etc.
│   │   ├── hooks/           # useAuth, useNotifications, useClubs
│   │   ├── lib/             # supabase.ts, storage.ts, watermark.ts, autoTagger.ts
│   │   ├── pages/           # All route pages
│   │   └── types/           # Shared TypeScript types
│   ├── .env                 # Local env vars (not committed)
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   └── index.ts         # Express app (health + stats routes)
│   └── .env                 # Local env vars (not committed)
│
└── README.md
```

