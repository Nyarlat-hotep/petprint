import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowsClockwise, ArrowLeft, CaretDown, Check, FloppyDisk, Star, X, PencilSimpleLine, DownloadSimple, Printer } from '@phosphor-icons/react'
import { MAX_NAME_LENGTH, MAX_NAMES, MAX_FAVORITES } from '../state/projectStore'
import ColorSwatchPicker from '../components/ColorSwatchPicker'
import { useAuth } from '../state/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { SAVE_CAP } from '../lib/savedProjects'
import { useSavedProjects } from '../state/useSavedProjects'
import SignInModal from '../components/SignInModal'
import SaveDialog from '../components/SaveDialog'
import Snackbar from '../components/Snackbar'
import DonationModal from '../components/DonationModal'
import { PALETTES } from '../styles/palettes'
import { PATTERNS } from '../styles/patterns'
import WordCloudCanvas from '../components/WordCloudCanvas'
import { exportPng, listExportSizes, computeInches, formatInches } from '../lib/export'
import './StyleStep.css'

const EXPORT_SIZES = listExportSizes()

function SizeDropdown({ value, onChange, options, disabled, formatLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`size-dropdown ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="size-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{formatLabel(options.find((s) => s.id === value))} in @ 300 DPI</span>
        <CaretDown size={14} weight="bold" className="size-caret" />
      </button>
      <ul className="size-menu" role="listbox">
        {options.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              role="option"
              aria-selected={s.id === value}
              className={`size-option ${s.id === value ? 'is-selected' : ''}`}
              onClick={() => { onChange(s.id); setOpen(false) }}
            >
              <span>{formatLabel(s)} in @ 300 DPI</span>
              {s.id === value && <Check size={14} weight="bold" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PatternDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((p) => p.url === value) || options[0]

  return (
    <div className={`size-dropdown ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="size-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="pattern-option-label">
          <img src={selected.url} alt="" className="pattern-swatch" />
          {selected.label}
        </span>
        <CaretDown size={14} weight="bold" className="size-caret" />
      </button>
      <ul className="size-menu pattern-menu" role="listbox">
        {options.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="option"
              aria-selected={p.url === value}
              className={`size-option ${p.url === value ? 'is-selected' : ''}`}
              onClick={() => { onChange(p.url); setOpen(false) }}
            >
              <span className="pattern-option-label">
                <img src={p.url} alt="" className="pattern-swatch" />
                {p.label}
              </span>
              {p.url === value && <Check size={14} weight="bold" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlignIcon({ axis, pos }) {
  // 18×18 viewbox: outer rounded square, inner filled rect positioned per axis+pos
  const inner = (() => {
    if (axis === 'h') {
      if (pos === 'left')   return { x: 3,  y: 5, w: 5,  h: 8 }
      if (pos === 'center') return { x: 6.5, y: 5, w: 5, h: 8 }
      if (pos === 'right')  return { x: 10, y: 5, w: 5,  h: 8 }
    } else {
      if (pos === 'top')    return { x: 5, y: 3,  w: 8, h: 5 }
      if (pos === 'middle') return { x: 5, y: 6.5, w: 8, h: 5 }
      if (pos === 'bottom') return { x: 5, y: 10, w: 8, h: 5 }
    }
    return { x: 0, y: 0, w: 0, h: 0 }
  })()
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="1" fill="currentColor" />
    </svg>
  )
}

// Outlined rectangle drawn to a given aspect (w:h), centered in an 18×18 box.
function ShapeIcon({ w, h }) {
  const max = 14
  const scale = max / Math.max(w, h)
  const rw = w * scale
  const rh = h * scale
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect
        x={(18 - rw) / 2}
        y={(18 - rh) / 2}
        width={rw}
        height={rh}
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function AlignmentBar({ style, setStyle, onRegenerate }) {
  const { alignH, alignV } = style
  const portrait = (style.orientation || 'portrait') === 'portrait'
  const isSquare = !!EXPORT_SIZES.find((s) => s.id === style.printSize)?.square
  const hOpts = [
    { id: 'left',   label: 'Align left' },
    { id: 'center', label: 'Align horizontal center' },
    { id: 'right',  label: 'Align right' },
  ]
  const vOpts = [
    { id: 'top',    label: 'Align top' },
    { id: 'middle', label: 'Align vertical middle' },
    { id: 'bottom', label: 'Align bottom' },
  ]
  return (
    <div className="align-bar" role="toolbar" aria-label="Alignment">
      <div className="align-group" role="radiogroup" aria-label="Horizontal alignment">
        <span className="align-label">H</span>
        {hOpts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={alignH === o.id ? 'align-btn active' : 'align-btn'}
            onClick={() => setStyle({ alignH: o.id })}
            data-tip={o.label}
            aria-label={o.label}
            aria-pressed={alignH === o.id}
          >
            <AlignIcon axis="h" pos={o.id} />
          </button>
        ))}
      </div>
      <div className="align-group" role="radiogroup" aria-label="Vertical alignment">
        <span className="align-label">V</span>
        {vOpts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={alignV === o.id ? 'align-btn active' : 'align-btn'}
            onClick={() => setStyle({ alignV: o.id })}
            data-tip={o.label}
            aria-label={o.label}
            aria-pressed={alignV === o.id}
          >
            <AlignIcon axis="v" pos={o.id} />
          </button>
        ))}
      </div>
      <div className="align-group" role="radiogroup" aria-label="Orientation">
        <span className="align-label">Rotate</span>
        <button
          type="button"
          className={portrait && !isSquare ? 'align-btn active' : 'align-btn'}
          onClick={() => setStyle({ orientation: 'portrait' })}
          data-tip="Portrait"
          aria-label="Portrait orientation"
          aria-pressed={portrait}
          disabled={isSquare}
        >
          <ShapeIcon w={4} h={5} />
        </button>
        <button
          type="button"
          className={!portrait && !isSquare ? 'align-btn active' : 'align-btn'}
          onClick={() => setStyle({ orientation: 'landscape' })}
          data-tip="Landscape"
          aria-label="Landscape orientation"
          aria-pressed={!portrait}
          disabled={isSquare}
        >
          <ShapeIcon w={5} h={4} />
        </button>
      </div>
      <button
        type="button"
        className="regen-btn"
        onClick={onRegenerate}
        data-tip="Regenerate cloud"
        aria-label="Regenerate cloud"
      >
        <ArrowsClockwise size={18} weight="bold" />
      </button>
    </div>
  )
}

