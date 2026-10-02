// The cozy shelf on the band's right: one pixel-art object per figure of the
// session, standing on a wooden board, each with its number underneath in a
// 3x5 pixel font. Drawn as one plain SVG image of square pixels.
//
// Everything that moves runs on its own CSS animation, including the cache's
// candle and minutes, so the band need not be redrawn to keep them current.

export type ShelfFigures = {
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

// CSS pixels per shelf pixel.
export const SHELF_SCALE = 3
const SLOT = 16
const HEIGHT = 16
// Objects stand on the board at y 9; the numbers sit under it, y 11 to 15.
const BOARD_Y = 9
const DIGITS_Y = 11

const WOOD = '#A0785A'
const WOOD_DARK = '#7A5A42'
const INK = '#B0AEA5'
const CERAMIC = '#E8E6DC'
const TEA = '#C98B4F'
const WAX = '#EFE6D2'
const FLAME = '#F5C26B'
const FLAME_TIP = '#E8873A'
const GLASS = '#8C8A84'
const COOKIE = '#C98B4F'
const CHIP = '#5A3A24'
const MOON = '#F2E9C9'
const MOON_DARK = '#3A3934'
const STAR = '#F5C26B'

const px = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`

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
  '-': ['000', '000', '111', '000', '000'],
}

const glyph = (ch: string, x: number, y: number) =>
  (FONT[ch] ?? FONT['-'])
    .map((row, r) => [...row].map((bit, c) => (bit === '1' ? px(x + c, y + r) : '')).join(''))
    .join('')

// Text in the pixel font, centered in a slot: four pixels per character.
const pixelText = (text: string, slotX: number) => {
  const width = text.length * 4 - 1
  const x0 = slotX + Math.floor((SLOT - width) / 2)
  return `<g fill="${INK}">${[...text].map((ch, i) => glyph(ch, x0 + i * 4, DIGITS_Y)).join('')}</g>`
}

// The cache's minutes counting down by themselves: each digit is a window over
// a strip of glyphs, 9 down to 0, rolled one glyph per step by an animation
// whose negative delay starts it at the minutes left. The digits stop at 00.
const countdown = (left: number, slotX: number) => {
  const x0 = slotX + Math.floor((SLOT - 11) / 2)
  const digit = (x: number, count: number, step: number) => {
    const period = count * step
    const delay = (((period - left - 0.001) % period) + period) % period
    const strip = Array.from({ length: count }, (_, i) => glyph(String(count - 1 - i), x, DIGITS_Y + i * 6)).join('')
    return `<svg x="${x}" y="${DIGITS_Y}" width="3" height="5" viewBox="${x} ${DIGITS_Y} 3 5" overflow="hidden">
      <g style="animation: roll${count} ${period}s steps(${count}) -${delay.toFixed(3)}s infinite">${strip}</g></svg>`
  }
  return `<g fill="${INK}">
    ${digit(x0, 6, 600)}${digit(x0 + 4, 10, 60)}${glyph('m', x0 + 8, DIGITS_Y)}
  </g>`
}

// Context: a mug of tea whose level is the context left; it steams while
// warm and goes cold (no steam) at a quarter or less.
const mug = (left: number | null, x: number) => {
  const rows = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * 5))
  const isWarm = left !== null && left > 25
  return `
    <g fill="${CERAMIC}">${px(x + 4, 3, 1, 6)}${px(x + 9, 3, 1, 6)}${px(x + 4, 8, 6, 1)}
      ${px(x + 10, 4, 1, 1)}${px(x + 11, 4, 1, 3)}${px(x + 10, 6, 1, 1)}</g>
    <g fill="${TEA}">${rows > 0 ? px(x + 5, 8 - rows, 4, rows) : ''}</g>
    ${isWarm ? `<g fill="${CERAMIC}" opacity="0.6">
      <g class="steam1">${px(x + 6, 1, 1, 1)}${px(x + 5, 0, 1, 1)}</g>
      <g class="steam2">${px(x + 8, 1, 1, 1)}${px(x + 9, 0, 1, 1)}</g>
    </g>` : ''}
    ${pixelText(left === null ? '--' : `${left}%`, x)}`
}

// Cache: a candle that burns down by itself over the cache's hour and is out,
// with a wisp of smoke, once it has expired.
const candle = (left: number | null, ttl: number, x: number) => {
  if (left === null) {
    return `<g fill="${WAX}">${px(x + 6, 2, 3, 7)}</g><g fill="${CHIP}">${px(x + 7, 1, 1, 1)}</g>${pixelText('--', x)}`
  }
  if (left <= 0) {
    return `
      <g fill="${WAX}">${px(x + 6, 8, 3, 1)}</g><g fill="${CHIP}">${px(x + 7, 7, 1, 1)}</g>
      <g class="smoke" fill="${INK}" opacity="0.5">${px(x + 7, 5, 1, 1)}${px(x + 8, 4, 1, 1)}${px(x + 7, 3, 1, 1)}</g>
      ${pixelText('0m', x)}`
  }
  const burnt = ttl - left
  return `
    <g class="wax" style="animation-duration: ${ttl}s; animation-delay: -${burnt}s">
      <g fill="${WAX}">${px(x + 6, 2, 3, 7)}</g>
      <g fill="#FFFFFF" opacity="0.5">${px(x + 6, 2, 1, 7)}</g>
    </g>
    <g class="wick" style="animation-duration: ${ttl}s; animation-delay: -${burnt}s">
      <g fill="${CHIP}">${px(x + 7, 1, 1, 1)}</g>
      <g class="flame">
        <g fill="${FLAME}">${px(x + 7, -1, 1, 2)}</g>
        <g fill="${FLAME_TIP}">${px(x + 7, -2, 1, 1)}</g>
      </g>
    </g>
    ${countdown(left, x)}`
}

// Five-hour limit: a jar with a cookie for every fifth of the window still free.
const jar = (used: number | null, x: number) => {
  const cookies = used === null ? 0 : Math.round(((100 - used) / 100) * 5)
  return `
    <g fill="${WOOD}">${px(x + 4, 2, 7, 1)}</g><g fill="${WOOD_DARK}">${px(x + 6, 1, 3, 1)}</g>
    <g fill="${GLASS}">${px(x + 4, 3, 1, 6)}${px(x + 10, 3, 1, 6)}${px(x + 4, 8, 7, 1)}</g>
    ${Array.from({ length: cookies }, (_, i) => `<g fill="${COOKIE}">${px(x + 5, 7 - i, 5, 1)}</g><g fill="${CHIP}">${px(x + 6 + (i % 3), 7 - i, 1, 1)}</g>`).join('')}
    <g fill="#FFFFFF" opacity="0.4">${px(x + 9, 4, 1, 2)}</g>
    ${pixelText(used === null ? '--' : `${Math.round(100 - used)}%`, x)}`
}

// Weekly limit: a moon that wanes from full to new as the week's limit is used,
// a star twinkling beside it.
const moon = (used: number | null, x: number) => {
  // A disc seven pixels across, as [row, first column, last column].
  const disc: [number, number, number][] = [[2, 6, 8], [3, 5, 9], [4, 4, 10], [5, 4, 10], [6, 4, 10], [7, 5, 9], [8, 6, 8]]
  const lit = used === null ? 7 : Math.round(((100 - used) / 100) * 7)
  const firstLit = 11 - lit
  const rows = disc
    .map(([y, a, b]) => {
      const dark = Math.min(b, firstLit - 1) >= a ? px(x + a, y, Math.min(b, firstLit - 1) - a + 1, 1) : ''
      const light = Math.max(a, firstLit) <= b ? px(x + Math.max(a, firstLit), y, b - Math.max(a, firstLit) + 1, 1) : ''
      return { dark, light }
    })
  return `
    <g fill="${MOON_DARK}">${rows.map(r => r.dark).join('')}</g>
    <g fill="${MOON}">${rows.map(r => r.light).join('')}</g>
    <g class="star" fill="${STAR}">${px(x + 12, 1, 1, 1)}</g>
    ${pixelText(used === null ? '--' : `${Math.round(100 - used)}%`, x)}`
}

export const SHELF_W = SLOT * 4
// Two rows above the objects' tops, for the candle's flame.
export const SHELF_H = HEIGHT + 2

// The shelf in words, for a reader that cannot see it.
export const shelfAlt = (f: ShelfFigures) => {
  const pct = (n: number | null) => (n === null ? 'sin datos' : `${Math.round(n)}%`)
  const cache = f.cacheLeft === null ? 'sin datos' : f.cacheLeft > 0 ? `${Math.ceil(f.cacheLeft / 60)} min` : 'vencida'
  return `Contexto libre ${pct(f.contextLeft)}, caché ${cache}, límite de 5 h libre ${pct(f.fiveHour === null ? null : 100 - f.fiveHour)}, semana libre ${pct(f.week === null ? null : 100 - f.week)}`
}

export const shelfSvg = (f: ShelfFigures) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -2 ${SHELF_W} ${HEIGHT + 2}" shape-rendering="crispEdges">
  <style>
    g { transform-box: view-box; }
    @keyframes roll10 { from { transform: translateY(0); } to { transform: translateY(-60px); } }
    @keyframes roll6 { from { transform: translateY(0); } to { transform: translateY(-36px); } }
    .steam1 { animation: steam 2s steps(4) infinite; }
    .steam2 { animation: steam 2s steps(4) -1s infinite; }
    @keyframes steam { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -1px); opacity: 0; } }
    .wax { animation-name: burn; animation-timing-function: steps(6); animation-fill-mode: forwards; }
    .wick { animation-name: sink; animation-timing-function: steps(6); animation-fill-mode: forwards; }
    @keyframes burn { from { transform: translate(0, 0); clip-path: inset(0 0 0 0); } to { transform: translate(0, 0); clip-path: inset(6px 0 0 0); } }
    @keyframes sink { from { transform: translate(0, 0); } to { transform: translate(0, 6px); } }
    .flame { animation: flicker 0.6s steps(1) infinite; }
    @keyframes flicker { 0%, 49.9% { transform: translate(0, 0); } 50%, 74.9% { transform: translate(0, 0.5px); } 75%, 100% { transform: translate(0, -0.5px); } }
    .smoke { animation: steam 2.4s steps(4) infinite; }
    .star { animation: twinkle 2.2s steps(1) infinite; }
    @keyframes twinkle { 0%, 69.9% { opacity: 1; } 70%, 84.9% { opacity: 0.2; } 85%, 100% { opacity: 1; } }
  </style>
  ${mug(f.contextLeft, 0)}
  ${candle(f.cacheLeft, f.cacheTtl, SLOT)}
  ${jar(f.fiveHour, SLOT * 2)}
  ${moon(f.week, SLOT * 3)}
  <g fill="${WOOD}">${px(1, BOARD_Y, SHELF_W - 2, 1)}</g>
  <g fill="${WOOD_DARK}">${px(2, BOARD_Y + 1, 1, 1)}${px(SHELF_W - 3, BOARD_Y + 1, 1, 1)}</g>
</svg>`
