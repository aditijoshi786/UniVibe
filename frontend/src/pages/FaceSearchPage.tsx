import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ScanFace, Upload, X, Loader, Image as ImageIcon, AlertCircle } from 'lucide-react'
import * as faceapi from 'face-api.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

type MatchedPhoto = {
  id: string; url: string; thumbnail_url: string | null
  title: string | null; event_id: string; album_id: string
  events: { title: string } | null
  distance: number
}

// Models are served from /public/models — no CDN dependency, no rate limits
const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.52   // euclidean distance; lower = stricter match

let modelsLoaded = false

async function loadModels() {
  if (modelsLoaded) return
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

// Load image via fetch→blob URL so canvas operations are never CORS-blocked
async function loadImageAsBlobUrl(src: string): Promise<string> {
  const res = await fetch(src)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

async function getDescriptor(imageEl: HTMLImageElement): Promise<Float32Array | null> {
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
  const detection = await faceapi
    .detectSingleFace(imageEl, opts)
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection?.descriptor ?? null
}

export default function FaceSearchPage() {
  const { profile } = useAuth()
  const [selfieUrl,    setSelfieUrl]    = useState<string | null>(null)
  const [selfieFile,   setSelfieFile]   = useState<File | null>(null)
  const [status,       setStatus]       = useState<'idle' | 'loading-models' | 'detecting' | 'scanning' | 'done' | 'error'>('idle')
  const [progress,     setProgress]     = useState(0)
  const [matches,      setMatches]      = useState<MatchedPhoto[]>([])
  const [errorMsg,     setErrorMsg]     = useState('')
  const [totalScanned, setTotalScanned] = useState(0)
  const selfieImgRef  = useRef<HTMLImageElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)

  function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (selfieUrl) URL.revokeObjectURL(selfieUrl)
    setSelfieUrl(URL.createObjectURL(file))
    setSelfieFile(file)
    setMatches([])
    setStatus('idle')
  }

  const findMyPhotos = useCallback(async () => {
    if (!selfieFile || !profile) return
    setStatus('loading-models')
    setErrorMsg('')
    setMatches([])
    setProgress(0)

    try {
      await loadModels()
      setStatus('detecting')

      // Wait for the selfie image to be fully loaded in the DOM
      await new Promise<void>(resolve => {
        if (!selfieImgRef.current) { resolve(); return }
        if (selfieImgRef.current.complete) { resolve(); return }
        selfieImgRef.current.onload = () => resolve()
      })

      if (!selfieImgRef.current) throw new Error('Selfie image not rendered')
      // Load selfie as blob URL so canvas operations aren't CORS-blocked
      const selfieBlobUrl = await loadImageAsBlobUrl(selfieImgRef.current.src)
      const selfieImg = new Image()
      selfieImg.src = selfieBlobUrl
      await new Promise<void>(res => { selfieImg.onload = () => res() })
      const referenceDescriptor = await getDescriptor(selfieImg)
      URL.revokeObjectURL(selfieBlobUrl)
      if (!referenceDescriptor) throw new Error('No face detected in your selfie. Please use a clear front-facing photo.')

      // Save descriptor to profile for future use
      await supabase.from('profiles').update({
        face_descriptor: Array.from(referenceDescriptor)
      }).eq('id', profile.id)

      setStatus('scanning')

      // Fetch all accessible photos in batches
      const PAGE = 50
      let from = 0
      const found: MatchedPhoto[] = []
      let total = 0

      while (true) {
        let q = supabase
          .from('media')
          .select('id, url, thumbnail_url, title, event_id, album_id, events(title)')
          .eq('type', 'photo')
          .range(from, from + PAGE - 1)
        if (profile.role === 'viewer') q = q.eq('is_public', true)

        const { data } = await q
        if (!data || data.length === 0) break

        total += data.length
        setTotalScanned(total)

        for (const photo of data) {
          try {
            // Fetch as blob → object URL to avoid CORS tainted-canvas errors
            const blobUrl = await loadImageAsBlobUrl(photo.thumbnail_url ?? photo.url)
            const img = new Image()
            img.src = blobUrl
            await new Promise<void>((res, rej) => {
              img.onload = () => res()
              img.onerror = () => rej(new Error('img load failed'))
              setTimeout(() => rej(new Error('timeout')), 10000)
            })

            const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
            const detection = await faceapi
              .detectSingleFace(img, opts)
              .withFaceLandmarks()
              .withFaceDescriptor()

            if (detection) {
              const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor)
              if (distance < MATCH_THRESHOLD) {
                found.push({ ...photo, distance, events: photo.events as unknown as { title: string } | null })
                setMatches([...found].sort((a, b) => a.distance - b.distance))
              }
            }
          } catch { /* skip photos that fail to load or detect */ }
        }

        setProgress(Math.min(90, (total / (total + PAGE)) * 90))
        if (data.length < PAGE) break
        from += PAGE
      }

      setProgress(100)
      setStatus('done')
      if (found.length === 0) toast('No matching photos found', { icon: '🔍' })
      else toast.success(`Found ${found.length} photo${found.length !== 1 ? 's' : ''} with your face!`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Face search failed'
      setErrorMsg(msg)
      setStatus('error')
    }
  }, [selfieFile, profile])

  const statusLabel: Record<string, string> = {
    'loading-models': 'Loading AI models…',
    'detecting':      'Detecting your face…',
    'scanning':       `Scanning photos… (${totalScanned} scanned)`,
    'done':           `Scan complete — ${totalScanned} photos scanned`,
    'error':          'Error',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-college-amber/10 flex items-center justify-center">
            <ScanFace size={20} className="text-college-amber" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-college-navy">Find My Photos</h1>
            <p className="text-gray-400 text-sm">Upload a selfie and AI will find all event photos containing your face.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upload selfie */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-college-navy mb-4">Your Reference Selfie</h2>

          {selfieUrl ? (
            <div className="relative">
              <img ref={selfieImgRef} src={selfieUrl} alt="Your selfie" crossOrigin="anonymous"
                className="w-full aspect-square object-cover rounded-xl" />
              <button onClick={() => { setSelfieUrl(null); setSelfieFile(null); setMatches([]); setStatus('idle') }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-college-amber hover:bg-amber-50/50 transition-all cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <Upload size={20} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Upload a selfie</p>
                <p className="text-xs text-gray-400 mt-0.5">Clear front-facing photo works best</p>
              </div>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />

          <button
            onClick={findMyPhotos}
            disabled={!selfieFile || status === 'loading-models' || status === 'detecting' || status === 'scanning'}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
            {(status === 'loading-models' || status === 'detecting' || status === 'scanning') ? (
              <><Loader size={15} className="animate-spin" /> {statusLabel[status]}</>
            ) : (
              <><ScanFace size={15} /> Find My Photos</>
            )}
          </button>

          {/* Progress bar */}
          {(status === 'scanning' || status === 'done') && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{statusLabel[status]}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-college-amber h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-600 rounded-xl p-3 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          {/* Tips */}
          <div className="mt-4 bg-amber-50/50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-college-navy text-xs">Tips for best results</p>
            <p>• Use a clear, well-lit front-facing photo</p>
            <p>• Avoid sunglasses or heavy filters</p>
            <p>• One face in the selfie works best</p>
            <p>• Scanning may take a few minutes for large albums</p>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-college-navy mb-4">
            {status === 'done'
              ? `Matching Photos (${matches.length})`
              : 'Matching Photos'}
          </h2>

          {matches.length === 0 && status !== 'scanning' && status !== 'loading-models' && status !== 'detecting' ? (
            <div className="card text-center py-16 h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <ScanFace size={28} className="text-college-amber" />
              </div>
              <p className="font-semibold text-college-navy">
                {status === 'done' ? 'No matching photos found' : 'Your matches will appear here'}
              </p>
              <p className="text-gray-400 text-sm mt-1 max-w-xs">
                {status === 'done'
                  ? 'Try a clearer selfie or check if photos have been uploaded for your events.'
                  : 'Upload a selfie and click "Find My Photos" to scan all event photos for your face.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Live loading skeletons while scanning */}
              {status === 'scanning' && matches.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
              ))}
              {matches.map(photo => (
                <Link key={photo.id}
                  to={`/events/${photo.event_id}/albums/${photo.album_id}?photo=${photo.id}`}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={photo.thumbnail_url ?? photo.url} alt={photo.title ?? ''}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100">
                    <p className="text-white text-xs font-medium truncate">{photo.events?.title ?? 'Event'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/60 text-xs">
                        {Math.round((1 - photo.distance) * 100)}% match
                      </span>
                      <ImageIcon size={10} className="text-white/60" />
                    </div>
                  </div>
                  {/* Match confidence badge */}
                  <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                    {Math.round((1 - photo.distance) * 100)}%
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
