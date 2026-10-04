// The teatime scene: one pixel-art object per meter of the session, standing on
// a wooden shelf, each with its number underneath in a 3x5 pixel font: a mug
// of tea for the context, a clock that times the tea hour for the prompt
// cache, a cookie jar for the five-hour limit, and a box of tea bags for the
// week. Drawn as one plain SVG image of square pixels.
//
// Everything that moves runs on its own CSS animation, including the cache's
// timer and minutes, so the band need not be redrawn to keep them current.
// At a quarter of the context or less a teapot stands beside the mug; while
// the conversation is compacted it pours and the mug fills up again.

import { wordsOf } from '../language'
import type { MeterScene, Meters } from './index'
import { countdown, COUNTDOWN_CSS, HEIGHT, hourSteps, level, percentText, pixelText, px, refill, REFILL_CSS, runsLow, SCALE, sceneSvg, SLOT, smallSceneSvg, stageOf, WIDTH } from './pixels'

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
const FACE = '#F4EEDC'
const HAND = '#423D37'
const GLASS = '#9FB8C4'
const COOKIE = '#C98B4F'
const COOKIE_LIGHT = '#DDA468'
const COOKIE_DARK = '#A06A3A'
const CHIP = '#5A3A24'
const BOX = '#5E8C6A'
const BOX_DARK = '#46705A'
const BAG = '#EFE3C8'
const BAG_DARK = '#D9C9A8'

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
  const rows = level(left, MUG_ROWS)
  const hasTeapot = isCompacting || runsLow(left)
  const isWarm = isCompacting || !runsLow(left)
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

// The timer's disc goes by in eighths of the cache's life.
const EIGHTHS = 8

// A brass clock's case and cream face, nine pixels across, centered on
// (cx, cy), with the marks at twelve, three, six and nine.
const clockFace = (cx: number, cy: number) => `
  <g fill="${BRASS}">${px(cx - 1, cy - 4, 3, 1)}${px(cx - 2, cy - 3)}${px(cx - 3, cy - 2)}${px(cx - 4, cy - 1, 1, 3)}${px(cx - 3, cy + 2)}${px(cx - 2, cy + 3)}${px(cx + 2, cy - 3)}${px(cx + 3, cy - 2)}</g>
  <g fill="${BRASS_DARK}">${px(cx + 4, cy - 1, 1, 3)}${px(cx + 3, cy + 2)}${px(cx + 2, cy + 3)}${px(cx - 1, cy + 4, 3, 1)}${px(cx, cy - 5)}${px(cx - 3, cy + 5, 7, 1)}</g>
  <g fill="${FACE}">${px(cx - 1, cy - 3, 3, 1)}${px(cx - 2, cy - 2, 5, 1)}${px(cx - 3, cy - 1, 7, 3)}${px(cx - 2, cy + 2, 5, 1)}${px(cx - 1, cy + 3, 3, 1)}</g>
  <g fill="${CERAMIC_DARK}">${px(cx, cy - 3)}${px(cx + 3, cy)}${px(cx, cy + 3)}${px(cx - 3, cy)}</g>`

// The face's pixels, as [row, first column, last column] from its center:
// seven across in the large size, five in the small one.
type FaceRows = readonly (readonly [number, number, number])[]
const FACE_ROWS: FaceRows = [[-3, -1, 1], [-2, -2, 2], [-1, -3, 3], [0, -3, 3], [1, -3, 3], [2, -2, 2], [3, -1, 1]]
const SMALL_FACE_ROWS: FaceRows = [[-2, -1, 1], [-1, -2, 2], [0, -2, 2], [1, -2, 2], [2, -1, 1]]

// What is left of the tea hour on a face, as a timer's colored disc: the
// pixels at or past `from` (a share of the hour, clockwise from twelve) round
// to twelve, the center aside.
const timeLeft = (rows: FaceRows, cx: number, cy: number, from: number) =>
  `<g fill="${STRIPE}">${rows
    .flatMap(([dy, a, b]) =>
      Array.from({ length: b - a + 1 }, (_, k) => a + k)
        .filter(dx => (dx !== 0 || dy !== 0) && ((Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1) >= from - 1e-9)
        .map(dx => px(cx + dx, cy + dy)),
    )
    .join('')}</g>`

