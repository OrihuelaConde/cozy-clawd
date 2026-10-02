// The shelf scene: one pixel-art object per figure of the session, standing on
// a wooden shelf, each with its number underneath in a 3x5 pixel font: a mug
// of tea for the context, a candle for the prompt cache, a cookie jar for the
// five-hour limit, and a moon lamp for the week. Drawn as one plain SVG image
// of square pixels.
//
// Everything that moves runs on its own CSS animation, including the cache's
// candle and minutes, so the band need not be redrawn to keep them current.
// At a quarter of the context or less a teapot stands beside the mug; while
// the conversation is compacted it pours and the mug fills up again.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, INK, level, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the shelf, whose top is at y 9; the numbers sit under it.
const BOARD_Y = 9

const WOOD = '#A0785A'
const WOOD_DARK = '#7A5A42'
const GRAIN = '#86634A'
const IRON = '#56565E'
const CERAMIC = '#E8E6DC'
const CERAMIC_DARK = '#C4BEAE'
const INSIDE = '#423D37'
const STRIPE = '#D97757'
const TEA = '#C98B4F'
const TEA_TOP = '#DDA468'
const STRING = '#D8D2C0'
const TAG = '#F5C26B'
const POT = '#6A9AB0'
const POT_DARK = '#4F7A8E'
const POT_LIGHT = '#8DB8CB'
const BRASS = '#C9A54A'
const BRASS_DARK = '#9C7E34'
const WAX = '#EFE6D2'
const WAX_LIGHT = '#FFF8E8'
const WAX_SHADE = '#D9CDB4'
const WICK = '#5A3A24'
const FLAME = '#F5C26B'
const FLAME_TIP = '#E8873A'
const GLASS = '#9FB8C4'
const COOKIE = '#C98B4F'
const COOKIE_LIGHT = '#DDA468'
const COOKIE_DARK = '#A06A3A'
const CHIP = '#5A3A24'
const MOON = '#F2E9C9'
const MOON_DARK = '#3A3934'
const STAR = '#F5C26B'

// A round blob of pixels: those whose centers lie within `r` of pixel (cx, cy).
const blob = (cx: number, cy: number, r: number) =>
  Array.from({ length: 2 * Math.floor(r) + 1 }, (_, i) => {
    const dy = i - Math.floor(r)
    const half = Math.floor(Math.sqrt(r * r - dy * dy))
    return px(cx - half, cy + dy, 2 * half + 1, 1)
  }).join('')

// The shelf: a board with a little grain on two iron brackets, a row clear
// of the numbers.
const shelf = () => `
  <g fill="${WOOD}">${px(0, BOARD_Y, WIDTH, 1)}</g>
  <g fill="${GRAIN}">${[4, 5, 13, 22, 23, 30, 38, 45, 46, 53, 60].map(x => px(x, BOARD_Y)).join('')}</g>
  <g fill="${IRON}">${px(SLOT - 1, BOARD_Y + 1, 2, 1)}${px(WIDTH - SLOT - 1, BOARD_Y + 1, 2, 1)}</g>`

// The mug holds this many rows of tea.
const MUG_ROWS = 5
// How far the mug steps right to make room for the teapot.
const ASIDE = 5

// A teapot, its handle to the left and its spout rising to the right toward
// the mug. Low on tea it steams beside the mug; pouring, it is lifted for two
// seconds and a stream of tea runs from its spout into the mug.
const teapot = (x: number, isPouring: boolean) => `
  <g${isPouring ? ' class="lift"' : ''}>
    <g fill="${POT}">${px(x + 1, 4, 5, 1)}${px(x + 1, 5, 4, 3)}${px(x + 6, 5, 1, 2)}${px(x + 7, 3, 1, 2)}</g>
    <g fill="${POT_DARK}">${px(x + 3, 2)}${px(x + 2, 3, 3, 1)}${px(x, 4, 1, 3)}${px(x + 5, 5, 1, 3)}${px(x + 2, 8, 3, 1)}</g>
    <g fill="${POT_LIGHT}">${px(x + 2, 5)}${px(x + 2, 4, 2, 1)}</g>
  </g>
  ${isPouring
    ? `<g class="pour" fill="${TEA_TOP}">${px(x + 8, 1)}${px(x + 9, 2, 1, 6)}</g>`
    : `<g fill="${CERAMIC}" opacity="0.6"><g class="pot-steam">${px(x + 7, 2)}${px(x + 8, 1)}</g></g>`}`

