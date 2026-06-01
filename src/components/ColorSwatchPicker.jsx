import { useEffect, useRef, useState } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { createPortal } from 'react-dom'
import './ColorSwatchPicker.css'

/**
 * Color swatch + react-colorful popover.
 *
 * Props:
 *   color — current hex (e.g. "#eef4ff")
 *   onChange — called with new hex on every drag
 *   size — swatch px (defaults to 28)
 *   ariaLabel — accessible label for the trigger
 *   align — 'left' | 'right' (default 'left') popover horizontal anchor
 */
export default function ColorSwatchPicker({
  color,
  onChange,
  size = 28,
  ariaLabel = 'Pick color',
  align = 'left',
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  // Position the popover beneath the swatch.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const POPOVER_W = 220
    const margin = 6
    let left = rect.left
    if (align === 'right') left = rect.right - POPOVER_W
    // Clamp inside viewport horizontally.
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8))
    setCoords({ top: rect.bottom + margin, left })
  }, [open, align])

  // Outside-click + Escape to close.
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (popRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="color-swatch-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        style={{ width: size, height: size, background: color }}
      />
      {open && createPortal(
        <div
          ref={popRef}
          className="color-swatch-popover"
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <HexColorPicker color={color} onChange={onChange} />
          <div className="color-swatch-hex-row">
            <span className="color-swatch-hex-hash">#</span>
            <HexColorInput
              color={color}
              onChange={onChange}
              prefixed={false}
              className="color-swatch-hex-input"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
