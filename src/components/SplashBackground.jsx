import { useEffect, useState } from 'react'
import { Cat } from '@phosphor-icons/react'
import { shapeToMaskBitmap } from '../lib/shapeMask'
import WordCloudCanvas from './WordCloudCanvas'
import './SplashBackground.css'

const DEMO_NAMES = [
  'Whiskers', 'Mittens', 'Tigger', 'Princess', 'Shadow', 'Pumpkin',
  'Mochi', 'Sir Fluff', 'Biscuit', 'Pepper', 'Luna', 'Oliver',
  'Bean', 'Noodle', 'Pickle', 'Mr. Boots', 'Boo', 'Cinder',
  'Smokey', 'Ginger', 'Marble', 'Toffee', 'Hazel', 'Fig',
  'Clover', 'Sunny', 'Tofu', 'Dumpling', 'Mango', 'Olive',
  'Pip', 'Sage', 'Wren', 'Honey', 'Maple', 'Cricket',
  'Goose', 'Pebble', 'Salt', 'Pepper', 'Cosmo', 'Atlas',
  'Snickers', 'Waffle', 'Pancake', 'Muffin', 'Mochi', 'Coco',
]

export default function SplashBackground() {
  const [project, setProject] = useState(null)

  useEffect(() => {
    let cancelled = false
    shapeToMaskBitmap(Cat).then((bitmap) => {
      if (cancelled) return
      setProject({
        maskBitmap: bitmap,
        names: DEMO_NAMES.map((text) => ({ text, allowVertical: true })),
        seed: 2026,
        style: {
          backgroundType: 'color',
          backgroundValue: 'transparent',
          paletteId: 'cool',
          customPaletteColors: [],
          patternScale: 1,
          patternOpacity: 1,
          alignH: 'center',
          alignV: 'middle',
          silhouetteMode: 'tint',
          silhouetteOpacity: 0.45,
        },
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="splash-showcase" aria-hidden="true">
      {project && (
        <div className="splash-showcase-cloud">
          <WordCloudCanvas project={project} maxWidth={520} maxHeight={520} />
        </div>
      )}
    </div>
  )
}