// Context: a mug of tea whose level is the context left, a tea bag's string
// over its rim; it steams while warm and goes cold (no steam) at a quarter or
// less, when a teapot comes to stand beside it. While the conversation is
// compacted the teapot pours and the mug fills up with hot tea.
const mug = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : level(left, MUG_ROWS)
  const hasTeapot = isCompacting || (left !== null && left <= 25)
  const isWarm = isCompacting || (left !== null && left > 25)
  // The mug's left wall; the inside runs five columns from the next.
  const m = x + 3 + (hasTeapot ? ASIDE : 0)
  const fill = (top: number, h: number) => `<g fill="${TEA}">${px(m + 1, top, 5, h)}</g><g fill="${TEA_TOP}">${px(m + 1, top, 5, 1)}</g>`
  const tea = isCompacting
    ? `<g style="${refill(MUG_ROWS - rows)}">${fill(8 - MUG_ROWS, MUG_ROWS)}</g>`
    : rows > 0 ? fill(8 - rows, rows) : ''
  return `
    <g fill="${INSIDE}">${px(m + 1, 2, 5, 6)}</g>
    ${tea}
    <g fill="${CERAMIC}">${px(m, 2, 1, 7)}${px(m, 8, 7, 1)}${px(m + 7, 5)}${px(m + 8, 5, 1, 3)}${px(m + 7, 7)}</g>
    <g fill="${CERAMIC_DARK}">${px(m + 6, 2, 1, 7)}${px(m + 1, 8, 6, 1)}</g>
    <g fill="${STRIPE}">${px(m, 6)}${px(m + 6, 6)}</g>
    <g fill="${STRING}">${px(m + 5, 2)}${px(m + 6, 1, 2, 1)}</g>
    <g fill="${TAG}">${px(m + 7, 2, 2, 2)}</g>
    ${isWarm ? `<g fill="${CERAMIC}" opacity="0.6">
      <g class="steam1">${px(m + 2, 1)}${px(m + 1, 0)}</g>
      <g class="steam2">${px(m + 4, 1)}${px(m + 5, 0)}</g>
    </g>` : ''}
    ${hasTeapot ? teapot(x, isCompacting) : ''}
    ${pixelText(left === null ? '--' : `${left}%`, x)}`
}

// How many rows of wax the candle has, and how many it burns down in steps
// over the cache's hour: five, so that with 100, 75, 50, 25 and 10 percent of
// the hour left it stands at five different heights.
const WAX_ROWS = 6
const BURN = 5

// A brass candleholder: a foot and a cup.
const holder = (x: number) => `
  <g fill="${BRASS_DARK}">${px(x + 4, 8, 7, 1)}</g>
  <g fill="${BRASS}">${px(x + 5, 7, 5, 1)}${px(x + 5, 8, 2, 1)}</g>`

// A candle in its holder, rows of wax from `top` down to the cup, lit from
// the left; a tall one has a drip running from its rim down its shaded side.
const wax = (x: number, top: number) => `
  <g fill="${WAX}">${px(x + 6, top, 3, 7 - top)}</g>
  ${top < 4 ? `<g fill="${WAX_SHADE}">${px(x + 8, top + 3, 1, 4 - top)}</g>` : ''}
  <g fill="${WAX_LIGHT}">${px(x + 6, top, 1, 7 - top)}${px(x + 7, top, 2, 1)}</g>`

// A warm glow around the top of the candle, small enough that a whole
// candle's glow fits under the top of the scene.
const glow = (x: number, y: number) => `
  <g fill="${FLAME}" opacity="0.08">${blob(x, y, 3)}</g>
  <g fill="${FLAME}" opacity="0.08">${blob(x, y, 2)}</g>`

