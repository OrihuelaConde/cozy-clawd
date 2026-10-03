// What the figure scenes share: the layout of four slots, one per figure, with
// its number underneath; the 3x5 pixel font of the numbers; and the cache's
// minutes, which count down by themselves. Square pixels, three CSS pixels each.
// Also what their compact drawings share: the image's size, a figure's steps,
// and the cache's hour in steps.

import type { Figures } from './index'

// CSS pixels per scene pixel.
export const SCALE = 3
// Each figure has a slot this wide; a scene is four slots across.
export const SLOT = 16
export const WIDTH = SLOT * 4
// Two rows above y 0, for flames and steam, then sixteen rows: objects stand
// on whatever the scene puts at y 9 or so, and the numbers sit at y 11 to 15.
export const TOP = -2
export const HEIGHT = 18
export const DIGITS_Y = 11

export const INK = '#B0AEA5'

export const px = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`

const DASH = ['000', '000', '111', '000', '000']

// A 3x5 pixel font for the numbers: each glyph is five rows of three bits.
const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '%': ['101', '001', '010', '100', '101'],
  'm': ['000', '110', '111', '101', '101'],
  '-': DASH,
}

export const glyph = (ch: string, x: number, y: number) =>
  (FONT[ch] ?? DASH)
    .map((row, r) => [...row].map((bit, c) => (bit === '1' ? px(x + c, y + r) : '')).join(''))
    .join('')

// Text in the pixel font, centered in a slot: four pixels per character.
export const pixelText = (text: string, slotX: number) => {
  const width = text.length * 4 - 1
  const x0 = slotX + Math.floor((SLOT - width) / 2)
  return `<g fill="${INK}">${[...text].map((ch, i) => glyph(ch, x0 + i * 4, DIGITS_Y)).join('')}</g>`
}

// How many of a figure's `n` steps the percent left fills: one as soon as
// there is anything, all only near full. From five steps up, 100, 75, 50, 25,
// 10 and 0 each fill a different number.
export const level = (left: number, n: number) => (left <= 0 ? 0 : Math.min(n, Math.ceil((left / 100) * n - 1e-9)))

// A figure's step in a compact scene, from the percent left: 3 above half,
// 2 above a quarter, 1 above nothing, and 0 at nothing or before the first
// reading.
export const stageOf = (left: number | null) => (left === null || left <= 0 ? 0 : left > 50 ? 3 : left > 25 ? 2 : 1)

// A compact scene's image: 40 pixels across and eight down, two to a cell,
// its pixels below a style.
export const smallSceneSvg = (css: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 8" shape-rendering="crispEdges">
  <style>
    g { transform-box: view-box; }
    ${HOUR_CSS}${css}
  </style>${body}
</svg>`

// Keyframes that jump a thing from point to point, each held an equal share
// of the cycle; the points are offsets from where it is drawn.
export const hops = (name: string, points: readonly (readonly [number, number])[]) =>
  `@keyframes ${name} { ${points
    .map(([x, y], i) => `${((i / points.length) * 100).toFixed(2)}% { transform: translate(${x}px, ${y}px); }`)
    .join(' ')} 100% { transform: translate(${points[0]?.[0] ?? 0}px, ${points[0]?.[1] ?? 0}px); } }`

// The steps of the cache's hour in a compact scene, each a group shown in its
// turn by itself (hourSteps).
const HOUR_CSS = `
    .h3, .h2, .h1 { animation-timing-function: steps(1); animation-fill-mode: forwards; }
    .h3 { animation-name: h3; }
    .h2 { animation-name: h2; }
    .h1 { animation-name: h1; }
    @keyframes h3 { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    @keyframes h2 { 0%, 49.9% { opacity: 0; } 50%, 74.9% { opacity: 1; } 75%, 100% { opacity: 0; } }
    @keyframes h1 { 0%, 74.9% { opacity: 0; } 75%, 100% { opacity: 1; } }`

// A cache figure in a compact scene: `steps[0]` while more than half the
// hour is left, `steps[1]` while more than a quarter is, `steps[2]` to the
// end, going from one to the next by themselves; `expired` once the cache
// has, and `steps[0]` before the first answer.
export const hourSteps = (f: Figures, steps: readonly [string, string, string], expired: string) => {
  const left = f.cacheLeft
  if (left === null) {
    return steps[0]
  }
  if (left <= 0) {
    return expired
  }
  const style = `animation-duration: ${f.cacheTtl}s; animation-delay: -${(f.cacheTtl - left).toFixed(1)}s`
  return steps.map((drawing, i) => `<g class="h${3 - i}" style="${style}">${drawing}</g>`).join('')
}

// A figure's percent, or dashes before the first reading.
export const percentText = (n: number | null, slotX: number) => pixelText(n === null ? '--' : `${Math.round(n)}%`, slotX)

// The cache's minutes counting down by themselves: each digit is a window over
// a strip of glyphs, 9 down to 0, rolled one glyph per step by an animation
// whose negative delay starts it at the minutes left. The digits stop at 00.
// Needs COUNTDOWN_CSS in the scene's style.
export const countdown = (left: number, slotX: number) => {
  const x0 = slotX + Math.floor((SLOT - 11) / 2)
  // A whole hour left reads 59m: the tens digit rolls 5 down to 0.
  const shown = Math.min(left, 3600 - 0.001)
  const digit = (x: number, count: number, step: number) => {
    const period = count * step
    const delay = (((period - shown - 0.001) % period) + period) % period
    const strip = Array.from({ length: count }, (_, i) => glyph(String(count - 1 - i), x, DIGITS_Y + i * 6)).join('')
    return `<svg x="${x}" y="${DIGITS_Y}" width="3" height="5" viewBox="${x} ${DIGITS_Y} 3 5" overflow="hidden">
      <g style="animation: roll${count} ${period}s steps(${count}) -${delay.toFixed(3)}s infinite">${strip}</g></svg>`
  }
  return `<g fill="${INK}">
    ${digit(x0, 6, 600)}${digit(x0 + 4, 10, 60)}${glyph('m', x0 + 8, DIGITS_Y)}
  </g>`
}

export const COUNTDOWN_CSS = `
    @keyframes roll10 { from { transform: translateY(0); } to { transform: translateY(-60px); } }
    @keyframes roll6 { from { transform: translateY(0); } to { transform: translateY(-36px); } }`

// A figure refilling while the conversation is compacted: the group holding it
// full is uncovered from the bottom up, from `short` rows below the top, over
// two seconds. Needs REFILL_CSS in the scene's style.
export const refill = (short: number) => `animation: refill${short} 2s steps(${Math.max(1, short)}) both`

export const REFILL_CSS = Array.from({ length: 9 }, (_, n) =>
  `@keyframes refill${n} { from { clip-path: inset(${n}px 0 0 0); } to { clip-path: inset(0 0 0 0); } }`).join('\n    ')

// What sits on top of a refilling figure, a flame or a float, rising with it
// from `short` rows down over the same two seconds. Needs RISE_CSS.
export const rise = (short: number) => `animation: rise${short} 2s steps(${Math.max(1, short)}) both`

export const RISE_CSS = Array.from({ length: 9 }, (_, n) =>
  `@keyframes rise${n} { from { transform: translate(0, ${n}px); } to { transform: translate(0, 0); } }`).join('\n    ')

// The scene's image: its pixels below a style; `g` transforms work in scene pixels.
export const sceneSvg = (css: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${TOP} ${WIDTH} ${HEIGHT}" shape-rendering="crispEdges">
  <style>
    g { transform-box: view-box; }${css}
  </style>${body}
</svg>`
