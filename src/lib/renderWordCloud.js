import { assignWords } from './wordAssign'
import { makeRng } from './rng'
import { FONTS } from '../styles/fonts'

/**
 * Render a pet-shaped word cloud onto the given canvas.
 *
 * Custom packer (replaces wordcloud2.js which was silently dropping or
 * uniformly shrinking words). Sorts words largest first, then for each word
 * randomly samples candidate positions inside the silhouette and accepts the
 * first one where the word's bounding box (a) fits inside the silhouette and
 * (b) doesn't overlap an already-placed word.
 */
export async function renderWordCloudToCanvas({
  canvas, mask, maskWidth, maskHeight,
  silhouetteImageUrl, silhouetteSvg, silhouetteBbox,
  silhouetteSourceWidth, silhouetteSourceHeight,
  names, seed, style, palette,
}) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')

  await ensureFontsLoaded()

  // Fit silhouette into canvas preserving aspect, with a small safe margin.
  // Word packing always runs against a *centered* silhouette so alignment
  // just translates the result instead of re-rolling the layout.
  const padding = 0.04
  const padX = w * padding
  const padY = h * padding
  const availW = w - padX * 2
  const availH = h - padY * 2
  const scaleFit = Math.min(availW / maskWidth, availH / maskHeight)
  const silW = maskWidth * scaleFit
  const silH = maskHeight * scaleFit

  const centeredSilX = Math.round((w - silW) / 2)
  const centeredSilY = Math.round((h - silH) / 2)

  const alignH = style.alignH || 'center'
  const alignV = style.alignV || 'middle'
  let targetSilX, targetSilY
  if (alignH === 'left') targetSilX = Math.round(padX)
  else if (alignH === 'right') targetSilX = Math.round(w - silW - padX)
  else targetSilX = centeredSilX
  if (alignV === 'top') targetSilY = Math.round(padY)
  else if (alignV === 'bottom') targetSilY = Math.round(h - silH - padY)
  else targetSilY = centeredSilY
  const offsetX = targetSilX - centeredSilX
  const offsetY = targetSilY - centeredSilY

  // Centered scaled mask — drives both packing and tint rendering.
  const scaledMask = new Uint8Array(w * h)
  for (let y = centeredSilY; y < centeredSilY + silH; y++) {
    if (y < 0 || y >= h) continue
    for (let x = centeredSilX; x < centeredSilX + silW; x++) {
      if (x < 0 || x >= w) continue
      const ox = Math.min(maskWidth - 1, Math.floor((x - centeredSilX) / scaleFit))
      const oy = Math.min(maskHeight - 1, Math.floor((y - centeredSilY) / scaleFit))
      scaledMask[y * w + x] = mask[oy * maskWidth + ox]
    }
  }

  // Word occurrences with assigned styles + size tier multipliers. Scale
  // fillPasses so the total number of occurrences (N × (1 + fillPasses))
  // hits a minimum density target — keeps the cloud packed even when the
  // user only typed a handful of names.
  const TARGET_OCCURRENCES = 240
  const n = Math.max(1, names.length)
  const fillPasses = Math.max(16, Math.ceil(TARGET_OCCURRENCES / n) - 1)
  const occurrences = assignWords(names, seed, FONTS, palette, { fillPasses })
  // Convert weight multipliers into actual font sizes (canvas px).
  // Floor at a minimum readable pixel size — scales with canvas so tiny
  // exports don't drop below ~10px, big exports don't keep words tinier
  // than necessary.
  const baseFontUnit = w / 26
  const MIN_FONT_PX = Math.max(11, Math.round(w / 70))
  const words = occurrences.map((a) => ({
    ...a,
    fontSize: Math.max(MIN_FONT_PX, a.weight * baseFontUnit),
  }))

  // Compute placements (no drawing yet; uses ctx only for text measurement).
  // The packer runs the primary words then sweeps any remaining gaps with
  // additional small words drawn from the same name pool.
  const placements = packWords(
    words, scaledMask, w, h, ctx, seed,
    { minFontPx: MIN_FONT_PX, names: occurrences, fonts: FONTS, palette },
  )

  // Compose final canvas: background → silhouette tint → words
  ctx.clearRect(0, 0, w, h)

  // 1. Background
  if (style.backgroundType === 'pattern' && style.backgroundValue) {
    const pat = await loadPattern(style.backgroundValue, palette.colors, palette.bg)
    if (pat) {
      const cssScale = (w / 580) * (style.patternScale || 1) * pat.baseScale
      const pattern = ctx.createPattern(pat.source, 'repeat')
      if (pattern.setTransform) {
        pattern.setTransform(new DOMMatrix().scale(cssScale, cssScale))
      }
      ctx.fillStyle = pattern
    } else {
      ctx.fillStyle = '#ecfeff'
    }
    ctx.fillRect(0, 0, w, h)
    // Apply pattern opacity by overlaying the palette's background tone — the
    // pattern's own background is tinted to that same tone in loadPattern(),
    // so fading just blends the marks toward the bg without re-rasterizing.
    const opacity = Math.max(0, Math.min(1, style.patternOpacity ?? 1))
    if (opacity < 1) {
      ctx.save()
      ctx.globalAlpha = 1 - opacity
      ctx.fillStyle = palette.bg || '#ecfeff'
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
  } else {
    ctx.fillStyle = style.backgroundValue || '#ecfeff'
    ctx.fillRect(0, 0, w, h)
  }

  // 2 & 3. Apply alignment translation, then render tint + words on top.
  ctx.save()
  ctx.translate(offsetX, offsetY)

  if ((style.silhouetteMode || 'tint') === 'tint') {
    const opacity = Math.max(0, Math.min(1, style.silhouetteOpacity ?? 1))
    if (opacity > 0) {
      const usingPattern = style.backgroundType === 'pattern' && style.backgroundValue
      const fillColor = usingPattern
        ? withAlpha(palette.bg || '#ecfeff', opacity)
        : withAlpha(palette.colors[0] || '#1a1a1a', 0.15 * opacity)
      // Feather is specified in canvas pixels at preview resolution (~580px wide).
      // Scale to the actual render width so exports get proportional smoothing.
      const featherCss = Math.max(0, Math.min(4, style.silhouetteFeather ?? 0))
      const featherPx = featherCss * (w / 580)
      const svgStencil = silhouetteSvg && silhouetteBbox
        ? await rasterizeSilhouetteSvg(silhouetteSvg, silhouetteBbox, silhouetteSourceWidth, silhouetteSourceHeight, silW, silH)
        : null
      if (svgStencil) {
        paintSilhouetteFromImage(
          ctx, svgStencil.img, centeredSilX, centeredSilY, silW, silH, fillColor, featherPx,
          svgStencil.sx, svgStencil.sy, svgStencil.sw, svgStencil.sh,
        )
      } else {
        const stencil = silhouetteImageUrl ? await loadImage(silhouetteImageUrl) : null
        if (stencil) {
          paintSilhouetteFromImage(ctx, stencil, centeredSilX, centeredSilY, silW, silH, fillColor, featherPx)
        } else {
          paintSilhouetteFill(ctx, scaledMask, w, h, fillColor)
        }
      }
    }
  }

  for (const p of placements) {
    ctx.save()
    ctx.font = `${p.fontWeight} ${p.fontSize}px "${p.fontFamily}", sans-serif`
    ctx.fillStyle = p.color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.translate(p.cx, p.cy)
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180)
    ctx.fillText(p.text, 0, 0)
    ctx.restore()
  }

  ctx.restore()
}

