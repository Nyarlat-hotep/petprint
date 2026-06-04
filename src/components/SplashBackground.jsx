import { useEffect, useState } from 'react'
import { Cat } from '@phosphor-icons/react'
import { shapeToMaskBitmap } from '../lib/shapeMask'
import WordCloudCanvas from './WordCloudCanvas'
import './SplashBackground.css'

// Nicknames and variations all riffing on a single pet named "Fluffy" —
// showcases how one pet's many names fill the cloud.
const DEMO_NAMES = [
  'Fluffy', 'Fluff', 'Fluffers', 'Fluffster', 'Fluffy Boo', 'Fluffball',
  'Mr. Fluffy', 'Fluffykins', 'Fluffaroo', 'Fluffalump', 'Sir Fluff', 'Fluffy Butt',
  'Fluffington', 'Fluffy Pie', 'Fluffmeister', 'Fluffles', 'Fluffy Bear', 'Fluffanator',
  'Fluffernutter', 'Fluffy Tail', 'Lil Fluff', 'Big Fluff', 'Fluffy Boi', 'Fluffysaurus',
  'Fluffy Bug', 'Fluffy Paws', 'Fluffypants', 'Fluffaluffagus', 'Captain Fluff', 'Fluffy Cloud',
  'Fluffy Moo', 'Fluffernoodle', 'Fluffy Floof', 'Floofy', 'Floof', 'Floofster',
  'Fluffy Bean', 'Fluffy Roo', 'Fluffy Goose', 'Fluffinator', 'Fluffykins Jr.', 'Fluffy Pop',
  'Fluffy Muffin', 'Fluffy Cakes', 'Fluffy Toes', 'Fluffy Nugget', 'Fluffy Wuffy', 'Fluffy McFluff',
]

export default function SplashBackground() {
  const [project, setProject] = useState(null)
  // Animate the cloud's entrance, unless the user prefers reduced motion.
  const animate = typeof window !== 'undefined'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
          <WordCloudCanvas project={project} maxWidth={520} maxHeight={520} animate={animate} />
        </div>
      )}
    </div>
  )
}
