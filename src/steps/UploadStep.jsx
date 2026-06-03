import { useRef, useState } from 'react'
import { Camera, CaretDown } from '@phosphor-icons/react'
import { isHeic } from '../lib/savedProjects'
import { prefetchModel } from '../lib/backgroundRemoval'
import { shapeToMaskBitmap } from '../lib/shapeMask'
import { SHAPES } from '../styles/shapes'
import './UploadStep.css'

export default function UploadStep({ project, dispatch }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [loadingShape, setLoadingShape] = useState(null)
  const recentDropRef = useRef(false)

  function handleFile(file) {
    if (!file) return
    if (isHeic(file)) {
      setError('Oof, HEIC isn’t my favorite — export the photo as JPEG or PNG first.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Hmm, that doesn’t look like a photo.')
      return
    }
    const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
    if (file.size > MAX_BYTES) {
      setError(`Whoa, that photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — try one under 20 MB.`)
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    dispatch({ type: 'SET_PHOTO', blob: file, url })
  }

  async function pickShape(shape) {
    if (loadingShape) return
    setLoadingShape(shape.id)
    setError(null)
    try {
      const bitmap = await shapeToMaskBitmap(shape.Icon)
      dispatch({ type: 'SET_SHAPE', bitmap, shapeId: shape.id })
      dispatch({ type: 'GOTO', step: 2 })
    } catch (e) {
      setError(`Couldn't fetch that shape: ${e.message}`)
      setLoadingShape(null)
    }
  }

  return (
    <div className="upload-step">
      <p className="upload-hint">
        Pick a shape or upload a photo — whatever you choose becomes the
        silhouette your word cloud is packed into.
      </p>
      <div className="shapes-section">
        <div className="shapes-grid">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`shape-tile ${loadingShape === s.id ? 'is-loading' : ''}`}
              onClick={() => pickShape(s)}
              disabled={loadingShape !== null}
              title={s.label}
              aria-label={s.label}
            >
              <s.Icon size={36} weight="fill" />
              <span className="shape-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shapes-divider"><span>or upload your own image</span></div>

      <div
        className={`drop-zone ${dragOver ? 'is-over' : ''} ${project.photoUrl ? 'has-photo' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); prefetchModel() }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          recentDropRef.current = true
          setTimeout(() => { recentDropRef.current = false }, 500)
          handleFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => {
          if (recentDropRef.current) return
          // User intends to use a photo — start warming the model now so the
          // ~30 MB download overlaps with them browsing for / reviewing a file.
          prefetchModel()
          inputRef.current?.click()
        }}
      >
        {project.photoUrl ? (
          <img src={project.photoUrl} alt="Uploaded pet" className="preview" />
        ) : (
          <div className="prompt">
            <p><strong>Drop a photo of your fur baby here</strong></p>
            <p className="muted">or click to fetch one</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          hidden
        />
      </div>
      {error && <p className="error">{error}</p>}

      <div className={`tips ${tipsOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="tips-summary"
          onClick={() => setTipsOpen((o) => !o)}
          aria-expanded={tipsOpen}
        >
          <span className="tips-title">
            <Camera size={18} weight="bold" />
            Tips for the best silhouette
          </span>
          <span className="tips-chevron" aria-hidden="true">
            <CaretDown size={16} weight="bold" />
          </span>
        </button>
        <div className="tips-content">
          <div className="tips-inner">
            <ul>
              <li>Pick a photo with one clear subject — your pet, centered</li>
              <li>A plain, uncluttered background works best (grass, wall, floor)</li>
              <li>Good lighting helps — avoid backlit shots and deep shadows</li>
              <li>The whole pet should be in frame, ideally not cropped at edges</li>
              <li>Side or 3/4 profiles often look better than head-on shots</li>
            </ul>
          </div>
        </div>
      </div>

      {project.photoUrl && (
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })}>Continue</button>
      )}
    </div>
  )
}