function packWords(words, mask, maskW, maskH, ctx, seed, fillOpts = {}) {
  const rng = makeRng(seed + 7)
  // Largest first so big anchors place before small ones crowd in. Favorites
  // get sorted up front (even ahead of equal-size non-favorites) so they claim
  // space before the silhouette fills up.
  const sorted = [...words].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return b.fontSize - a.fontSize
  })

  // Measure each word's natural dimensions
  for (const word of sorted) {
    ctx.font = `${word.fontWeight} ${word.fontSize}px "${word.fontFamily}", sans-serif`
    const m = ctx.measureText(word.text)
    word.mw = m.width
    word.mh = word.fontSize * 1.05
  }

  const placed = []
  const result = []
  const padding = 2

  // Try placing a single word at its current measured size + rotation. Returns
  // {cx, cy, x0, y0, x1, y1} on success, null otherwise.
  //
  // Sampling strategy: Archimedean spiral around a random anchor. Each
  // candidate position is adjacent to where the previous one tried, so once
  // the silhouette starts filling up, candidates concentrate next to already-
  // placed words — finding the tight gaps random sampling would miss.
  function tryPlace(word, maxAttempts, padOverride, opts = {}) {
    const pad = padOverride ?? padding
    const skipMask = opts.skipMask === true
    const isRotated = word.rotation === 90
    const boxW = isRotated ? word.mh : word.mw
    const boxH = isRotated ? word.mw : word.mh
    const halfW = boxW / 2
    const halfH = boxH / 2

    // Word is wider than the canvas — no point sampling positions.
    if (boxW > maskW - pad * 2 || boxH > maskH - pad * 2) return null

    // Check a single candidate centre against mask + overlap. Returns hit or null.
    const checkAt = (cx, cy) => {
      const x0 = cx - halfW, y0 = cy - halfH
      const x1 = cx + halfW, y1 = cy + halfH
      if (x0 < pad || y0 < pad || x1 > maskW - pad || y1 > maskH - pad) return null

      // Silhouette containment — only enforced when skipMask is false.
      // Sample density scales with box size (~one sample every 5px) so wide
      // words can't straddle gaps in multi-region shapes (e.g. between paw pads).
      if (!skipMask) {
        const Nx = Math.max(5, Math.ceil(boxW / 5))
        const Ny = Math.max(5, Math.ceil(boxH / 5))
        for (let i = 0; i <= Nx; i++) {
          for (let j = 0; j <= Ny; j++) {
            const sx = Math.floor(x0 + (i / Nx) * boxW)
            const sy = Math.floor(y0 + (j / Ny) * boxH)
            if (sx < 0 || sx >= maskW || sy < 0 || sy >= maskH || !mask[sy * maskW + sx]) return null
          }
        }
      }
      for (const p of placed) {
        if (!(x1 + pad <= p.x0 || x0 >= p.x1 + pad || y1 + pad <= p.y0 || y0 >= p.y1 + pad)) {
          return null
        }
      }
      return { cx, cy, x0, y0, x1, y1 }
    }

    // Spiral parameters. `a` controls radial growth per radian — keep ~1/6 of
    // the smaller dimension so consecutive turns are about one word apart.
    const a = Math.max(1.5, Math.min(boxW, boxH) / 6)
    const arcStepPx = Math.max(3, Math.min(boxW, boxH) / 4)
    const maxRadius = Math.hypot(maskW, maskH)
    // Split the attempt budget across a few anchors so we don't get stuck in
    // one corner if the silhouette is multi-region.
    const ATTEMPTS_PER_ANCHOR = 240
    const numAnchors = Math.max(1, Math.ceil(maxAttempts / ATTEMPTS_PER_ANCHOR))
    let attemptsLeft = maxAttempts

    for (let anchor = 0; anchor < numAnchors && attemptsLeft > 0; anchor++) {
      const ax = halfW + rng() * (maskW - boxW)
      const ay = halfH + rng() * (maskH - boxH)

      // Try the anchor itself first (handy when the anchor is already in a gap).
      attemptsLeft--
      const direct = checkAt(ax, ay)
      if (direct) return direct

      // Spiral outward. Step size in radians = arcStepPx / r so the arc length
      // between checks stays roughly constant as r grows.
      let t = 0
      while (attemptsLeft > 0) {
        // Advance angle by enough to cover ~arcStepPx of arc.
        const r = a * t
        const stepT = Math.max(0.08, arcStepPx / Math.max(r, 1))
        t += stepT
        const r2 = a * t
        if (r2 > maxRadius) break
        const cx = ax + r2 * Math.cos(t)
        const cy = ay + r2 * Math.sin(t)
        attemptsLeft--
        const hit = checkAt(cx, cy)
        if (hit) return hit
      }
    }
    return null
  }

  function remeasure(word) {
    ctx.font = `${word.fontWeight} ${word.fontSize}px "${word.fontFamily}", sans-serif`
    word.mw = ctx.measureText(word.text).width
    word.mh = word.fontSize * 1.05
  }

  for (const word of sorted) {
    let hit = tryPlace(word, 800)

    // Favorites must always appear. If xlarge doesn't fit (e.g. long name on
    // narrow silhouette), try the alternate rotation, then progressively
    // shrink until it either fits or hits a minimum floor (~40% of original).
    if (!hit && word.favorite) {
      const originalSize = word.fontSize
      const originalRot = word.rotation
      const minSize = Math.max(originalSize * 0.4, 24)

      // First try flipping rotation at full size
      word.rotation = originalRot === 90 ? 0 : 90
      hit = tryPlace(word, 400)
      if (!hit) word.rotation = originalRot

      // Then shrink in 15% steps, alternating rotations
      while (!hit && word.fontSize > minSize) {
        word.fontSize *= 0.85
        remeasure(word)
        hit = tryPlace(word, 400)
        if (!hit) {
          word.rotation = word.rotation === 90 ? 0 : 90
          hit = tryPlace(word, 400)
        }
      }
    }

    if (hit) {
      placed.push({ x0: hit.x0, y0: hit.y0, x1: hit.x1, y1: hit.y1 })
      result.push({ ...word, cx: hit.cx, cy: hit.cy })
    }
  }

  const minFontPx = fillOpts.minFontPx

  // ── Guarantee pass ─────────────────────────────────────────────────────
  // Every user-typed name MUST appear at least once, and always inside the
  // silhouette. Cascade:
  //   1. Shrink floor → 30% of floor, both rotations, normal padding
  //   2. Same shrink range, both rotations, zero padding (touching allowed)
  //   3. Eviction: if still no fit, displace a small fill-pass copy whose
  //      text is already represented elsewhere — frees space without losing
  //      any unique name — then retry.
  if (minFontPx) {
    const placedTexts = new Map() // text -> count
    for (const r of result) placedTexts.set(r.text, (placedTexts.get(r.text) || 0) + 1)
    const tried = new Set()
    const shrinkSteps = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3]

    const commit = (word, hit) => {
      placed.push({ x0: hit.x0, y0: hit.y0, x1: hit.x1, y1: hit.y1 })
      result.push({ ...word, cx: hit.cx, cy: hit.cy })
      placedTexts.set(word.text, (placedTexts.get(word.text) || 0) + 1)
    }

    // Try every size × rotation × padding combo for a single guaranteed word.
    // Returns the successful placement or null.
    const exhaustivelyPlace = (sourceWord) => {
      for (const pad of [padding, 0]) {
        for (const scale of shrinkSteps) {
          for (const rot of [0, 90]) {
            const g = { ...sourceWord, fontSize: minFontPx * scale, rotation: rot, favorite: false }
            remeasure(g)
            const hit = tryPlace(g, 800, pad === padding ? undefined : 0)
            if (hit) return { word: g, hit }
          }
        }
      }
      return null
    }

    // Free up space by removing the smallest fill-pass copy whose text appears
    // multiple times. Returns true if eviction happened.
    const evictSurplus = () => {
      let victimIdx = -1
      let victimSize = Infinity
      for (let i = 0; i < result.length; i++) {
        const r = result[i]
        // Must not be the last copy of its text.
        if ((placedTexts.get(r.text) || 0) <= 1) continue
        // Don't evict favorites.
        if (r.favorite) continue
        if (r.fontSize < victimSize) {
          victimSize = r.fontSize
          victimIdx = i
        }
      }
      if (victimIdx < 0) return false
      const victim = result[victimIdx]
      placedTexts.set(victim.text, placedTexts.get(victim.text) - 1)
      result.splice(victimIdx, 1)
      placed.splice(victimIdx, 1)
      return true
    }

    for (const word of words) {
      if (placedTexts.has(word.text) || tried.has(word.text)) continue
      tried.add(word.text)

      let attempt = exhaustivelyPlace(word)
      // Evict surplus duplicates and retry up to a safety cap.
      let evictionsLeft = 40
      while (!attempt && evictionsLeft > 0 && evictSurplus()) {
        evictionsLeft--
        attempt = exhaustivelyPlace(word)
      }
      if (attempt) commit(attempt.word, attempt.hit)
    }
  }

  // ── Gap-fill sweep ─────────────────────────────────────────────────────
  // After the main + guarantee passes, keep stuffing small extras into
  // whatever empty space remains. Stop after N consecutive failures — that
  // means we've saturated and any new word at this min size won't fit.
  if (minFontPx && result.length > 0) {
    // Random size between min and ~2× min, so the fill doesn't look uniform.
    const sizeFloor = minFontPx
    const sizeCeil = minFontPx * 2.1
    const MAX_CONSECUTIVE_FAILS = 60
    const MAX_TOTAL_ATTEMPTS = 800
    let fails = 0
    let total = 0
    while (fails < MAX_CONSECUTIVE_FAILS && total < MAX_TOTAL_ATTEMPTS) {
      total++
      // Pick a random already-placed template so we inherit text/font/color.
      const template = result[Math.floor(rng() * result.length)]
      const fontSize = sizeFloor + rng() * (sizeCeil - sizeFloor)
      const rotation = rng() < 0.78 ? 0 : 90
      const word = { ...template, fontSize, rotation, favorite: false }
      remeasure(word)
      const hit = tryPlace(word, 60)
      if (hit) {
        placed.push({ x0: hit.x0, y0: hit.y0, x1: hit.x1, y1: hit.y1 })
        result.push({ ...word, cx: hit.cx, cy: hit.cy })
        fails = 0
      } else {
        fails++
      }
    }
  }

  return result
}

