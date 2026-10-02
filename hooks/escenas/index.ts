// The scenes the band's right side can be drawn as. Each one draws the same
// figures of the session its own way, as one plain SVG image; the one picked
// last is kept in the plugin's store under `escena`.

import { aventura } from './aventura'
import { balcon } from './balcon'
import { cyberpunk } from './cyberpunk'
import { estante } from './estante'
import { gamer } from './gamer'
import { mateada } from './mateada'
import { steampunk } from './steampunk'
import { ventana } from './ventana'
import type { Lang, Words } from '../idioma'

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
  // The conversation is being compacted right now: each scene refills its
  // context figure while it lasts.
  isCompacting: boolean
}

export type FigureScene = {
  // What /cozy-clawd-scene takes and the plugin's store keeps.
  name: string
  // The name the picker shows.
  label: Words
  // The drawing's size in its own pixels, and CSS pixels per pixel.
  width: number
  height: number
  scale: number
  svg: (f: Figures) => string
}

export const FIGURE_SCENES: readonly FigureScene[] = [estante, mateada, balcon, ventana, aventura, gamer, cyberpunk, steampunk]

export const DEFAULT_FIGURE_SCENE = estante

// The scene a stored name names; the default for one no scene has.
export const figureSceneNamed = (name: unknown) => FIGURE_SCENES.find(s => s.name === name) ?? DEFAULT_FIGURE_SCENE

// The figures in words, for a reader that cannot see the scene.
export const figuresAlt = (f: Figures, lang: Lang) => {
  const words = ALT[lang]
  const pct = (n: number | null) => (n === null ? words.none : `${Math.round(n)}%`)
  const cache = f.cacheLeft === null ? words.none : f.cacheLeft > 0 ? `${Math.ceil(f.cacheLeft / 60)} min` : words.expired
  return words.line(pct(f.contextLeft), cache, pct(f.fiveHour === null ? null : 100 - f.fiveHour), pct(f.week === null ? null : 100 - f.week))
}

const ALT: Record<Lang, { none: string; expired: string; line: (context: string, cache: string, fiveHour: string, week: string) => string }> = {
  es: {
    none: 'sin datos',
    expired: 'vencida',
    line: (context, cache, fiveHour, week) => `Contexto libre ${context}, caché ${cache}, límite de 5 h libre ${fiveHour}, semana libre ${week}`,
  },
  en: {
    none: 'no data',
    expired: 'expired',
    line: (context, cache, fiveHour, week) => `Context free ${context}, cache ${cache}, 5-hour limit free ${fiveHour}, week free ${week}`,
  },
}
