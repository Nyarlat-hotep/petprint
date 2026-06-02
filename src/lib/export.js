import { renderWordCloudToCanvas } from './renderWordCloud'
import { resolvePalette } from '../styles/palettes'

// The single list of print sizes the user picks from. Stored in portrait form
// (wIn ≤ hIn); the orientation toggle flips non-square sizes to landscape.
// Each size's proportions also drive the live preview shape.
export const PRINT_SIZES = [
  { id: '5x7',   wIn: 5,  hIn: 7  },
  { id: '8x8',   wIn: 8,  hIn: 8,  square: true },
  { id: '8x10',  wIn: 8,  hIn: 10 },
  { id: '11x14', wIn: 11, hIn: 14 },
  { id: '11x17', wIn: 11, hIn: 17 },
  { id: '12x12', wIn: 12, hIn: 12, square: true },
  { id: '16x20', wIn: 16, hIn: 20 },
  { id: '24x36', wIn: 24, hIn: 36 },
]
const DEFAULT_SIZE = '8x10'
const DPI = 300

function sizeFor(style) {
  return PRINT_SIZES.find((s) => s.id === style?.printSize)
    || PRINT_SIZES.find((s) => s.id === DEFAULT_SIZE)
}

// Resolve printed dimensions (inches) for a style. Orientation flips the
// stored portrait size to landscape; square sizes ignore orientation.
export function computeInches(style) {
  const s = sizeFor(style)
  const portrait = (style?.orientation || 'portrait') === 'portrait'
  return (portrait || s.square) ? { wIn: s.wIn, hIn: s.hIn } : { wIn: s.hIn, hIn: s.wIn }
}

export function formatInches(style) {
  const { wIn, hIn } = computeInches(style)
  return `${wIn} × ${hIn}`
}

export async function exportPng(project) {
  if (!project.maskBitmap) throw new Error('No silhouette to render.')

  const { wIn, hIn } = computeInches(project.style)
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
    : 80_000_000  // ~8944 × 8944 — fits a full 24×36 poster (7200 × 10800) on desktop
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
  return PRINT_SIZES
}