function NamesPanel({ project, dispatch }) {
  const [draft, setDraft] = useState('')
  const [duplicate, setDuplicate] = useState('')
  const names = project.names
  const atCap = names.length >= MAX_NAMES
  const favoriteCount = names.filter((n) => n.favorite).length
  const favsAtCap = favoriteCount >= MAX_FAVORITES

  function add() {
    const text = draft.trim()
    if (!text || atCap) return
    const exists = names.some((n) => n.text.toLowerCase() === text.toLowerCase())
    if (exists) { setDuplicate(text); return }
    dispatch({ type: 'ADD_NAME', text })
    setDraft('')
    setDuplicate('')
  }

  return (
    <div className="names-panel">
      <div className="names-panel-head">
        <h3>Names</h3>
      </div>
      <p className="names-hint">
        Tap{' '}
        <span className="nobreak">the <Star size={12} weight="fill" /> to</span>
        {' '}make a name a favorite — your favorite names show up biggest.
        ({favoriteCount}/{MAX_FAVORITES})
      </p>
      <input
        type="text"
        placeholder={atCap ? `Plenty of names already!` : 'Add a nickname…'}
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        disabled={atCap}
        onChange={(e) => { setDraft(e.target.value); if (duplicate) setDuplicate('') }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
        }}
      />
      {duplicate && (
        <p className="dup-msg" role="status">
          “{duplicate}” is already in there — you love them, we get it.
        </p>
      )}
      {names.length === 0 ? (
        <p className="names-empty">Hungry for names — feed me some above.</p>
      ) : (
        <ul className="names-chips">
          {names.map((n, i) => {
            const disableStar = !n.favorite && favsAtCap
            return (
              <li key={i} className={`names-chip${n.favorite ? ' is-fav' : ''}`}>
                <button
                  type="button"
                  className="chip-star"
                  onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', index: i })}
                  disabled={disableStar}
                  title={n.favorite
                    ? 'Remove from favorites'
                    : disableStar ? `Up to ${MAX_FAVORITES} favorites` : 'Mark as favorite'}
                  aria-label={n.favorite ? `Unfavorite ${n.text}` : `Favorite ${n.text}`}
                  aria-pressed={n.favorite}
                >
                  <Star size={14} weight={n.favorite ? 'fill' : 'regular'} />
                </button>
                <span className="chip-text">{n.text}</span>
                <button
                  type="button"
                  className="chip-x"
                  onClick={() => dispatch({ type: 'REMOVE_NAME', index: i })}
                  aria-label={`Remove ${n.text}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function StyleStep({ project, dispatch, onSavesChanged }) {
  const setStyle = (patch) => dispatch({ type: 'SET_STYLE', patch })
  const { backgroundType, backgroundValue, paletteId } = project.style
  const silhouetteMode = project.style.silhouetteMode === 'none' ? 'none' : 'tint'

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [donationOpen, setDonationOpen] = useState(false)
  const [actionMode, setActionMode] = useState('download') // 'download' | 'print'
  const [toast, setToast] = useState(null)
  const [canvasBounds, setCanvasBounds] = useState({ width: 780, height: 600 })
  const [namesDrawerOpen, setNamesDrawerOpen] = useState(false)
  const [namesDrawerMounted, setNamesDrawerMounted] = useState(false)

  function openNamesDrawer() {
    setNamesDrawerMounted(true)
    // Next frame so the initial transform/opacity is committed before the
    // .is-open class transitions to the visible state.
    requestAnimationFrame(() => setNamesDrawerOpen(true))
  }
  function closeNamesDrawer() {
    setNamesDrawerOpen(false)
    // Match the longest transition (transform 0.3s) before unmounting.
    setTimeout(() => setNamesDrawerMounted(false), 320)
  }
  const canvasWrapRef = useRef(null)
  const controlsRef = useRef(null)
  // Two heights, both measured off the options column:
  //  • colorOptionsHeight — captured only in color mode. Drives the PREVIEW box,
  //    so the canvas keeps a stable height and never moves/flashes when the
  //    options column grows in pattern mode.
  //  • liveOptionsHeight — the current height in either mode. Drives the NAMES
  //    box so it fills down and stays bottom-aligned with the options column.
  const [colorOptionsHeight, setColorOptionsHeight] = useState(null)
  const [liveOptionsHeight, setLiveOptionsHeight] = useState(null)

  useEffect(() => {
    const el = controlsRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      setLiveOptionsHeight(h)
      if (backgroundType === 'color') setColorOptionsHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [backgroundType])

  // Canvas aspect (w/h) follows the chosen print size + orientation; the
  // silhouette is fit inside and the leftover area becomes background.
  const aspect = useMemo(() => {
    const { wIn, hIn } = computeInches(project.style)
    return wIn / hIn
  }, [project.style.printSize, project.style.orientation])

  // Letterbox the canvas to that aspect within the available wrap bounds.
  const fitted = useMemo(() => {
    const { width, height } = canvasBounds
    if (width / height > aspect) return { w: Math.floor(height * aspect), h: height }
    return { w: width, h: Math.floor(width / aspect) }
  }, [canvasBounds, aspect])

  useEffect(() => {
    const el = canvasWrapRef.current
    // The preview box height is stable across modes (colorOptionsHeight), so the
    // wrap doesn't change when toggling pattern — the canvas size stays put.
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      if (w > 0 && h > 0) {
        setCanvasBounds((prev) => (prev.width === w && prev.height === h) ? prev : { width: w, height: h })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { user } = useAuth()
  const { count, refresh: refreshSaves } = useSavedProjects(user)
  const isEditingExisting = Boolean(project.currentProjectId)
  const atSaveLimit = count >= SAVE_CAP && !isEditingExisting

  async function runDownload() {
    setBusy(true)
    setError(null)
    try {
      const blob = await exportPng(project)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pet-cloud-${formatInches(project.style).replace(/\s|×/g, '')}in.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDonationOpen(false)
    } catch (e) {
      setError(`Could not render at ${formatInches(project.style)} in. Try a smaller size. (${e.message})`)
    } finally {
      setBusy(false)
    }
  }

  async function runPrint() {
    setBusy(true)
    setError(null)
    try {
      const blob = await exportPng(project)
      const url = URL.createObjectURL(blob)

      // Hidden iframe approach — no pop-up blockers, prints in-page.
      // Reuse a stable id so repeat prints don't pile up iframes.
      let iframe = document.getElementById('petprint-print-frame')
      if (iframe) iframe.remove()
      iframe = document.createElement('iframe')
      iframe.id = 'petprint-print-frame'
      Object.assign(iframe.style, {
        position: 'fixed', right: '0', bottom: '0',
        width: '0', height: '0', border: '0', visibility: 'hidden',
      })
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument
      doc.open()
      doc.write(`<!doctype html><html><head><title>Petprint</title>
<style>
  @page { margin: 0.25in; }
  html, body { margin: 0; padding: 0; }
  body { display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
</style></head>
<body><img id="petprint-img" src="${url}" /></body></html>`)
      doc.close()

      const cleanup = () => {
        URL.revokeObjectURL(url)
        // Delay removal so the print dialog doesn't tear out from under itself.
        setTimeout(() => iframe.remove(), 1000)
      }
      const triggerPrint = () => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        } finally {
          cleanup()
        }
      }
      const img = doc.getElementById('petprint-img')
      if (img.complete && img.naturalWidth > 0) triggerPrint()
      else { img.onload = triggerPrint; img.onerror = cleanup }

      setDonationOpen(false)
    } catch (e) {
      setError(`Could not prepare for printing at ${formatInches(project.style)} in. (${e.message})`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="style-step">
      <div
        className="style-grid"
        style={{
          ...(colorOptionsHeight ? { '--preview-h': `${colorOptionsHeight}px` } : {}),
          ...(liveOptionsHeight ? { '--names-h': `${liveOptionsHeight}px` } : {}),
        }}
      >
        <aside className="controls" ref={controlsRef}>
        <fieldset>
          <legend>Background</legend>
          <div className="bg-type">
            <label>
              <input
                type="radio"
                checked={backgroundType === 'color'}
                onChange={() => {
                  const currentPalette = PALETTES.find((p) => p.id === paletteId)
                  setStyle({ backgroundType: 'color', backgroundValue: currentPalette?.bg || '#eff6ff' })
                }}
              />
              Color
            </label>
            <label>
              <input
                type="radio"
                checked={backgroundType === 'pattern'}
                onChange={() => setStyle({ backgroundType: 'pattern', backgroundValue: PATTERNS[0].url })}
              />
              Pattern
            </label>
          </div>

          {backgroundType === 'color' && (
            <div className="bg-color-row">
              <ColorSwatchPicker
                color={backgroundValue}
                onChange={(c) => setStyle({ backgroundValue: c })}
                size={36}
                ariaLabel="Background color"
              />
              <span className="bg-color-hex">{backgroundValue.toUpperCase()}</span>
            </div>
          )}

          {backgroundType === 'pattern' && (
            <>
              <PatternDropdown
                value={backgroundValue}
                onChange={(url) => setStyle({ backgroundValue: url })}
                options={PATTERNS}
              />
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Pattern scale</span>
                  <span className="pattern-scale-value">{(project.style.patternScale ?? 1).toFixed(2)}×</span>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.25"
                  value={project.style.patternScale ?? 1}
                  onChange={(e) => setStyle({ patternScale: parseFloat(e.target.value) })}
                />
              </label>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Pattern opacity</span>
                  <span className="pattern-scale-value">{Math.round((project.style.patternOpacity ?? 1) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={project.style.patternOpacity ?? 1}
                  onChange={(e) => setStyle({ patternOpacity: parseFloat(e.target.value) })}
                />
              </label>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Silhouette</legend>
          <div className="silhouette-modes">
            {[
              { id: 'tint', label: 'Tinted fill' },
              { id: 'none', label: 'None' },
            ].map((m) => (
              <label key={m.id} className="silhouette-mode">
                <input
                  type="radio"
                  checked={silhouetteMode === m.id}
                  onChange={() => setStyle({ silhouetteMode: m.id })}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          {silhouetteMode === 'tint' && (
            <>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Fill opacity</span>
                  <span className="pattern-scale-value">{Math.round((project.style.silhouetteOpacity ?? 1) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={project.style.silhouetteOpacity ?? 1}
                  onChange={(e) => setStyle({ silhouetteOpacity: parseFloat(e.target.value) })}
                />
              </label>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Smooth edges</span>
                  <span className="pattern-scale-value">{(project.style.silhouetteFeather ?? 0).toFixed(1)}px</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={project.style.silhouetteFeather ?? 0}
                  onChange={(e) => setStyle({ silhouetteFeather: parseFloat(e.target.value) })}
                />
              </label>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Palette</legend>
          {PALETTES.map((p) => (
            <label key={p.id} className="palette-row">
              <input
                type="radio"
                checked={paletteId === p.id}
                onChange={() => {
                  const patch = { paletteId: p.id }
                  if (project.style.backgroundType === 'color' && p.bg) {
                    patch.backgroundValue = p.bg
                  }
                  setStyle(patch)
                }}
              />
              <span className="palette-name">{p.label}</span>
              {p.custom ? (
                <span
                  className="swatches custom-swatches"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(project.style.customPaletteColors || []).map((c, i) => (
                    <ColorSwatchPicker
                      key={i}
                      color={c}
                      onChange={(next) => {
                        const cols = [...(project.style.customPaletteColors || [])]
                        cols[i] = next
                        setStyle({ paletteId: 'custom', customPaletteColors: cols })
                      }}
                      size={22}
                      ariaLabel={`Custom color ${i + 1}`}
                      align={i >= 2 ? 'right' : 'left'}
                    />
                  ))}
                </span>
              ) : (
                <span className="swatches">
                  {p.colors.map((c) => <i key={c} style={{ background: c }} />)}
                </span>
              )}
            </label>
          ))}
        </fieldset>

        <fieldset className="download-fieldset">
          <legend>Print size</legend>
          <SizeDropdown
            value={project.style.printSize || '8x10'}
            onChange={(id) => setStyle({ printSize: id })}
            options={EXPORT_SIZES}
            disabled={busy}
            formatLabel={(s) => {
              if (!s) return ''
              if (s.square) return `${s.wIn} × ${s.hIn} (square)`
              const portrait = (project.style.orientation || 'portrait') === 'portrait'
              return portrait ? `${s.wIn} × ${s.hIn}` : `${s.hIn} × ${s.wIn}`
            }}
          />
          {error && <p className="download-error">{error}</p>}
        </fieldset>
        </aside>

        <section className="preview">
          <AlignmentBar
            style={project.style}
            setStyle={setStyle}
            onRegenerate={() => dispatch({ type: 'REGENERATE' })}
          />
          <div className="preview-canvas-wrap" ref={canvasWrapRef}>
            <WordCloudCanvas project={project} maxWidth={fitted.w} maxHeight={fitted.h} />
          </div>
          <button
            type="button"
            className="names-drawer-trigger"
            onClick={openNamesDrawer}
          >
            <PencilSimpleLine size={16} weight="bold" />
            <span>Manage names ({project.names.length})</span>
          </button>
        </section>

        <aside className="names-aside">
          <NamesPanel project={project} dispatch={dispatch} />
        </aside>
      </div>

      {namesDrawerMounted && (
        <div
          className={`names-drawer-backdrop${namesDrawerOpen ? ' is-open' : ''}`}
          onClick={closeNamesDrawer}
        >
          <div
            className={`names-drawer${namesDrawerOpen ? ' is-open' : ''}`}
            role="dialog"
            aria-label="Manage names"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="names-drawer-close"
              onClick={closeNamesDrawer}
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>
            <NamesPanel project={project} dispatch={dispatch} />
          </div>
        </div>
      )}

      <div className="step-footer">
        <button
          className="back"
          onClick={() =>
            project.photoBlob
              ? dispatch({ type: 'BACK' })
              : dispatch({ type: 'GOTO', step: 0 })
          }
          disabled={busy}
        >
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </button>
        <div className="footer-right">
          {isSupabaseConfigured && (
            <button
              className="secondary"
              onClick={() => (user ? setSaveOpen(true) : setSignInOpen(true))}
              disabled={busy || atSaveLimit}
              title={atSaveLimit ? `${SAVE_CAP} of ${SAVE_CAP} saves used — delete one to save another.` : undefined}
              type="button"
            >
              <FloppyDisk size={16} weight="bold" />
              <span>{isEditingExisting ? 'Update' : 'Save'}</span>
            </button>
          )}
          <button
            className="secondary"
            onClick={() => { setActionMode('print'); setDonationOpen(true) }}
            disabled={busy}
            type="button"
          >
            <Printer size={16} weight="bold" />
            <span>Print</span>
          </button>
          <button
            className="primary"
            onClick={() => { setActionMode('download'); setDonationOpen(true) }}
            disabled={busy}
            type="button"
          >
            <DownloadSimple size={16} weight="bold" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSuccess={() => setSaveOpen(true)}
      />
      <SaveDialog
        open={saveOpen && Boolean(user)}
        project={project}
        user={user}
        onClose={() => setSaveOpen(false)}
        onSaved={(saved) => {
          const wasUpdate = Boolean(project.currentProjectId)
          dispatch({ type: 'SET_CURRENT_PROJECT_ID', id: saved.id })
          refreshSaves()
          // Tell App so the header's SavesDropdown re-fetches too —
          // currentProjectId doesn't change on Update, so its own watcher
          // misses the refresh and keeps a stale row in memory.
          onSavesChanged?.()
          setToast(wasUpdate ? 'Cloud refreshed! 🐾' : 'Cloud saved! 🐾')
        }}
      />
      <DonationModal
        open={donationOpen}
        busy={busy}
        mode={actionMode}
        onDownload={actionMode === 'print' ? runPrint : runDownload}
        onSkip={() => setDonationOpen(false)}
      />
      <Snackbar message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
