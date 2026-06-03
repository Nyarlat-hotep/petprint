import BackgroundRemovalWorker from './backgroundRemoval.worker.js?worker'

// One persistent worker for the whole session. The model (~30 MB) and the
// ONNX session are downloaded/built once and reused across runs — so prefetch
// during the upload step makes the actual extraction near-instant.
let worker = null
let prefetched = false

function getWorker() {
  if (!worker) worker = new BackgroundRemovalWorker()
  return worker
}

/**
 * Warm the model + session ahead of the extraction step. Safe to call multiple
 * times — only the first kicks off the (single) download. Fire-and-forget.
 */
export function prefetchModel() {
  if (prefetched) return Promise.resolve()
  prefetched = true
  try { getWorker().postMessage({ type: 'preload' }) } catch { /* ignore */ }
  return Promise.resolve()
}

let nextId = 0

/**
 * Runs background removal in the shared worker. Returns a cancellable promise:
 *   const p = removeBackground(blob, onProgress); ...later: p.cancel()
 *
 * `cancel()` detaches from the in-flight result (the worker keeps its warm
 * session for next time) and rejects with an Error tagged `aborted: true`.
 */
export function removeBackground(blob, onProgress) {
  const w = getWorker()
  const id = ++nextId
  let settled = false
  let rejectFn = null

  function detach() {
    w.removeEventListener('message', onMessage)
    w.removeEventListener('error', onError)
  }

  function onMessage(e) {
    const msg = e.data
    if (msg.type === 'progress') {
      if (!settled) onProgress?.(msg.key, msg.current, msg.total)
      return
    }
    if (msg.id !== id || settled) return // stale/cancelled run finishing late
    settled = true
    detach()
    if (msg.type === 'done') resolveFn(msg.result)
    else if (msg.type === 'error') rejectFn(new Error(msg.message))
  }

  function onError(err) {
    if (settled) return
    settled = true
    detach()
    rejectFn(err instanceof Error ? err : new Error(err.message || 'Worker error'))
  }

  let resolveFn = null
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ type: 'run', id, blob })
  })

  function cancel() {
    if (settled) return
    settled = true
    detach()
    const err = new Error('Background removal cancelled.')
    err.aborted = true
    rejectFn(err)
  }

  promise.cancel = cancel
  return promise
}
