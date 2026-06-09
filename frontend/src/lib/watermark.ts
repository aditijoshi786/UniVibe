// Adds a branded bar to the bottom of downloaded photos using Canvas API.
// The stored file is never modified — watermark is applied on download only.

const FONT_FAMILY  = "'Segoe UI', Arial, sans-serif"
const BAR_GRAD_L   = '#0A0A0C'
const BAR_GRAD_R   = '#FF007F'
const ACCENT_COLOR = '#FF4500'
const GOLD_COLOR   = '#00CED1'
const TEXT_COLOR   = '#ffffff'
const MUTED_COLOR  = 'rgba(255,255,255,0.62)'

export type WatermarkOptions = {
  clubName:     string
  eventName:    string
  uploaderName: string
  uploaderRole: string
  takenAt:      string
}

function getScale(imgWidth: number) {
  const scale = Math.max(1, imgWidth / 1200)
  return {
    scale,
    barHeight: Math.round(72 * scale),
    fontLg:    Math.round(15 * scale),
    fontSm:    Math.round(12 * scale),
    padding:   Math.round(18 * scale),
    iconSize:  Math.round(20 * scale),
    borderH:   Math.round(3  * scale),
    lineGap:   Math.round(6  * scale),
  }
}

function buildLine2(opts: WatermarkOptions): string {
  const { uploaderName, uploaderRole, clubName } = opts
  const name = uploaderName || 'Unknown'
  switch (uploaderRole) {
    case 'admin':
      return `Uploaded by ${name}  ·  Admin  ·  UniVibe`
    case 'photographer':
      return `Photo by ${name}  ·  Photographer  ·  UniVibe`
    case 'club_member':
      return clubName
        ? `Uploaded by ${name}  ·  ${clubName}`
        : `Uploaded by ${name}  ·  UniVibe`
    default:
      return 'UniVibe'
  }
}

async function fetchAsBlobUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors', cache: 'no-cache' })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return URL.createObjectURL(await res.blob())
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawCameraIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.strokeStyle = GOLD_COLOR
  ctx.fillStyle   = GOLD_COLOR
  ctx.lineWidth   = Math.max(1.5, size * 0.09)
  ctx.beginPath()
  ctx.roundRect(x, y + size * 0.22, size, size * 0.72, 3)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size * 0.60, size * 0.22, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillRect(x + size * 0.33, y + size * 0.08, size * 0.34, size * 0.18)
  ctx.restore()
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  opts: WatermarkOptions,
) {
  const { barHeight, fontLg, fontSm, padding, iconSize, borderH, lineGap } = getScale(imgWidth)
  const barY = imgHeight

  const bgGrad = ctx.createLinearGradient(0, barY, imgWidth, barY)
  bgGrad.addColorStop(0, BAR_GRAD_L)
  bgGrad.addColorStop(1, BAR_GRAD_R)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, barY, imgWidth, barHeight)

  const borderGrad = ctx.createLinearGradient(0, barY, imgWidth, barY)
  borderGrad.addColorStop(0,   '#FF007F')
  borderGrad.addColorStop(0.5, '#00CED1')
  borderGrad.addColorStop(1,   '#FF4500')
  ctx.fillStyle = borderGrad
  ctx.fillRect(0, barY, imgWidth, borderH)

  const year  = new Date(opts.takenAt).getFullYear()
  const parts = [opts.clubName, opts.eventName, String(year)].filter(Boolean)
  const line1 = parts.join('   ·   ')
  const line2 = buildLine2(opts)

  const totalTextH = fontLg + lineGap + fontSm
  const line1Y = barY + (barHeight - totalTextH) / 2 + fontLg / 2 + borderH / 2
  const line2Y = line1Y + fontLg / 2 + lineGap + fontSm / 2

  drawCameraIcon(ctx, padding, line1Y - iconSize * 0.6, iconSize)
  const textX = padding + iconSize + Math.round(padding * 0.7)

  ctx.font         = `bold ${fontLg}px ${FONT_FAMILY}`
  ctx.fillStyle    = TEXT_COLOR
  ctx.textBaseline = 'middle'
  ctx.fillText(line1, textX, line1Y)

  ctx.font      = `${fontSm}px ${FONT_FAMILY}`
  ctx.fillStyle = MUTED_COLOR
  ctx.fillText(line2, textX, line2Y)

  // UniVibe pill on the right
  const logoText = 'UniVibe'
  ctx.font       = `bold ${fontLg}px ${FONT_FAMILY}`
  const logoW    = ctx.measureText(logoText).width
  const pillPad  = Math.round(padding * 0.65)
  const pillH    = Math.round(fontLg * 1.55)
  const pillW    = logoW + pillPad * 2
  const pillX    = imgWidth - padding - pillW
  const pillY    = barY + (barHeight - pillH) / 2
  const pillR    = pillH / 2

  const pillGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0)
  pillGrad.addColorStop(0, '#00CED1')
  pillGrad.addColorStop(1, '#FF6F61')
  ctx.fillStyle = pillGrad
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, pillR)
  ctx.fill()

  ctx.fillStyle    = '#0A0A0C'
  ctx.textBaseline = 'middle'
  ctx.fillText(logoText, pillX + pillPad, pillY + pillH / 2)
}

export async function downloadWithWatermark(
  imageUrl: string,
  filename: string,
  opts: WatermarkOptions,
  isVideo = false,
): Promise<void> {
  if (isVideo) {
    const res     = await fetch(imageUrl)
    const blob    = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    triggerDownload(blobUrl, filename)
    URL.revokeObjectURL(blobUrl)
    return
  }

  let blobUrl: string | null = null
  try {
    blobUrl           = await fetchAsBlobUrl(imageUrl)
    const img         = await loadImage(blobUrl)
    const { barHeight } = getScale(img.naturalWidth)
    const canvas      = document.createElement('canvas')
    canvas.width      = img.naturalWidth
    canvas.height     = img.naturalHeight + barHeight
    const ctx         = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    drawWatermark(ctx, img.naturalWidth, img.naturalHeight, opts)
    const outBlob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), 'image/jpeg', 0.92)
    )
    const outUrl = URL.createObjectURL(outBlob)
    triggerDownload(outUrl, filename.replace(/\.[^.]+$/, '') + '_univibe.jpg')
    URL.revokeObjectURL(outUrl)
  } catch (err) {
    console.error('Watermark failed, downloading original:', err)
    triggerDownload(imageUrl, filename)
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}

function triggerDownload(url: string, filename: string) {
  const a         = document.createElement('a')
  a.href          = url
  a.download      = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