// Cache: the hour of tea on a brass clock that works as a timer. While the
// cache lives a colored disc on its face shows the time left, an eighth of
// it going by itself at each eighth of the cache's life, clockwise from
// twelve; once the cache expires the face is bare and says six: the tea hour
// is over. Before the first answer the disc is whole.
const clock = (left: number | null, ttl: number, x: number) => {
  const cx = x + 7
  const cy = 3
  const pin = `<g fill="${HAND}">${px(cx, cy)}</g>`
  if (left === null) {
    return `${clockFace(cx, cy)}${timeLeft(FACE_ROWS, cx, cy, 0)}${pin}${pixelText('--', x)}`
  }
  if (left <= 0) {
    return `${clockFace(cx, cy)}<g fill="${HAND}">${px(cx, cy - 2, 1, 5)}</g>${pixelText('0m', x)}`
  }
  const timing = `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  return `
    ${clockFace(cx, cy)}
    ${Array.from({ length: EIGHTHS }, (_, i) => `<g class="e${i}" style="${timing}">${timeLeft(FACE_ROWS, cx, cy, i / EIGHTHS)}</g>`).join('')}
    ${pin}
    ${countdown(left, x)}`
}

// The keyframes that show each eighth of the timer's disc going for its
// eighth of the cache's life, the last one to the end.
const EIGHTHS_CSS = Array.from({ length: EIGHTHS }, (_, i) => {
  const from = (i * 100) / EIGHTHS
  const to = ((i + 1) * 100) / EIGHTHS
  const shown = i === EIGHTHS - 1 ? `${from}%, 100% { opacity: 1; }` : `${from}%, ${to - 0.1}% { opacity: 1; } ${to}%, 100% { opacity: 0; }`
  return `
    .e${i} { animation-name: e${i}; animation-timing-function: steps(1); animation-fill-mode: forwards; }
    @keyframes e${i} { ${i === 0 ? '' : `0%, ${from - 0.1}% { opacity: 0; } `}${shown} }`
}).join('')

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
  const count = level(left, COOKIES.length)
  return `
    <g fill="${GLASS}" opacity="0.15">${px(x + 3, 2, 9, 6)}</g>
    ${COOKIES.slice(0, count).map(([dx, y], i) => cookie(x + dx, y, i)).join('')}
    <g fill="${COOKIE_DARK}">${(CRUMBS[count] ?? []).map(dx => px(x + dx, 7)).join('')}</g>
    <g fill="${GLASS}">${px(x + 2, 2, 1, 6)}${px(x + 12, 2, 1, 6)}${px(x + 2, 8, 11, 1)}</g>
    <g fill="${WOOD}">${px(x + 4, 0, 7, 1)}</g><g fill="${WOOD_DARK}">${px(x + 7, -1)}${px(x + 3, 1, 9, 1)}</g>
    <g fill="#FFFFFF" opacity="0.5">${px(x + 11, 5, 1, 2)}</g>
    ${percentText(left, x)}`
}

// Where each tea bag stands in the box, by its left column, the last one
// taken first.
const BAGS = [3, 6, 9]

// Weekly limit: a box of tea bags, their tops showing over its rim and their
// tags hanging down its front, fewer as the week's limit is used.
const teaBox = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const bags = BAGS.slice(0, level(left, BAGS.length))
  return `
    <g fill="${INSIDE}">${px(x + 3, 2, 9, 1)}</g>
    ${bags.map((dx, i) => `<g fill="${i % 2 === 0 ? BAG : BAG_DARK}">${px(x + dx, i === 1 ? 0 : 1, 3, i === 1 ? 3 : 2)}</g><g fill="${STRING}">${px(x + dx + 1, i === 1 ? -1 : 0)}</g>`).join('')}
    <g fill="${BOX}">${px(x + 2, 3, 11, 6)}</g>
    <g fill="${BOX_DARK}">${px(x + 2, 3, 11, 1)}${px(x + 2, 8, 11, 1)}</g>
    <g fill="${STRING}">${bags.map(dx => px(x + dx + 1, 4)).join('')}</g>
    <g fill="${TAG}">${bags.map(dx => px(x + dx + 1, 5, 1, 2)).join('')}</g>
    ${percentText(left, x)}`
}

const teatimeSvg = (f: Meters) =>
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
    ${EIGHTHS_CSS}`,
    `
  ${shelf()}
  ${mug(f.contextLeft, 0, f.isCompacting)}
  ${clock(f.cacheLeft, f.cacheTtl, SLOT)}
  ${jar(f.fiveHour, SLOT * 2)}
  ${teaBox(f.week, SLOT * 3)}`,
  )