let _fontsLoadedPromise = null
async function ensureFontsLoaded() {
  if (_fontsLoadedPromise) return _fontsLoadedPromise
  if (!document.fonts || !document.fonts.load) return
  _fontsLoadedPromise = Promise.all(
    FONTS.map((f) => document.fonts.load(`${f.weight} 32px "${f.family}"`).catch(() => null)),
  )
  return _fontsLoadedPromise
}

const _patternCache = new Map()
async function loadPattern(src, paletteColors, paletteBg) {
  const primary = withHexAlpha(paletteColors?.[0] || '#b3c5dc', 0.4)
  const secondary = withHexAlpha(paletteColors?.[1] || paletteColors?.[0] || '#cfdae8', 0.22)
  const bg = paletteBg || '#ecfeff'
  const cacheKey = `${src}|${primary}|${secondary}|${bg}`
  if (_patternCache.has(cacheKey)) return _patternCache.get(cacheKey)

  const HI_RES = 512
  const text = await fetch(src).then((r) => r.text()).catch(() => null)
  let entry = null

  if (text) {
    // Tint pattern marks AND the cream background so the pattern matches the
    // currently selected palette.
    const tinted = text
      .replaceAll(/#d0c8b8/gi, primary)
      .replaceAll(/#e8e3d8/gi, secondary)
      .replaceAll(/#f7f5f0/gi, bg)
    const doc = new DOMParser().parseFromString(tinted, 'image/svg+xml')
    const svg = doc.documentElement
    const naturalSize = parseInt(
      svg.getAttribute('width') ||
        (svg.getAttribute('viewBox') || '').split(/\s+/)[2] ||
        '64',
      10,
    ) || 64
    svg.setAttribute('width', String(HI_RES))
    svg.setAttribute('height', String(HI_RES))
    const xml = new XMLSerializer().serializeToString(svg)
    const img = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    )
    if (img) {
      const sourceSize = Math.max(img.naturalWidth || HI_RES, 1)
      entry = { source: img, baseScale: naturalSize / sourceSize }
    }
  }

  if (!entry) {
    // Fallback: load original SVG as-is (no tint, no upscale).
    const native = await loadImage(src)
    if (!native) return null
    entry = { source: native, baseScale: 1 }
  }

  _patternCache.set(cacheKey, entry)
  return entry
}

function withHexAlpha(color, alphaFraction) {
  if (!color || !color.startsWith('#')) return color
  const expanded = color.length === 4
    ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    : color.slice(0, 7)
  const a = Math.round(Math.max(0, Math.min(1, alphaFraction)) * 255)
    .toString(16)
    .padStart(2, '0')
  return expanded + a
}

function loadImage(src) {
  return new Promise((resolve) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = src
  })
}

function paintSilhouetteFromImage(ctx, img, x, y, w, h, color, featherPx, sx, sy, sw, sh) {
  // Use the source image's alpha channel as a stencil, then recolor via
  // source-in. This preserves the SVG/cutout's anti-aliased edges instead of
  // staircasing them through the binary mask. Optional feather blurs the alpha
  // edge before recoloring so jagged binary masks (e.g. from the brush editor)
  // get smoothed.
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.ceil(w))
  off.height = Math.max(1, Math.ceil(h))
  const octx = off.getContext('2d')
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  if (featherPx && featherPx > 0) octx.filter = `blur(${featherPx}px)`
  if (sx !== undefined) {
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height)
  } else {
    octx.drawImage(img, 0, 0, off.width, off.height)
  }
  octx.filter = 'none'
  octx.globalCompositeOperation = 'source-in'
  octx.fillStyle = color
  octx.fillRect(0, 0, off.width, off.height)
  ctx.drawImage(off, x, y, w, h)
}

