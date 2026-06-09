import { Link } from 'react-router-dom'
import { Camera, Image, Users, Lock, Zap, Star, CalendarDays, Music, Palette, Trophy } from 'lucide-react'

const features = [
  { icon: Camera, title: 'Event Albums', desc: 'Club photos, posters, and reels organized by event.' },
  { icon: Image, title: 'Smart Tagging', desc: 'Find the exact campus moment without digging through folders.' },
  { icon: Users, title: 'Face Search', desc: 'Upload a selfie and jump straight to your photos.' },
  { icon: Lock, title: 'Club Access', desc: 'Public hype pages and private member-only memories.' },
  { icon: Zap, title: 'Live Buzz', desc: 'Notifications keep the event energy moving.' },
  { icon: Star, title: 'Favourites', desc: 'Save the photos that deserve your personal wall of fame.' },
]

const eventStickers = [
  { icon: Music, label: 'Spring Concert', color: 'bg-college-fuchsia text-white', tilt: '-rotate-3' },
  { icon: Palette, label: 'Art Gala', color: 'bg-college-teal text-college-black', tilt: 'rotate-2' },
  { icon: Trophy, label: 'CodeJam', color: 'bg-college-orange text-white', tilt: '-rotate-1' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      <section className="quirky-stage relative">
        <div className="pointer-events-none absolute -left-10 top-28 h-40 w-40 rounded-full border-[18px] border-college-fuchsia/10" />
        <div className="pointer-events-none absolute right-8 top-24 h-24 w-24 rotate-12 border-[16px] border-college-orange/10" />
        <div className="pointer-events-none absolute bottom-8 left-1/2 hidden h-32 w-32 -translate-x-1/2 rounded-[2rem] bg-college-teal/10 rotate-12 lg:block" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div>
            <span className="badge-amber mb-6 inline-flex text-sm">
              Built for college clubs and campus chaos
            </span>
            <h1 className="max-w-4xl rounded-[2rem] border-2 border-college-black bg-white/85 p-4 text-5xl font-black uppercase leading-[0.95] text-college-black shadow-pop sm:text-7xl lg:text-8xl">
              Uni<span className="text-college-fuchsia">Vibe</span>
            </h1>
            <p className="mt-5 max-w-2xl rounded-2xl border-2 border-college-black bg-white/90 p-4 text-lg font-black leading-relaxed text-college-black shadow-[5px_5px_0_#00CED1] sm:text-xl">
              A poppy event hub where clubs launch events, students find moments, and every photo feels part of the campus story.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link to="/register" className="btn-primary px-8 py-3 text-base">
                Get Started Free
              </Link>
              <Link to="/login" className="btn-secondary px-8 py-3 text-base">
                Sign In
              </Link>
            </div>
          </div>

          <div className="relative min-h-[440px]">
            <div className="absolute left-2 top-4 w-64 rounded-[1.6rem] border-2 border-college-black bg-college-black p-4 text-white shadow-pop sm:left-12">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-black text-college-teal">CampusPulse</span>
                <CalendarDays size={20} className="text-college-coral" />
              </div>
              <div className="comic-burst mb-4 h-36 rounded-2xl border-2 border-white/80" />
              <h3 className="text-2xl font-black">Spring Concert</h3>
              <p className="text-sm font-bold text-white/70">Read more - Data 13:00</p>
              <div className="mt-4 rounded-full border-2 border-white bg-college-fuchsia py-2 text-center text-sm font-black uppercase">
                Join
              </div>
            </div>

            <div className="absolute right-0 top-28 w-64 rotate-3 rounded-[1.6rem] border-2 border-college-black bg-white/90 p-4 text-college-black shadow-pop sm:right-8">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-black">Event Cards</span>
                <span className="h-5 w-5 rounded-full border-2 border-college-black bg-college-orange" />
              </div>
              <div className="mb-4 flex h-36 items-center justify-center rounded-2xl border-2 border-college-black bg-white/80">
                <Camera size={54} className="text-college-black animate-float" />
              </div>
              <h3 className="text-2xl font-black">Tech Faire</h3>
              <p className="text-sm font-bold text-black/55">Explore - Connect - Create</p>
              <div className="mt-4 rounded-full border-2 border-college-black bg-college-orange py-2 text-center text-sm font-black uppercase text-white">
                Learn More
              </div>
            </div>

            <div className="absolute bottom-4 left-8 flex flex-col gap-3 sm:left-0">
              {eventStickers.map(({ icon: Icon, label, color, tilt }) => (
                <div key={label} className={`flex items-center gap-3 rounded-2xl border-2 border-college-black px-4 py-3 shadow-sticker ${color} ${tilt}`}>
                  <Icon size={20} />
                  <span className="font-black">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-y-2 border-college-black bg-college-fuchsia py-3 text-white">
          <div className="flex w-[200%] animate-marquee gap-8 whitespace-nowrap text-sm font-black uppercase">
            {Array.from({ length: 2 }).map((_, loop) => (
              <div key={loop} className="flex gap-8">
                <span>Freshers Night</span>
                <span>Hackathons</span>
                <span>Club Fests</span>
                <span>Photo Drops</span>
                <span>Cultural Week</span>
                <span>Sports Day</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="poster-band">
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-3 rounded-[2rem] border-2 border-college-black bg-white/88 p-6 shadow-pop md:flex-row md:items-end md:justify-between">
          <div>
            <span className="badge-navy mb-3">Campus toolkit</span>
            <h2 className="text-3xl font-black uppercase text-college-black sm:text-5xl">Everything your club needs</h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-relaxed text-black/60">
            Upload, browse, search, save, and manage club memories without losing the fun of the event itself.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }, index) => (
            <div key={title} className="card group">
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-college-black text-college-black shadow-[3px_3px_0_#0A0A0C] transition-transform group-hover:-rotate-6 ${
                index % 3 === 0 ? 'bg-college-fuchsia text-white' : index % 3 === 1 ? 'bg-college-teal' : 'bg-college-coral'
              }`}>
                <Icon size={23} />
              </div>
              <h3 className="mb-2 text-lg font-black uppercase text-college-black">{title}</h3>
              <p className="text-sm font-semibold leading-relaxed text-black/60">{desc}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="border-y-2 border-college-black bg-college-teal">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-14 text-center">
          <h2 className="text-3xl font-black uppercase text-college-black sm:text-5xl">
            Make every event look like it actually happened.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-bold text-black/65">
            UniVibe turns college event management into a bright, searchable, shareable campus feed.
          </p>
          <Link to="/register" className="btn-primary mt-8 px-8 py-3">
            Create Your Account
          </Link>
        </div>
      </section>

      <footer className="bg-college-black py-8 text-center text-sm font-bold text-white">
        <p>2026 UniVibe - Built for college clubs and societies</p>
      </footer>
    </div>
  )
}