// Cache: a candle in a brass holder that burns down by itself over the
// cache's hour, glowing around its flame, and is out, with a wisp of smoke,
// once the cache has expired.
const candle = (left: number | null, ttl: number, x: number) => {
  const top = 7 - WAX_ROWS
  if (left === null) {
    return `${holder(x)}${wax(x, top)}<g fill="${WICK}">${px(x + 7, top - 1)}</g>${pixelText('--', x)}`
  }
  if (left <= 0) {
    return `
      ${holder(x)}${wax(x, 6)}<g fill="${WICK}">${px(x + 7, 5)}</g>
      <g class="smoke" fill="${INK}" opacity="0.5">${px(x + 7, 3)}${px(x + 8, 2)}${px(x + 7, 1)}</g>
      ${pixelText('0m', x)}`
  }
  const timing = `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  return `
    <g class="sink" style="${timing}">${glow(x + 7, top)}</g>
    ${holder(x)}
    <g class="burn" style="${timing}">${wax(x, top)}</g>
    <g class="sink" style="${timing}">
      <g fill="${WICK}">${px(x + 7, top - 1)}</g>
      <g class="flame">
        <g fill="${FLAME}">${px(x + 7, top - 2)}</g>
        <g fill="${FLAME_TIP}">${px(x + 7, top - 3)}</g>
      </g>
    </g>
    ${countdown(left, x)}`
}

// Where each cookie sits in the jar, by its top left corner, the last one
// eaten first: two on the bottom, one on them, and two on top.
const COOKIES: [number, number][] = [[3, 5], [8, 5], [6, 3], [3, 2], [8, 2]]

// The crumbs on the jar's bottom with no, one or two cookies left.
const CRUMBS: number[][] = [[4, 7, 10], [7, 10], [7]]

// One round cookie, four pixels across and three tall, with a chip; every
// other cookie a shade lighter, so a pile of them reads as separate cookies.
const cookie = (x: number, y: number, i: number) => `
  <g fill="${i % 2 === 0 ? COOKIE : COOKIE_LIGHT}">${px(x + 1, y, 2, 1)}${px(x, y + 1, 4, 1)}${px(x + 1, y + 2, 2, 1)}</g>
  <g fill="${CHIP}">${px(x + (i % 2 === 0 ? 2 : 1), y + 1)}</g>`

// Five-hour limit: a glass jar with a cookie for every fifth of the window
// still free; with two or fewer left, crumbs lie on its bottom.
const jar = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const count = left === null ? 0 : level(left, COOKIES.length)
  return `
    <g fill="${GLASS}" opacity="0.15">${px(x + 3, 2, 9, 6)}</g>
    ${COOKIES.slice(0, count).map(([dx, y], i) => cookie(x + dx, y, i)).join('')}
    ${left === null ? '' : `<g fill="${COOKIE_DARK}">${(CRUMBS[count] ?? []).map(dx => px(x + dx, 7)).join('')}</g>`}
    <g fill="${GLASS}">${px(x + 2, 2, 1, 6)}${px(x + 12, 2, 1, 6)}${px(x + 2, 8, 11, 1)}</g>
    <g fill="${WOOD}">${px(x + 4, 0, 7, 1)}</g><g fill="${WOOD_DARK}">${px(x + 7, -1)}${px(x + 3, 1, 9, 1)}</g>
    <g fill="#FFFFFF" opacity="0.5">${px(x + 11, 5, 1, 2)}</g>
    ${percentText(left, x)}`
}

// The moon's disc, seven pixels across, as [row, first column, last column].
const DISC: [number, number, number][] = [[1, 6, 8], [2, 5, 9], [3, 4, 10], [4, 4, 10], [5, 4, 10], [6, 5, 9], [7, 6, 8]]

// Weekly limit: a moon lamp on a wooden base that wanes from full to new as
// the week's limit is used, its glow shrinking with it, a star twinkling
// beside it.
const moonLamp = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const lit = left === null ? 0 : level(left, 7)
  const firstLit = 11 - lit
  const part = (from: number, to: number) =>
    DISC.map(([y, a, b]) => (Math.min(b, to) >= Math.max(a, from) ? px(x + Math.max(a, from), y, Math.min(b, to) - Math.max(a, from) + 1, 1) : '')).join('')
  const halo = lit > 0
    ? `<g fill="${MOON}" opacity="0.06">${blob(x + 7, 4, 4 + (1.6 * lit) / 7)}</g>
       <g fill="${MOON}" opacity="${((0.08 * lit) / 7).toFixed(3)}">${blob(x + 7, 4, 4.6)}</g>`
    : ''
  return `
    ${halo}
    <g fill="${MOON_DARK}">${part(4, firstLit - 1)}</g>
    <g fill="${MOON}">${part(firstLit, 10)}</g>
    <g fill="${WOOD}">${px(x + 5, 8, 5, 1)}</g><g fill="${IRON}">${px(x + 10, 8, 3, 1)}</g>
    <g class="star" fill="${STAR}">${px(x + 13, 1)}</g>
    ${percentText(left, x)}`
}

const shelfSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    .steam1 { animation: steam 2s steps(4) infinite; }
    .steam2 { animation: steam 2s steps(4) -1s infinite; }
    .pot-steam { animation: steam 2s steps(4) -0.5s infinite; }
    @keyframes steam { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -1px); opacity: 0; } }
    .lift { animation: lift 2s steps(1) both; }
    @keyframes lift { from { transform: translate(0, -2px); } to { transform: translate(0, 0); } }
    .pour { animation: pour 2s steps(1) both; }
    @keyframes pour { from { opacity: 1; } to { opacity: 0; } }
    .burn { animation-name: burn; animation-timing-function: steps(${BURN}); animation-fill-mode: forwards; }
    .sink { animation-name: sink; animation-timing-function: steps(${BURN}); animation-fill-mode: forwards; }
    @keyframes burn { from { transform: translate(0, 0); clip-path: inset(0 0 0 0); } to { transform: translate(0, 0); clip-path: inset(${BURN}px 0 0 0); } }
    @keyframes sink { from { transform: translate(0, 0); } to { transform: translate(0, ${BURN}px); } }
    .flame { animation: flicker 0.6s steps(1) infinite; }
    @keyframes flicker { 0%, 49.9% { transform: translate(0, 0); } 50%, 74.9% { transform: translate(0, 0.5px); } 75%, 100% { transform: translate(0, -0.5px); } }
    .smoke { animation: steam 2.4s steps(4) infinite; }
    .star { animation: twinkle 2.2s steps(1) infinite; }
    @keyframes twinkle { 0%, 69.9% { opacity: 1; } 70%, 84.9% { opacity: 0.2; } 85%, 100% { opacity: 1; } }`,
    `
  ${shelf()}
  ${mug(f.contextLeft, 0, f.isCompacting)}
  ${candle(f.cacheLeft, f.cacheTtl, SLOT)}
  ${jar(f.fiveHour, SLOT * 2)}
  ${moonLamp(f.week, SLOT * 3)}`,
  )

export const shelfScene: FigureScene = {
  name: 'shelf',
  label: { es: 'Estante', en: 'Shelf' },
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: shelfSvg,
}