async function rasterizeSilhouetteSvg(svgMarkup, bbox, sourceW, sourceH, targetW, targetH) {
  // Re-rasterize the icon SVG at ~2× the display size so the stencil has
  // pixels to spare even on hi-DPI canvases / print exports. Then crop to the
  // bbox region — matches the word-packing mask's coordinate space.
  const supersample = 2
  const scale = (supersample * targetW) / bbox.w
  const fullW = Math.max(1, Math.ceil(sourceW * scale))
  const fullH = Math.max(1, Math.ceil(sourceH * scale))
  const sized = svgMarkup.replace(/<svg([^>]*)>/, (_, attrs) => {
    const stripped = attrs.replace(/\s(width|height)="[^"]*"/g, '')
    return `<svg${stripped} width="${fullW}" height="${fullH}">`
  })
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`)
  if (!img) return null
  return {
    img,
    sx: bbox.x * scale,
    sy: bbox.y * scale,
    sw: bbox.w * scale,
    sh: bbox.h * scale,
  }
}

function paintSilhouetteFill(ctx, scaledMask, w, h, color) {
  // Render the binary silhouette to an offscreen canvas, then drawImage it
  // back through a small blur filter to anti-alias the staircase edge.
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const octx = off.getContext('2d')
  octx.fillStyle = color
  for (let y = 0; y < h; y++) {
    let runStart = -1
    for (let x = 0; x < w; x++) {
      const m = scaledMask[y * w + x]
      if (m && runStart === -1) runStart = x
      else if (!m && runStart !== -1) {
        octx.fillRect(runStart, y, x - runStart, 1)
        runStart = -1
      }
    }
    if (runStart !== -1) octx.fillRect(runStart, y, w - runStart, 1)
  }

  ctx.save()
  // Scale blur with canvas size so high-res exports get proportional smoothing.
  const blurPx = Math.max(0.6, w / 800)
  ctx.filter = `blur(${blurPx}px)`
  ctx.drawImage(off, 0, 0)
  ctx.restore()
}

function withAlpha(color, alpha) {
  if (color.startsWith('#')) {
    let r, g, b
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16)
      g = parseInt(color[2] + color[2], 16)
      b = parseInt(color[3] + color[3], 16)
    } else {
      r = parseInt(color.slice(1, 3), 16)
      g = parseInt(color.slice(3, 5), 16)
      b = parseInt(color.slice(5, 7), 16)
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}