// The scene in the small size, eight pixels tall: the same four objects
// drawn small, four pixels apart, on the board at the bottom. Each shows
// four steps of its meter: more than half, down to half, down to a quarter,
// and nothing. No teapot: the mug alone fills up while compacting.
const smallTeatimeSvg = (f: Meters) => {
  const tea = [0, 1, 2, 4][stageOf(f.contextLeft)] ?? 0
  const isWarm = f.isCompacting || !runsLow(f.contextLeft)
  const mugTea = f.isCompacting
    ? `<g class="refill"><g fill="${TEA}">${px(2, 2, 4, 4)}</g><g fill="${TEA_TOP}">${px(2, 2, 4, 1)}</g></g>`
    : tea > 0
      ? `<g fill="${TEA}">${px(2, 6 - tea, 4, tea)}</g><g fill="${TEA_TOP}">${px(2, 6 - tea, 4, 1)}</g>`
      : ''
  const mug = `
    <g fill="${INSIDE}">${px(2, 2, 4, 4)}</g>
    ${mugTea}
    <g fill="${CERAMIC}">${px(1, 2, 1, 5)}${px(7, 3, 2, 1)}${px(8, 4)}${px(7, 5, 2, 1)}</g>
    <g fill="${CERAMIC_DARK}">${px(6, 2, 1, 5)}${px(2, 6, 4, 1)}</g>
    <g fill="${STRIPE}">${px(1, 4)}${px(6, 4)}</g>
    ${isWarm ? `<g fill="${CERAMIC}" opacity="0.6"><g class="steam1">${px(3, 1)}</g><g class="steam2">${px(5, 1)}</g></g>` : ''}`

  // The clock: its disc whole before the first answer, then half and a
  // quarter of it as the cache's life goes by, and a bare face at six once it
  // expires.
  const face = `
    <g fill="${BRASS}">${px(15, 0, 3, 1)}${px(14, 1)}${px(13, 2, 1, 3)}${px(14, 5)}${px(18, 1)}</g>
    <g fill="${BRASS_DARK}">${px(19, 2, 1, 3)}${px(18, 5)}${px(15, 6, 3, 1)}</g>
    <g fill="${FACE}">${px(15, 1, 3, 1)}${px(14, 2, 5, 3)}${px(15, 5, 3, 1)}</g>`
  const timer = (from: number) => `${face}${timeLeft(SMALL_FACE_ROWS, 16, 3, from)}<g fill="${HAND}">${px(16, 3)}</g>`
  const atSix = `${face}<g fill="${HAND}">${px(16, 1, 1, 5)}</g>`
  const clock = f.cacheLeft === null ? timer(0) : hourSteps(f, [timer(0), timer(0.5), timer(0.75)], atSix)

  const fiveLeft = f.fiveHour === null ? null : 100 - f.fiveHour
  const count = [0, 1, 3, 5][stageOf(fiveLeft)] ?? 0
  const cookies = ([[25, 5], [27, 5], [25, 4], [27, 4], [26, 3]] as const)
    .slice(0, count)
    .map(([x, y], i) => `<g fill="${i % 2 === 0 ? COOKIE : COOKIE_LIGHT}">${px(x, y, 2, 1)}</g>`)
    .join('')
  const crumbs = fiveLeft === null || count > 1 ? '' : `<g fill="${COOKIE_DARK}">${(count === 0 ? [25, 28] : [28]).map(x => px(x, 5)).join('')}</g>`
  const jar = `
    ${cookies}${crumbs}
    <g fill="${GLASS}">${px(24, 3, 1, 4)}${px(29, 3, 1, 4)}${px(25, 6, 4, 1)}</g>
    <g fill="${WOOD_DARK}">${px(24, 2, 6, 1)}</g><g fill="${WOOD}">${px(25, 1, 4, 1)}</g>`

  const weekLeft = f.week === null ? null : 100 - f.week
  const bags = [35, 37, 36].slice(0, [0, 1, 2, 3][stageOf(weekLeft)] ?? 0)
  const box = `
    <g fill="${INSIDE}">${px(34, 2, 5, 1)}</g>
    <g fill="${BAG}">${bags.map(x => px(x, x === 36 ? 1 : 2, 1, x === 36 ? 2 : 1)).join('')}</g>
    <g fill="${BOX}">${px(33, 3, 7, 4)}</g>
    <g fill="${BOX_DARK}">${px(33, 3, 7, 1)}</g>
    <g fill="${STRING}">${bags.map(x => px(x, 4)).join('')}</g>
    <g fill="${TAG}">${bags.map(x => px(x, 5)).join('')}</g>`

  return smallSceneSvg(
    `
    .steam1 { animation: steam 2s steps(1) infinite; }
    .steam2 { animation: steam 2s steps(1) -1s infinite; }
    @keyframes steam { 0%, 24.9% { opacity: 0; transform: translate(0, 0); } 25%, 49.9% { opacity: 1; transform: translate(0, 0); } 50%, 74.9% { opacity: 1; transform: translate(0, -1px); } 75%, 100% { opacity: 0; } }
    .refill { animation: refill 2s steps(4) both; }
    @keyframes refill { from { clip-path: inset(4px 0 0 0); } to { clip-path: inset(0 0 0 0); } }`,
    `<g fill="${WOOD}">${px(0, 7, 40, 1)}</g>
    <g fill="${GRAIN}">${[3, 12, 17, 26, 33, 38].map(x => px(x, 7)).join('')}</g>
    ${mug}${clock}${jar}${box}`,
  )
}

export const teatimeScene: MeterScene = {
  name: 'teatime',
  label: wordsOf(t => t.scenes.teatime),
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: teatimeSvg,
  small: { svg: smallTeatimeSvg, centers: [4.5, 16, 26.5, 36] },
}
