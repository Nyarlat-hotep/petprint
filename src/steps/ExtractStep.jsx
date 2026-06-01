import { useEffect, useState } from 'react'
import { PencilSimple, ArrowLeft, PawPrint } from '@phosphor-icons/react'
import { removeBackground } from '../lib/backgroundRemoval'
import MaskEditor from '../components/MaskEditor'
import './ExtractStep.css'

export default function ExtractStep({ project, dispatch }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!project.photoBlob) {
      setStatus('idle')
      return
    }
    if (project.maskBitmap) {
      setStatus('done')
      return
    }
    setStatus('working')
    setProgress(null)
    let pending = null
    ;(async () => {
      try {
        pending = removeBackground(project.photoBlob, (key, current, total) => {
          if (!cancelled && total > 0) setProgress({ key, current, total })
        })
        const result = await pending
        if (cancelled) return

        const previewUrl = URL.createObjectURL(result.previewBlob)
        dispatch({
          type: 'SET_MASK',
          bitmap: {
            mask: result.mask,
            width: result.width,
            height: result.height,
            previewUrl,
            bbox: result.bbox,
            imageWidth: result.imageWidth,
            imageHeight: result.imageHeight,
          },
        })
        setStatus('done')
      } catch (e) {
        if (e?.aborted) return // user navigated away — silent
        if (!cancelled) {
          setStatus('error')
          setError(e.message || 'Background removal failed.')
        }
      }
    })()
    return () => {
      cancelled = true
      pending?.cancel?.()
    }
  }, [project.photoBlob, project.maskBitmap, dispatch])

  if (editing && project.maskBitmap?.bbox) {
    return (
      <MaskEditor
        photoUrl={project.photoUrl}
        bitmap={project.maskBitmap}
        onCancel={() => setEditing(false)}
        onCommit={(newBitmap) => {
          dispatch({ type: 'SET_MASK', bitmap: newBitmap })
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="extract-step">
      {status === 'working' && (
        <div className="loading">
          <div className="paw-loader" aria-hidden="true">
            <PawPrint size={28} weight="fill" />
            <PawPrint size={28} weight="fill" />
            <PawPrint size={28} weight="fill" />
            <PawPrint size={28} weight="fill" />
            <PawPrint size={28} weight="fill" />
          </div>
          <p className="loading-text">Sniffing for your pet…</p>
          {progress && progress.key === 'fetch' ? (
            <>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }} />
              </div>
              <p className="loading-sub">Fetching the magic sniffer ({Math.round((progress.current / progress.total) * 100)}%) — only once, then it lives here.</p>
            </>
          ) : (
            <p className="loading-sub">First time? Just fetching the magic sniffer (~30 MB) — only happens once.</p>
          )}
        </div>
      )}
      {status === 'error' && <p className="error">{error}</p>}
      {status === 'done' && project.maskBitmap && (
        <>
          <div className="compare">
            <figure>
              <img src={project.photoUrl} alt="Original" className="thumb" />
            </figure>
            <figure>
              <img src={project.maskBitmap.previewUrl} alt="Silhouette" className="thumb checker" />
            </figure>
          </div>
          <button
            className="refine-link"
            onClick={() => setEditing(true)}
            disabled={!project.maskBitmap?.bbox}
          >
            <PencilSimple size={16} weight="bold" />
            <span>Refine silhouette</span>
          </button>
        </>
      )}
      <div className="step-footer">
        <button className="back" onClick={() => dispatch({ type: 'BACK' })}>
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </button>
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })} disabled={status !== 'done'}>
          That's them!
        </button>
      </div>
    </div>
  )
}
