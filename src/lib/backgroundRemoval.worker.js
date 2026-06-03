import {
  removeBackground as imglyRemoveBackground,
  preload as imglyPreload,
} from '@imgly/background-removal'
import { binarize, boundingBox, cropMask } from './mask'

// Single config object reused for both preload and the real run. @imgly
// memoizes its model/session init keyed on JSON.stringify(config) (functions
// like `progress` are dropped by JSON), so preloading warms the exact session
// the run then reuses — no second download or init.
const CONFIG = {
  model: 'isnet_fp16',
  device: 'gpu',
  output: { format: 'image/png', quality: 1 },
}

const progress = (key, current, total) =>
  self.postMessage({ type: 'progress', key, current, total })

// Serialize everything: the ONNX session can only run one inference at a time,
// so overlapping runs (e.g. a cancelled run still finishing when the next
// starts) would throw "session already started". Chaining guarantees one job
// at a time while still reusing the warm, memoized session.
let chain = Promise.resolve()

self.onmessage = (e) => {
  const { type, blob, id } = e.data
  if (type === 'preload') {
    chain = chain.then(() => imglyPreload({ ...CONFIG, progress }).catch(() => {}))
  } else if (type === 'run') {
    chain = chain.then(() => runJob(id, blob))
  }
}

async function runJob(id, blob) {
  try {
    const cutoutBlob = await imglyRemoveBackground(blob, { ...CONFIG, progress })

    // Post-process here so the main thread never touches the full-resolution
    // ImageData. Returns a structured bitmap ready for the project store.
    const bmp = await createImageBitmap(cutoutBlob)
    const full = new OffscreenCanvas(bmp.width, bmp.height)
    const fctx = full.getContext('2d')
    fctx.drawImage(bmp, 0, 0)
    const imgData = fctx.getImageData(0, 0, bmp.width, bmp.height)
    const fullMask = binarize(imgData, 64)
    const bbox = boundingBox(fullMask, bmp.width, bmp.height)
    if (!bbox) {
      throw new Error('No silhouette detected. Try a clearer photo.')
    }
    const cropped = cropMask(fullMask, bmp.width, bbox)

    const preview = new OffscreenCanvas(bbox.w, bbox.h)
    preview.getContext('2d').drawImage(
      full, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h,
    )
    const previewBlob = await preview.convertToBlob({ type: 'image/png' })

    // Transfer the cropped mask buffer to avoid a copy.
    self.postMessage(
      {
        type: 'done',
        id,
        result: {
          mask: cropped,
          width: bbox.w,
          height: bbox.h,
          previewBlob,
          bbox,
          imageWidth: bmp.width,
          imageHeight: bmp.height,
        },
      },
      [cropped.buffer],
    )
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err?.message || String(err) })
  }
}
