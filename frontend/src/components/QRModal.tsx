import { useEffect, useRef } from 'react'
import { X, Download, Copy, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'

type Props = {
  url: string
  title: string
  onClose: () => void
}

export default function QRModal({ url, title, onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function copyLink() {
    navigator.clipboard.writeText(url)
    toast.success('Album link copied!')
  }

  function downloadQR() {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${title.replace(/\s+/g, '_')}_QR.png`
    a.click()
    toast.success('QR code downloaded')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-college-orange/10 flex items-center justify-center">
              <QrCode size={15} className="text-college-orange" />
            </div>
            <h2 className="font-semibold text-college-navy text-sm">Share Album</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-5">
          <p className="text-xs text-gray-400 text-center">Scan with any camera app to open this album</p>

          {/* QR Code with decorative frame */}
          <div
            ref={canvasRef}
            className="relative p-4 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #FF007F 0%, #00CED1 52%, #FF4500 100%)',
            }}
          >
            <div className="bg-white p-3 rounded-xl">
              <QRCodeCanvas
                value={url}
                size={180}
                bgColor="#ffffff"
                fgColor="#0A0A0C"
                level="M"
                includeMargin={false}
              />
            </div>
            {/* Corner accents */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-college-gold rounded-tl-md" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-college-gold rounded-tr-md" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-college-gold rounded-bl-md" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-college-gold rounded-br-md" />
          </div>

          {/* Album name */}
          <p className="text-sm font-semibold text-college-navy text-center line-clamp-1">{title}</p>

          {/* URL strip */}
          <div className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-500 flex-1 truncate">{url}</p>
            <button
              onClick={copyLink}
              className="shrink-0 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-college-orange hover:border-college-orange transition-colors"
              title="Copy link"
            >
              <Copy size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 btn-secondary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Copy size={14} /> Copy Link
          </button>
          <button
            onClick={downloadQR}
            className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Download size={14} /> Download QR
          </button>
        </div>
      </div>
    </div>
  )
}
