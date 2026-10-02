// The scenes the band's right side can be drawn as. Each one draws the same
// figures of the session its own way, as one plain SVG image; the one picked
// last is kept in the plugin's store under `escena`.

import { estante } from './estante'

// The figures every scene shows.
export type Figures = {
  // Percent of the context window still free.
  contextLeft: number | null
  // Percent used of the five-hour and seven-day limits.
  fiveHour: number | null
  week: number | null
  // Seconds left on the prompt cache; 0 once expired, null before any answer.
  cacheLeft: number | null
  // The cache's whole life, in seconds.
  cacheTtl: number
}

export type FigureScene = {
  // What /clawd-escena takes and the plugin's store keeps.
  name: string
  // The name the picker shows.
  label: string
  // The drawing's size in its own pixels, and CSS pixels per pixel.
  width: number
  height: number
  scale: number
  svg: (f: Figures) => string
}

export const FIGURE_SCENES: readonly FigureScene[] = [estante]

export const DEFAULT_FIGURE_SCENE = estante

// The scene a stored name names; the default for one no scene has.
export const figureSceneNamed = (name: unknown) => FIGURE_SCENES.find(s => s.name === name) ?? DEFAULT_FIGURE_SCENE

// The figures in words, for a reader that cannot see the scene.
export const figuresAlt = (f: Figures) => {
  const pct = (n: number | null) => (n === null ? 'sin datos' : `${Math.round(n)}%`)
  const cache = f.cacheLeft === null ? 'sin datos' : f.cacheLeft > 0 ? `${Math.ceil(f.cacheLeft / 60)} min` : 'vencida'
  return `Contexto libre ${pct(f.contextLeft)}, caché ${cache}, límite de 5 h libre ${pct(f.fiveHour === null ? null : 100 - f.fiveHour)}, semana libre ${pct(f.week === null ? null : 100 - f.week)}`
}
