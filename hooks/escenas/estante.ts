// The shelf scene: one pixel-art object per figure of the session,
// standing on a wooden board, each with its number underneath in a 3x5 pixel
// font. Drawn as one plain SVG image of square pixels.
//
// Everything that moves runs on its own CSS animation, including the cache's
// candle and minutes, so the band need not be redrawn to keep them current.
// While the conversation is compacted the mug fills up again.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, INK, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the board at y 9; the numbers sit under it.
const BOARD_Y = 9

const WOOD = '#A0785A'
const WOOD_DARK = '#7A5A42'
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

// The mug holds this many rows of tea.
const MUG_ROWS = 5

// Context: a mug of tea whose level is the context left; it steams while
// warm and goes cold (no steam) at a quarter or less. While the conversation
// is compacted the mug fills up with hot tea.
const mug = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * MUG_ROWS))
  const isWarm = isCompacting || (left !== null && left > 25)
  const tea = isCompacting
    ? `<g style="${refill(MUG_ROWS - rows)}">${px(x + 5, 8 - MUG_ROWS, 4, MUG_ROWS)}</g>`
    : rows > 0 ? px(x + 5, 8 - rows, 4, rows) : ''
  return `
    <g fill="${CERAMIC}">${px(x + 4, 3, 1, 6)}${px(x + 9, 3, 1, 6)}${px(x + 4, 8, 6, 1)}
      ${px(x + 10, 4, 1, 1)}${px(x + 11, 4, 1, 3)}${px(x + 10, 6, 1, 1)}</g>
    <g fill="${TEA}">${tea}</g>
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
    ${percentText(used === null ? null : 100 - used, x)}`
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
    ${percentText(used === null ? null : 100 - used, x)}`
}

const shelfSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
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
    @keyframes twinkle { 0%, 69.9% { opacity: 1; } 70%, 84.9% { opacity: 0.2; } 85%, 100% { opacity: 1; } }`,
    `
  ${mug(f.contextLeft, 0, f.isCompacting)}
  ${candle(f.cacheLeft, f.cacheTtl, SLOT)}
  ${jar(f.fiveHour, SLOT * 2)}
  ${moon(f.week, SLOT * 3)}
  <g fill="${WOOD}">${px(1, BOARD_Y, WIDTH - 2, 1)}</g>
  <g fill="${WOOD_DARK}">${px(2, BOARD_Y + 1, 1, 1)}${px(WIDTH - 3, BOARD_Y + 1, 1, 1)}</g>`,
  )

export const estante: FigureScene = {
  name: 'shelf',
  label: { es: 'Estante', en: 'Shelf' },
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: shelfSvg,
}
