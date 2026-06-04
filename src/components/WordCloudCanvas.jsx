import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { renderWordCloudToCanvas } from '../lib/renderWordCloud'
import { resolvePalette } from '../styles/palettes'
import './WordCloudCanvas.css'

// Debounce by serialized shape so rapid add/remove/favorite edits on step 4
// don't thrash the packer. ~350ms feels live without restarting on every char.
function useDebouncedNames(names, delay = 350) {
  const [debounced, setDebounced] = useState(names)
  const key = JSON.stringify(names.map((n) => [n.text, !!n.favorite]))
  useEffect(() => {
    const id = setTimeout(() => setDebounced(names), delay)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay])
  return debounced
}

export default function WordCloudCanvas({ project, width, maxWidth, maxHeight, animate = false }) {
  // Back-compat: legacy `width` prop becomes the max width with no height cap.
  const boundW = maxWidth ?? width ?? 580
  const boundH = maxHeight ?? Infinity
  const canvasRef = useRef(null)
  // Deferring style/seed lets React coalesce rapid slider drags so the
  // expensive word packer doesn't run on every input event.
  const deferredStyle = useDeferredValue(project.style)
  const deferredSeed = useDeferredValue(project.seed)
  const deferredNames = useDebouncedNames(project.names)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const mw = project.maskBitmap?.width || 0
    const mh = project.maskBitmap?.height || 0
    // Canvas fills the whole bound box; the renderer fits the silhouette
    // inside while preserving its aspect (extra space becomes background).
    const cssW = Math.floor(boundW)
    const cssH = Math.floor(Number.isFinite(boundH) ? boundH : boundW / 1.4)
    const renderW = Math.round(cssW * dpr)
    const renderH = Math.round(cssH * dpr)
    if (canvas.width !== renderW) canvas.width = renderW
    if (canvas.height !== renderH) canvas.height = renderH
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'

    if (!project.maskBitmap) {
      // No silhouette yet — just clear whatever was there.
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    // With a mask but no names, fall through — the renderer draws the
    // background + silhouette tint and skips the (empty) word pass.
    const { mask } = project.maskBitmap

    let cancelled = false
    const args = {
      mask,
      maskWidth: mw,
      maskHeight: mh,
      silhouetteImageUrl: project.maskBitmap.previewUrl,
      silhouetteSvg: project.maskBitmap.svgMarkup,
      silhouetteBbox: project.maskBitmap.bbox,
      silhouetteSourceWidth: project.maskBitmap.imageWidth,
      silhouetteSourceHeight: project.maskBitmap.imageHeight,
      names: deferredNames.map((n) => ({ text: n.text, favorite: !!n.favorite })),
      seed: deferredSeed,
      style: deferredStyle,
      palette: resolvePalette(deferredStyle),
    }

    if (animate) {
      // Animated entrance: render straight to the visible canvas and let the
      // renderer run its own rAF loop. No offscreen swap needed.
      renderWordCloudToCanvas({
        canvas,
        ...args,
        animation: { isCancelled: () => cancelled },
      }).catch((e) => {
        if (!cancelled) console.error('Word cloud render failed:', e)
      })
      return () => { cancelled = true }
    }

    // Render to an offscreen buffer first, then swap it in on completion —
    // keeps the previous frame painted while async work (pattern load, packer)
    // runs, so dragging style sliders doesn't flash a blank canvas.
    const off = document.createElement('canvas')
    off.width = renderW
    off.height = renderH

    renderWordCloudToCanvas({ canvas: off, ...args }).then(() => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(off, 0, 0)
    }).catch((e) => {
      if (!cancelled) console.error('Word cloud render failed:', e)
    })
    return () => { cancelled = true }
  }, [project.maskBitmap, deferredNames, deferredStyle, deferredSeed, boundW, boundH, animate])

  return <canvas ref={canvasRef} className="wordcloud-canvas" />
}
