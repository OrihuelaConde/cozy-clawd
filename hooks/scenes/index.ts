// The scenes the band's right side can be drawn as. Each one draws the same
// meters of the session its own way, as one plain SVG image; the one picked
// last is kept in the plugin's store under `scene`.

import { adventureScene } from './adventure'
import { balconyScene } from './balcony'
import { cyberpunkScene } from './cyberpunk'
import { gamerScene } from './gamer'
import { TEXTS, type Lang, type Words } from '../language'
import { minutesLeft } from './pixels'
import { mateScene } from './mate'
import { shelfScene } from './shelf'
import { steampunkScene } from './steampunk'
import { windowScene } from './window'

// The meters every scene shows.
export type Meters = {
  // Percent of the context window still free.
  contextLeft: number | null
  // Percent used of the five-hour and seven-day limits.
  fiveHour: number | null
  week: number | null
  // Seconds left on the prompt cache; 0 once expired, null before any answer.
  cacheLeft: number | null
  // The cache's whole life, in seconds.
  cacheTtl: number
  // The conversation is being compacted right now: each scene refills its
  // context meter while it lasts.
  isCompacting: boolean
}

export type MeterScene = {
  // What /cozy-clawd-scene takes and the plugin's store keeps.
  name: string
  // The name the picker shows.
  label: Words
  // The drawing's size in its own pixels, and CSS pixels per pixel.
  width: number
  height: number
  scale: number
  svg: (f: Meters) => string
  // The scene in the terminal's small size: square pixels half a cell each
  // (hooks/raster.ts, `halves`), with no numbers, which the band writes
  // under it as text, each centered at its meter's middle (`centers`, in
  // pixels from the left).
  small?: { svg: (f: Meters) => string; centers: readonly number[] }
}

export const METER_SCENES: readonly MeterScene[] = [shelfScene, mateScene, balconyScene, windowScene, adventureScene, gamerScene, cyberpunkScene, steampunkScene]

export const DEFAULT_METER_SCENE = shelfScene

// The scene a stored name names; the default for one no scene has.
export const meterSceneNamed = (name: unknown) => METER_SCENES.find(s => s.name === name) ?? DEFAULT_METER_SCENE

// The meters' numbers as a small scene shows them: a line `columns` wide,
// each number centered at its meter's middle; the cache's minutes
// `elapsed` seconds after `f` was read, as the large scenes' countdown reads
// them.
export const numbersLine = (f: Meters, centers: readonly number[], columns: number, elapsed: number) => {
  const pct = (n: number | null) => (n === null ? '--' : `${Math.round(n)}%`)
  const left = f.cacheLeft === null ? null : f.cacheLeft - elapsed
  const minutes = left === null ? '--' : left <= 0 ? '0m' : `${String(minutesLeft(left)).padStart(2, '0')}m`
  const texts = [pct(f.contextLeft), minutes, pct(f.fiveHour === null ? null : 100 - f.fiveHour), pct(f.week === null ? null : 100 - f.week)]
  const line = Array<string>(columns).fill(' ')
  texts.forEach((text, i) => {
    const start = Math.round((centers[i] ?? 0) - text.length / 2)
    ;[...text].forEach((char, k) => {
      if (start + k >= 0 && start + k < columns) {
        line[start + k] = char
      }
    })
  })
  return line.join('')
}

// The meters in words, for a reader that cannot see the scene.
export const metersAlt = (f: Meters, lang: Lang) => {
  const words = TEXTS[lang].meters
  const pct = (n: number | null) => (n === null ? words.none : `${Math.round(n)}%`)
  const cache = f.cacheLeft === null ? words.none : f.cacheLeft > 0 ? words.minutes(minutesLeft(f.cacheLeft)) : words.expired
  return words.line(pct(f.contextLeft), cache, pct(f.fiveHour === null ? null : 100 - f.fiveHour), pct(f.week === null ? null : 100 - f.week))
}
