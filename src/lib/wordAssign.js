import { makeRng, pick, weightedTier } from './rng'

const SIZE_TIERS = [
  { label: 'xlarge', weight: 4,  multiplier: 4.0 },
  { label: 'large',  weight: 12, multiplier: 2.5 },
  { label: 'medium', weight: 24, multiplier: 1.5 },
  { label: 'small',  weight: 40, multiplier: 0.9 },
  { label: 'tiny',   weight: 20, multiplier: 0.55 },
]

// Floor multiplier removed: rendered fontSize is clamped to a minimum readable
// pixel size in renderWordCloud, so even the smallest fill tier stays legible.
const FILL_TIERS = [
  { label: 'small',  weight: 30, multiplier: 0.85 },
  { label: 'tiny',   weight: 38, multiplier: 0.6 },
  { label: 'micro',  weight: 32, multiplier: 0.45 },
]

const ROT_TIERS = [
  { label: 0,  weight: 78 },
  { label: 90, weight: 22 },
]

export function assignWords(names, seed, fonts, palette, { fillPasses = 0 } = {}) {
  const rng = makeRng(seed)
  // Normalize: accept either ['foo'] or [{ text:'foo', favorite:true }].
  const normalized = names.map((n) => typeof n === 'string'
    ? { text: n, favorite: false }
    : { text: n.text, favorite: !!n.favorite })

  const xlargeTier = SIZE_TIERS.find((t) => t.label === 'xlarge')

  const assignOne = ({ text, favorite }, tiers, { forceXLarge = false } = {}) => {
    let tier
    if (forceXLarge && xlargeTier) {
      tier = xlargeTier
    } else {
      const tierLabel = weightedTier(rng, tiers)
      tier = tiers.find((t) => t.label === tierLabel)
    }
    const font = pick(rng, fonts)
    return {
      text,
      fontFamily: font.family,
      fontWeight: font.weight,
      color: pick(rng, palette.colors),
      rotation: weightedTier(rng, ROT_TIERS),
      weight: tier.multiplier,
      favorite,
    }
  }

  // Primary pass — every name gets one placement at SIZE_TIERS; favorites are
  // forced to the largest tier so they anchor the silhouette.
  const out = normalized.map((n) => assignOne(n, SIZE_TIERS, { forceXLarge: n.favorite }))
  // Fill passes use small/tiny/micro/nano for everyone (favorites repeat at
  // normal small sizes — the hero word is the primary placement).
  for (let p = 0; p < fillPasses; p++) {
    for (const n of normalized) out.push(assignOne(n, FILL_TIERS))
  }
  return out
}
