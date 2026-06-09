import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle, Image, Film, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadFile, getStorageProvider } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { autoTagImage } from '../lib/autoTagger'
import toast from 'react-hot-toast'

type FileEntry = {
  file: File
  preview: string
  status: 'pending' | 'tagging' | 'uploading' | 'done' | 'error'
  progress: number
  tags: string[]
  caption: string
  error?: string
}

type Props = {
  eventId:   string
  albumId:   string
  isPublic:  boolean
  eventName?: string
  clubName?:  string
  onUploaded: () => void
  onCancel:   () => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'], 'video/*': ['.mp4', '.mov', '.webm'] }

function compressImage(file: File, maxDimension = 2048, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file)
      return
    }
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width <= maxDimension && height <= maxDimension && file.size < 1.5 * 1024 * 1024) {
        resolve(file)
        return
      }
      const ratio = Math.min(maxDimension / width, maxDimension / height, 1)
      width  = Math.round(width * ratio)
      height = Math.round(height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function MediaUploader({ eventId, albumId, isPublic, eventName = '', clubName = '', onUploaded, onCancel }: Props) {
  const { profile } = useAuth()
  const [files, setFiles]       = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    const entries: FileEntry[] = accepted
      .filter(f => f.size <= MAX_FILE_SIZE)
      .map(f => ({
        file: f,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        status: 'pending',
        progress: 0,
        tags: [],
        caption: '',
      }))

    const oversized = accepted.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) toast.error(`${oversized.length} file(s) exceed 20MB limit`)

    setFiles(prev => [...prev, ...entries])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, multiple: true, maxSize: MAX_FILE_SIZE,
  })

  function removeFile(i: number) {
    setFiles(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function uploadAll() {
    if (files.length === 0) return
    setUploading(true)

    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const entry = files[i]
      if (entry.status === 'done') continue

      const isVideo = entry.file.type.startsWith('video/')

      // Step 1: AI tagging (images only)
      let autoTags: string[] = []
      let autoCaption = ''
      if (!isVideo) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'tagging', progress: 5 } : f))
        try {
          const result = await autoTagImage(entry.file, eventName, clubName)
          autoTags    = result.tags
          autoCaption = result.caption
        } catch (e) {
          console.error('[AutoTagger] error:', e)
        }
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, tags: autoTags, caption: autoCaption, progress: 25 } : f))
      }

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 30 } : f))

      try {

        const compressed = await compressImage(entry.file)
        const ext  = entry.file.name.split('.').pop()
        const path = `${eventId}/${albumId}/${Date.now()}_${i}.${ext}`

        const publicUrl = await uploadFile(compressed, path)

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 80 } : f))

        const { error: dbErr } = await supabase.from('media').insert({
          event_id:    eventId,
          album_id:    albumId,
          url:         publicUrl,
          type:        isVideo ? 'video' : 'photo',
          title:       entry.file.name.split('.').slice(0, -1).join('.'),
          uploaded_by: profile!.id,
          is_public:   isPublic,
          tags:        autoTags,
          caption:     autoCaption,
        })

        if (dbErr) throw new Error(dbErr.message)

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f))
        successCount++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg } : f))
      }
    }

    setUploading(false)
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`)
      setFiles([])
      onUploaded()
    }
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const doneCount    = files.filter(f => f.status === 'done').length

  return (
    <div className="card border-2 border-college-amber/20 bg-amber-50/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-college-navy">Upload Media</h3>
          {getStorageProvider() === 's3' ? (
            <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">☁ AWS S3</span>
          ) : (
            <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">⚡ Supabase</span>
          )}
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={16} />
        </button>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive ? 'border-college-amber bg-amber-50' : 'border-gray-200 hover:border-college-amber hover:bg-amber-50/50'
      }`}>
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDragActive ? 'bg-college-amber' : 'bg-gray-100'}`}>
            <Upload size={22} className={isDragActive ? 'text-white' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-medium text-gray-700 text-sm">
              {isDragActive ? 'Drop files here' : 'Drag & drop photos or videos'}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">or <span className="text-college-amber font-medium">click to browse</span> (select multiple with Ctrl/Cmd) · Max 20MB each</p>
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP, GIF, MP4, MOV</p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
          {files.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-gray-100">
              {/* Preview */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                {entry.preview ? (
                  <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Film size={16} className="text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{entry.file.name}</p>
                <p className="text-xs text-gray-400">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</p>
                {/* AI caption */}
                {entry.caption && (
                  <p className="text-xs text-college-fuchsia italic mt-1 leading-snug">"{entry.caption}"</p>
                )}
                {/* Auto-generated tags */}
                {entry.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    <Tag size={9} className="text-college-amber mt-0.5 shrink-0" />
                    {entry.tags.map(t => (
                      <span key={t} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {/* Progress bar */}
                {(entry.status === 'tagging' || entry.status === 'uploading') && (
                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                    <div className={`h-1 rounded-full transition-all ${entry.status === 'tagging' ? 'bg-college-coral' : 'bg-college-amber'}`}
                      style={{ width: `${entry.progress}%` }} />
                  </div>
                )}
                {entry.status === 'tagging' && (
                  <p className="text-xs text-college-fuchsia mt-0.5">Analyzing image...</p>
                )}
                {entry.status === 'error' && (
                  <p className="text-xs text-red-400 mt-0.5">{entry.error}</p>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-center gap-1">
                {entry.status === 'pending'   && <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>}
                {entry.status === 'tagging'   && (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-college-fuchsia text-[9px] font-medium">AI</span>
                  </div>
                )}
                {entry.status === 'uploading' && <div className="w-4 h-4 border-2 border-amber-200 border-t-college-amber rounded-full animate-spin" />}
                {entry.status === 'done'      && <CheckCircle size={16} className="text-green-500" />}
                {entry.status === 'error'     && <AlertCircle size={16} className="text-red-400" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
            {doneCount > 0 && ` · ${doneCount} uploaded`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setFiles([])} disabled={uploading} className="btn-secondary py-2 px-4 text-sm">
              Clear
            </button>
            <button onClick={uploadAll} disabled={uploading || pendingCount === 0} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
              {uploading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={14} /> Upload {pendingCount > 0 ? pendingCount : ''} File{pendingCount !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
