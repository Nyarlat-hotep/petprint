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
    // The model downloads as several assets, each reporting its own bytes.
    // Aggregate them into one overall percentage so the bar moves smoothly.
    const fetchTotals = {}
    ;(async () => {
      try {
        pending = removeBackground(project.photoBlob, (key, current, total) => {
          if (cancelled) return
          if (key.startsWith('fetch:')) {
            fetchTotals[key] = { current, total }
            let c = 0, t = 0
            for (const k in fetchTotals) { c += fetchTotals[k].current; t += fetchTotals[k].total }
            if (t > 0) setProgress({ phase: 'fetch', pct: Math.min(100, Math.round((c / t) * 100)) })
          } else if (key.startsWith('compute:') && total > 0) {
            setProgress({ phase: 'compute', pct: Math.min(100, Math.round((current / total) * 100)) })
          }
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
          {progress && progress.phase === 'fetch' ? (
            <>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="loading-sub">Fetching the magic sniffer ({progress.pct}%) — only once, then it lives here.</p>
            </>
          ) : progress && progress.phase === 'compute' ? (
            <>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="loading-sub">Found them — tracing the outline…</p>
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
