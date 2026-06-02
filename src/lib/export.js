import { renderWordCloudToCanvas } from './renderWordCloud'
import { resolvePalette } from '../styles/palettes'

// Aspect ratios the user can pick on the preview stage, expressed as
// short:long so we can derive the short edge from a chosen long edge.
export const ASPECT_RATIOS = [
  { id: '1:1', short: 1, long: 1 },
  { id: '4:5', short: 4, long: 5 },
  { id: '5:7', short: 5, long: 7 },
  { id: '2:3', short: 2, long: 3 },
]
// Print sizes are chosen by their long edge in inches; the short edge follows
// from the selected aspect ratio. (4:5 @ 10in long = the classic 8×10.)
const LONG_EDGES = [7, 10, 14, 20]
const DPI = 300

function ratioFor(style) {
  return ASPECT_RATIOS.find((a) => a.id === style?.aspectRatio) || ASPECT_RATIOS[1]
}

// Resolve the printed dimensions (in inches) for a style + chosen long edge.
// Orientation decides which axis gets the long edge; '1:1' ignores it.
export function computeInches(style, longEdgeIn) {
  const ar = ratioFor(style)
  const longIn = longEdgeIn
  const shortIn = (longEdgeIn * ar.short) / ar.long
  const portrait = (style?.orientation || 'portrait') === 'portrait'
  return portrait ? { wIn: shortIn, hIn: longIn } : { wIn: longIn, hIn: shortIn }
}

// Trim to a clean label, e.g. 8 × 10 or 7.1 × 10.
function fmtIn(n) {
  return Number(n.toFixed(1)).toString()
}
export function formatInches(style, longEdgeIn) {
  const { wIn, hIn } = computeInches(style, longEdgeIn)
  return `${fmtIn(wIn)} × ${fmtIn(hIn)}`
}

export async function exportPng(project, longEdgeIn) {
  if (!project.maskBitmap) throw new Error('No silhouette to render.')
  if (!LONG_EDGES.includes(longEdgeIn)) throw new Error(`Unknown size: ${longEdgeIn}`)

  const { wIn, hIn } = computeInches(project.style, longEdgeIn)
  let w = Math.round(wIn * DPI)
  let h = Math.round(hIn * DPI)

  // Memory guard: canvases this large can crash low-memory devices (especially
  // mobile). Each pixel = 4 bytes, so a 4800×6000 canvas = ~115 MB. Scale the
  // canvas down (preserving aspect) when device memory is limited or when the
  // canvas exceeds an absolute safety ceiling. The downloaded PNG will be
  // smaller than the print spec but still usable.
  const deviceMemoryGB = navigator.deviceMemory ?? 8
  const maxPixels = deviceMemoryGB < 4
    ? 18_000_000  // ~4242 × 4242 — caps an 11×14 at 300 DPI on low-mem devices
    : 60_000_000  // ~7745 × 7745 — well under a 16×20 ceiling on desktop
  if (w * h > maxPixels) {
    const scale = Math.sqrt(maxPixels / (w * h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  // Some browsers silently fail to allocate huge canvases — detect early.
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`Image is too large for this device. Try a smaller print size.`)
  }

  await renderWordCloudToCanvas({
    canvas,
    mask: project.maskBitmap.mask,
    maskWidth: project.maskBitmap.width,
    maskHeight: project.maskBitmap.height,
    silhouetteImageUrl: project.maskBitmap.previewUrl,
    silhouetteSvg: project.maskBitmap.svgMarkup,
    silhouetteBbox: project.maskBitmap.bbox,
    silhouetteSourceWidth: project.maskBitmap.imageWidth,
    silhouetteSourceHeight: project.maskBitmap.imageHeight,
    names: project.names.map((n) => ({ text: n.text, favorite: !!n.favorite })),
    seed: project.seed,
    style: project.style,
    palette: resolvePalette(project.style),
  })

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode PNG.'))
    }, 'image/png')
  })
}

export function listExportSizes() {
  return [...LONG_EDGES]
}
