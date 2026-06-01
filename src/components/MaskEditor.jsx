import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUUpLeft } from '@phosphor-icons/react'
import './MaskEditor.css'

const MAX_DISPLAY_W = 700
const MAX_DISPLAY_H = 520
const MAX_UNDO = 20

/**
 * Paint editor for refining the silhouette mask. User adds/erases pixels with
 * a circular brush. On commit, recomputes the bounding box, crops the mask,
 * and regenerates the preview PNG, returning a fresh `bitmap` for the project.
 *
 * Props:
 *   photoUrl       — original photo Blob URL
 *   bitmap         — current mask bitmap (mask, bbox, imageWidth/Height, …)
 *   onCommit(b)    — called with the new bitmap when user clicks Done
 *   onCancel()     — called when user clicks Cancel
 */
export default function MaskEditor({ photoUrl, bitmap, onCommit, onCancel }) {
  const { mask: initialMask, bbox: initialBbox, imageWidth, imageHeight } = bitmap

  const [mode, setMode] = useState('add')
  const [brushSize, setBrushSize] = useState(40)
  const [cursorPos, setCursorPos] = useState(null)
  const [photoReady, setPhotoReady] = useState(false)
  const [undoDepth, setUndoDepth] = useState(0)
  const [committing, setCommitting] = useState(false)

  const maskRef = useRef(null)
  const undoRef = useRef([])
  const photoRef = useRef(null)
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef(null)
  const renderQueuedRef = useRef(false)

  const scale = Math.min(MAX_DISPLAY_W / imageWidth, MAX_DISPLAY_H / imageHeight, 1)
  const cssW = Math.round(imageWidth * scale)
  const cssH = Math.round(imageHeight * scale)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  // Build a full-image mask from the cropped initial mask
  const expandInitial = useCallback(() => {
    const mask = new Uint8Array(imageWidth * imageHeight)
    for (let y = 0; y < initialBbox.h; y++) {
      for (let x = 0; x < initialBbox.w; x++) {
        mask[(y + initialBbox.y) * imageWidth + (x + initialBbox.x)] =
          initialMask[y * initialBbox.w + x]
      }
    }
    return mask
  }, [initialMask, initialBbox, imageWidth, imageHeight])

  // Init mask + load photo
  useEffect(() => {
    maskRef.current = expandInitial()
    undoRef.current = []
    setUndoDepth(0)

    const img = new Image()
    img.onload = () => {
      photoRef.current = img
      setPhotoReady(true)
    }
    img.src = photoUrl
  }, [photoUrl, expandInitial])

  // Compose display canvas: photo → mask overlay → brush cursor
  const renderDisplay = useCallback(() => {
    const canvas = canvasRef.current
    const photo = photoRef.current
    const mask = maskRef.current
    if (!canvas || !photo || !mask) return

    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'

    const ctx = canvas.getContext('2d')

    ctx.imageSmoothingEnabled = true
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height)

    // Mask overlay: green at ~40% alpha where mask=1
    const overlay = document.createElement('canvas')
    overlay.width = imageWidth
    overlay.height = imageHeight
    const octx = overlay.getContext('2d')
    const imgData = octx.createImageData(imageWidth, imageHeight)
    for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
      if (mask[i]) {
        imgData.data[j + 0] = 70
        imgData.data[j + 1] = 200
        imgData.data[j + 2] = 130
        imgData.data[j + 3] = 110
      }
    }
    octx.putImageData(imgData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height)

    // Brush cursor
    if (cursorPos) {
      ctx.strokeStyle = mode === 'add' ? '#0a8043' : '#b03525'
      ctx.lineWidth = 2 * dpr
      ctx.beginPath()
      ctx.arc(
        cursorPos.x * scale * dpr,
        cursorPos.y * scale * dpr,
        brushSize * scale * dpr,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
    }
  }, [cssW, cssH, dpr, imageWidth, imageHeight, cursorPos, mode, brushSize, scale])

  // Re-render on changes
  useEffect(() => {
    if (photoReady) renderDisplay()
  }, [photoReady, renderDisplay])

  // Queue a RAF-throttled render
  const queueRender = useCallback(() => {
    if (renderQueuedRef.current) return
    renderQueuedRef.current = true
    requestAnimationFrame(() => {
      renderQueuedRef.current = false
      renderDisplay()
    })
  }, [renderDisplay])

  function stamp(cx, cy) {
    const r = brushSize
    const value = mode === 'add' ? 1 : 0
    const mask = maskRef.current
    const xmin = Math.max(0, Math.floor(cx - r))
    const xmax = Math.min(imageWidth, Math.ceil(cx + r) + 1)
    const ymin = Math.max(0, Math.floor(cy - r))
    const ymax = Math.min(imageHeight, Math.ceil(cy + r) + 1)
    const r2 = r * r
    for (let y = ymin; y < ymax; y++) {
      for (let x = xmin; x < xmax; x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= r2) mask[y * imageWidth + x] = value
      }
    }
  }

  function interpolateStamp(x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    const step = Math.max(1, brushSize / 4)
    const n = Math.max(1, Math.ceil(dist / step))
    for (let i = 1; i <= n; i++) {
      const t = i / n
      stamp(x1 + dx * t, y1 + dy * t)
    }
  }

  function getImageCoords(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * imageWidth,
      y: ((e.clientY - rect.top) / rect.height) * imageHeight,
    }
  }

  function pushUndo() {
    undoRef.current.push(new Uint8Array(maskRef.current))
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift()
    setUndoDepth(undoRef.current.length)
  }

  function handlePointerDown(e) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    pushUndo()
    const p = getImageCoords(e)
    stamp(p.x, p.y)
    lastPosRef.current = p
    setCursorPos(p)
    queueRender()
  }

  function handlePointerMove(e) {
    const p = getImageCoords(e)
    setCursorPos(p)
    if (drawingRef.current) {
      const last = lastPosRef.current
      if (last) interpolateStamp(last.x, last.y, p.x, p.y)
      lastPosRef.current = p
    }
    queueRender()
  }

  function handlePointerUp() {
    drawingRef.current = false
    lastPosRef.current = null
  }

  function handlePointerLeave() {
    drawingRef.current = false
    lastPosRef.current = null
    setCursorPos(null)
    queueRender()
  }

  function undo() {
    const prev = undoRef.current.pop()
    if (prev) {
      maskRef.current = prev
      setUndoDepth(undoRef.current.length)
      queueRender()
    }
  }

  function reset() {
    if (!confirm('Reset the silhouette to the AI extraction? You will lose your edits.')) return
    maskRef.current = expandInitial()
    undoRef.current = []
    setUndoDepth(0)
    queueRender()
  }

  function handleDone() {
    if (committing) return
    setCommitting(true)
    // Yield two frames so the spinner state actually paints before the
    // bounding-box scan + toDataURL block the main thread.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        commit()
      } finally {
        setCommitting(false)
      }
    }))
  }

  function commit() {
    const mask = maskRef.current
    let minX = imageWidth, minY = imageHeight, maxX = -1, maxY = -1
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        if (mask[y * imageWidth + x]) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) {
      alert('The silhouette is empty. Paint some pixels with the + brush first.')
      return
    }
    const bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    const cropped = new Uint8Array(bbox.w * bbox.h)
    for (let y = 0; y < bbox.h; y++) {
      for (let x = 0; x < bbox.w; x++) {
        cropped[y * bbox.w + x] = mask[(y + bbox.y) * imageWidth + (x + bbox.x)]
      }
    }

    // Build preview by drawing the photo crop then alpha-masking
    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = bbox.w
    previewCanvas.height = bbox.h
    const pctx = previewCanvas.getContext('2d')
    pctx.drawImage(photoRef.current, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
    const imgData = pctx.getImageData(0, 0, bbox.w, bbox.h)
    for (let i = 0; i < cropped.length; i++) {
      if (!cropped[i]) imgData.data[i * 4 + 3] = 0
    }
    pctx.putImageData(imgData, 0, 0)
    const previewUrl = previewCanvas.toDataURL('image/png')

    onCommit({
      mask: cropped,
      width: bbox.w,
      height: bbox.h,
      previewUrl,
      bbox,
      imageWidth,
      imageHeight,
    })
  }

  return (
    <div className="mask-editor">
      <p className="hint">
        Use <strong>+ Add</strong> to paint missing pieces of your pet, or <strong>− Erase</strong> to remove background that snuck in.
        The green tint shows what's currently included.
      </p>
      <div className="toolbar">
        <div className="tools">
          <button
            type="button"
            className={mode === 'add' ? 'tool active' : 'tool'}
            onClick={() => setMode('add')}
          >
            + Add
          </button>
          <button
            type="button"
            className={mode === 'erase' ? 'tool active' : 'tool'}
            onClick={() => setMode('erase')}
          >
            − Erase
          </button>
        </div>
        <label className="brush-size">
          Brush size
          <input
            type="range"
            min="6"
            max="120"
            value={brushSize}
            onChange={(e) => setBrushSize(+e.target.value)}
          />
          <span>{brushSize}px</span>
        </label>
        <div className="history">
          <button type="button" onClick={undo} disabled={undoDepth === 0}>
            <ArrowUUpLeft size={14} weight="bold" />
            <span>Undo</span>
          </button>
          <button type="button" onClick={reset}>Reset image</button>
        </div>
      </div>

      <div className="canvas-wrap" style={{ minHeight: cssH }}>
        {!photoReady && <p className="loading-text">Loading photo…</p>}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{ touchAction: 'none', cursor: 'crosshair', display: photoReady ? 'block' : 'none' }}
        />
      </div>

      <div className="actions">
        <button type="button" className="back" onClick={onCancel} disabled={committing}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={handleDone} disabled={committing}>
          {committing ? (
            <>
              <span className="mask-editor-spinner" aria-hidden="true" />
              <span>Finishing…</span>
            </>
          ) : (
            'Done'
          )}
        </button>
      </div>
    </div>
  )
}
