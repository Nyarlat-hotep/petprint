import { useEffect, useRef, useState } from 'react'
import { PawPrint } from '@phosphor-icons/react'
import './PawCursor.css'

// Distance in pixels the cursor must travel between paw drops. Lower = denser
// trail. ~32px feels like a walking gait without flooding the DOM.
const STEP_PX = 32
// How long each paw lingers before unmounting (matches CSS fade duration).
const LIFESPAN_MS = 700
// Trail alternates left/right paw slightly off-axis from the cursor to mimic
// real paw prints rather than a single line.
const SIDE_OFFSET_PX = 10

export default function PawCursor({ colors }) {
  const [paws, setPaws] = useState([])
  const lastRef = useRef({ x: -1, y: -1 })
  const sideRef = useRef(1)
  const idRef = useRef(0)
  const enabledRef = useRef(true)
  // Latest palette colors, read inside the (one-time) mousemove handler so the
  // trail recolors live when the user changes palette.
  const colorsRef = useRef(colors)
  colorsRef.current = (colors && colors.length) ? colors : ['#0259DD']

  useEffect(() => {
    // Touch-only devices don't have a meaningful cursor — skip.
    if (window.matchMedia('(hover: none)').matches) {
      enabledRef.current = false
      return
    }

    function onMove(e) {
      const { x, y } = lastRef.current
      if (x < 0) {
        lastRef.current = { x: e.clientX, y: e.clientY }
        return
      }
      const dx = e.clientX - x
      const dy = e.clientY - y
      const dist = Math.hypot(dx, dy)
      if (dist < STEP_PX) return

      // Place the paw perpendicular to motion direction so the trail
      // staggers left-right like real footprints.
      const nx = -dy / dist
      const ny = dx / dist
      const offset = SIDE_OFFSET_PX * sideRef.current
      const pals = colorsRef.current
      const paw = {
        id: ++idRef.current,
        x: e.clientX + nx * offset,
        y: e.clientY + ny * offset,
        // Rotate roughly along travel direction with a slight stagger.
        rot: (Math.atan2(dy, dx) * 180) / Math.PI + 90 + sideRef.current * 8,
        // Cycle through the palette so consecutive paws vary in color.
        color: pals[idRef.current % pals.length],
      }
      sideRef.current *= -1
      lastRef.current = { x: e.clientX, y: e.clientY }

      setPaws((prev) => [...prev, paw])
      setTimeout(() => {
        setPaws((prev) => prev.filter((p) => p.id !== paw.id))
      }, LIFESPAN_MS)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  if (!enabledRef.current) return null

  return (
    <div className="paw-cursor-layer" aria-hidden="true">
      {paws.map((p) => (
        <span
          key={p.id}
          className="paw-cursor-print"
          style={{
            left: p.x,
            top: p.y,
            color: p.color,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
          }}
        >
          <PawPrint size={16} weight="fill" />
        </span>
      ))}
    </div>
  )
}
