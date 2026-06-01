// Color picks aim for ≥3:1 contrast on each palette's bg — readable for the
// large+medium tier words in the cloud while staying bright/pastel.
export const PALETTES = [
  { id: 'mono',   label: 'Mono',   colors: ['#111', '#333', '#555', '#888'],                     bg: '#f4f4f5' },
  { id: 'warm',   label: 'Warm',   colors: ['#f43f5e', '#f97316', '#eab308', '#ec4899'],          bg: '#fff7ed' },
  { id: 'cool',   label: 'Cool',   colors: ['#06b6d4', '#3b82f6', '#10b981', '#8b5cf6'],          bg: '#f0f9ff' },
  { id: 'pastel', label: 'Pastel', colors: ['#f9a8d4', '#93c5fd', '#c4b5fd', '#fcd34d'],          bg: '#fdf4ff' },
  { id: 'earth',  label: 'Earth',  colors: ['#84a98c', '#cb997e', '#a98467', '#6b4423'],          bg: '#fefae0' },
  { id: 'air',    label: 'Air',    colors: ['#38bdf8', '#7dd3fc', '#a5b4fc', '#5eead4'],          bg: '#e0f2fe' },
  { id: 'water',  label: 'Water',  colors: ['#0e7490', '#0891b2', '#0284c7', '#155e75'],          bg: '#eff6ff' },
  { id: 'fire',   label: 'Fire',   colors: ['#dc2626', '#f97316', '#f59e0b', '#991b1b'],          bg: '#fff7ed' },
  { id: 'custom', label: 'Custom', custom: true,                                                   bg: '#ecfeff' },
]

export const DEFAULT_CUSTOM_COLORS = ['#ec4899', '#3b82f6', '#a855f7', '#d97706']

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0]
}

export function resolvePalette(style) {
  if (style.paletteId === 'custom') {
    const colors = (style.customPaletteColors && style.customPaletteColors.length)
      ? style.customPaletteColors
      : DEFAULT_CUSTOM_COLORS
    return { id: 'custom', label: 'Custom', colors }
  }
  return paletteById(style.paletteId)
}
