export const initialProject = {
  step: 0,           // 0=Upload 1=Extract 2=Style+Download (names managed inline on step 2)
  currentProjectId: null,   // id of the saved cloud row this state was opened from
  shapeId: null,            // shape preset id when entered via shape picker (null for photo)
  photoBlob: null,
  photoUrl: null,
  maskBitmap: null,
  names: [],
  style: {
    backgroundType: 'color',
    backgroundValue: '#eff6ff',
    patternScale: 1,
    patternOpacity: 1,
    paletteId: 'mono',
    customPaletteColors: ['#a8442a', '#d97742', '#e6c08a', '#5a3a2b'],
    alignH: 'center',     // 'left' | 'center' | 'right'
    alignV: 'middle',     // 'top'  | 'middle' | 'bottom'
    silhouetteMode: 'tint',     // 'tint' | 'none'
    silhouetteOpacity: 0.5,     // 0..1 multiplier on the tint fill alpha
    silhouetteFeather: 0,       // 0..4 px blur applied to silhouette stencil edges
  },
  seed: 1,
  lastExportedAt: null,
}

const MAX_STEP = 2
export const MAX_NAME_LENGTH = 40
export const MAX_NAMES = 40
export const MAX_FAVORITES = 3

function revokeIfBlobUrl(url) {
  if (url && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch { /* ignore */ }
  }
}

function revokeBitmapUrls(bitmap) {
  if (bitmap?.previewUrl) revokeIfBlobUrl(bitmap.previewUrl)
}

export function projectReducer(state, action) {
  switch (action.type) {
    case 'NEXT': return { ...state, step: Math.min(state.step + 1, MAX_STEP) }
    case 'BACK': return { ...state, step: Math.max(state.step - 1, 0) }
    case 'GOTO': return { ...state, step: Math.max(0, Math.min(action.step, MAX_STEP)) }
    case 'SET_PHOTO':
      revokeIfBlobUrl(state.photoUrl)
      revokeBitmapUrls(state.maskBitmap)
      // Keep currentProjectId — swapping the silhouette source is an edit to
      // the open save, not a fresh start. RESET is the only path that clears it.
      return {
        ...state,
        photoBlob: action.blob,
        photoUrl: action.url,
        maskBitmap: null,
        shapeId: null,
      }
    case 'SET_MASK':
      if (state.maskBitmap !== action.bitmap) revokeBitmapUrls(state.maskBitmap)
      return { ...state, maskBitmap: action.bitmap }
    case 'SET_SHAPE':
      revokeIfBlobUrl(state.photoUrl)
      revokeBitmapUrls(state.maskBitmap)
      return {
        ...state,
        photoBlob: null,
        photoUrl: null,
        maskBitmap: action.bitmap,
        shapeId: action.shapeId ?? null,
      }
    case 'LOAD_PROJECT':
      if (action.patch.photoUrl !== undefined && action.patch.photoUrl !== state.photoUrl) {
        revokeIfBlobUrl(state.photoUrl)
      }
      if (action.patch.maskBitmap !== undefined && action.patch.maskBitmap !== state.maskBitmap) {
        revokeBitmapUrls(state.maskBitmap)
      }
      return { ...state, ...action.patch }
    case 'SET_CURRENT_PROJECT_ID': return { ...state, currentProjectId: action.id }
    case 'ADD_NAME': {
      const text = String(action.text || '').trim().slice(0, MAX_NAME_LENGTH)
      if (!text) return state
      if (state.names.length >= MAX_NAMES) return state
      return { ...state, names: [...state.names, { text, allowVertical: true, favorite: false }] }
    }
    case 'REMOVE_NAME': return { ...state, names: state.names.filter((_, i) => i !== action.index) }
    case 'TOGGLE_VERTICAL': return {
      ...state,
      names: state.names.map((n, i) => i === action.index ? { ...n, allowVertical: !n.allowVertical } : n),
    }
    case 'TOGGLE_FAVORITE': {
      const target = state.names[action.index]
      if (!target) return state
      // Adding a new favorite when already at cap is a no-op; unfavoriting is always allowed.
      if (!target.favorite && state.names.filter((n) => n.favorite).length >= MAX_FAVORITES) return state
      return {
        ...state,
        names: state.names.map((n, i) => i === action.index ? { ...n, favorite: !n.favorite } : n),
      }
    }
    case 'SET_STYLE': return { ...state, style: { ...state.style, ...action.patch } }
    case 'REGENERATE': return { ...state, seed: Math.floor(Math.random() * 2 ** 31) }
    case 'RESET':
      revokeIfBlobUrl(state.photoUrl)
      revokeBitmapUrls(state.maskBitmap)
      return { ...initialProject, seed: Math.floor(Math.random() * 2 ** 31) }
    default: return state
  }
}
