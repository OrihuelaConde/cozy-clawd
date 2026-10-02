// The ventana scene: the session's figures as things on a desk by a window at
// night: a candle for the context, the moon crossing the window for the prompt
// cache, a cup of cocoa for the five-hour limit, and a ball of yarn for the
// week. Each has its number underneath in the 3x5 pixel font.
//
// The moon crosses the window by itself over the cache's hour and sets as the
// cache expires, so the band need not be redrawn to keep it current; then only
// the stars are left and Clawd yawns. At a quarter of the context or less a
// spare candle waits beside the stub; while the conversation is compacted the
// candle grows back to its full height.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, percentText, pixelText, px, refill, REFILL_CSS, rise, RISE_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the desk at y 9.
const DESK_Y = 9

const DESK = '#8A6A4E'
const DESK_DARK = '#6B513B'
const WAX = '#EFE6D2'
const WAX_SHADE = '#D6CBB2'
const WICK = '#5A3A24'
const FLAME = '#F5C26B'
const FLAME_TIP = '#E8873A'
const BRASS = '#C9A54A'
const BRASS_DARK = '#9C7E34'
const FRAME = '#A0785A'
const FRAME_DARK = '#7A5A42'
const SKY = '#2E4066'
const SKY_LATE = '#1E2638'
const MOON = '#F2E9C9'
const MOON_SHADE = '#CFC6A2'
const STAR = '#E8E6DC'
const CUP = '#B5483E'
const CUP_DARK = '#8E3730'
const COCOA = '#7A4A2E'
const CREAM = '#E8E6DC'
const SAUCER_SHADE = '#B0AEA5'
const YARN = '#C76B8A'
const YARN_DARK = '#9E4F6B'
const YARN_LIGHT = '#E393AE'
const NEEDLE = '#C8C8C8'
const KNOB = '#F5C26B'

// The candle's wax at its full height, in rows above the holder.
const CANDLE_ROWS = 6

// The flame on a wick at `wickY`.
const flame = (x: number, wickY: number) => `
  <g fill="${WICK}">${px(x + 7, wickY)}</g>
  <g class="flicker">
    <g fill="${FLAME}">${px(x + 7, wickY - 1)}</g>
    <g fill="${FLAME_TIP}">${px(x + 7, wickY - 2)}</g>
  </g>`

const wax = (x: number, rows: number) => `
  <g fill="${WAX}">${px(x + 6, 7 - rows, 3, rows)}</g>
  <g fill="${WAX_SHADE}">${px(x + 8, 7 - rows, 1, rows)}${rows > 2 ? px(x + 6, 8 - rows) : ''}</g>`

// Context: a candle in a brass holder, as tall as the context left. At a
// quarter or less a spare candle stands by; while the conversation is
// compacted the candle grows back to its full height, its flame riding the top.
const candle = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? CANDLE_ROWS : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * CANDLE_ROWS))
  const isLow = left !== null && left <= 25
  const short = CANDLE_ROWS - rows
  const holder = `
    <g fill="${BRASS}">${px(x + 3, 8, 9, 1)}${px(x + 12, 7)}${px(x + 13, 6, 1, 2)}</g>
    <g fill="${BRASS_DARK}">${px(x + 5, 7, 5, 1)}</g>`
  const spare = isLow && !isCompacting ? `<g fill="${WAX_SHADE}">${px(x + 1, 3, 2, 6)}</g><g fill="${WICK}">${px(x + 1, 2)}</g>` : ''
  if (isCompacting) {
    return `
      <g style="${refill(short)}">${wax(x, CANDLE_ROWS)}</g>
      <g style="${rise(short)}">${flame(x, 6 - CANDLE_ROWS)}</g>
      ${holder}
      ${percentText(left, x)}`
  }
  if (left === null || rows === 0) {
    return `
      ${rows > 0 ? wax(x, rows) : ''}
      <g fill="${WICK}">${px(x + 7, 6 - rows)}</g>
      ${rows === 0 ? `<g class="smoke" fill="${STAR}" opacity="0.4">${px(x + 7, 4)}${px(x + 8, 3)}${px(x + 7, 2)}</g>` : ''}
      ${holder}${spare}
      ${percentText(left, x)}`
  }
  return `
    ${wax(x, rows)}
    ${flame(x, 6 - rows)}
    ${holder}${spare}
    ${percentText(left, x)}`
}

// The window's panes, from the left and the top of the slot: four of four by
// four, split by a mullion at x 7 and a transom at y 3.
const PANES = { x: 3, y: -1, w: 9, h: 9 }

// Where the moon's top left corner sits in the slot as the hour goes by, an
// equal share of it at each: up and across the top panes, clear of the cross,
// then down the right ones and below the sill at the end.
const MOON_START: [number, number] = [3, 0]
const MOON_PATH: [number, number][] = [
  MOON_START, [4, -1], [5, -1], [6, -1], [7, -1], [8, -1], [9, 0],
  [9, 1], [9, 2], [9, 3], [9, 4], [9, 5], [9, 6], [9, 7], [9, 9],
]

const MOON_CSS = `@keyframes moonset { ${MOON_PATH.map(([mx, my], i) =>
  `${((i / (MOON_PATH.length - 1)) * 100).toFixed(2)}% { transform: translate(${mx - MOON_START[0]}px, ${my - MOON_START[1]}px); }`).join(' ')} }`

// A three-pixel moon, its corners a shade dimmer so it reads round.
const moonDisc = (x: number, y: number) => `
  <g fill="${MOON}">${px(x, y + 1, 3, 1)}${px(x + 1, y, 1, 3)}</g>
  <g fill="${MOON_SHADE}">${px(x, y)}${px(x + 2, y)}${px(x, y + 2)}${px(x + 2, y + 2)}</g>`

const STARS: [number, number][] = [[9, -1], [11, 1], [4, 1], [5, 5], [10, 6]]

// Cache: the moon crossing a window by itself over the cache's hour, the
// night deepening behind it; it sets as the cache expires and leaves the stars.
const nightWindow = (left: number | null, ttl: number, x: number) => {
  const isOver = left !== null && left <= 0
  const timing = left === null || isOver ? '' : `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  const sky = `<g fill="${isOver ? SKY_LATE : SKY}">${px(x + PANES.x, PANES.y, PANES.w, PANES.h)}</g>
    ${timing ? `<g class="deepen" style="${timing}" fill="${SKY_LATE}">${px(x + PANES.x, PANES.y, PANES.w, PANES.h)}</g>` : ''}`
  const stars = STARS.map(([sx, sy], i) => `<g class="star${i % 3}" fill="${STAR}">${px(x + sx, sy)}</g>`).join('')
  const moon = isOver
    ? ''
    : `<g clip-path="url(#ventana-panes)"><g class="moon" style="${timing}">${moonDisc(x + MOON_START[0], MOON_START[1])}</g></g>`
  return `
    <clipPath id="ventana-panes">${px(x + PANES.x, PANES.y, PANES.w, PANES.h)}</clipPath>
    ${sky}${stars}${moon}
    <g fill="${FRAME}">${px(x + 2, -2, 11, 1)}${px(x + 2, -1, 1, 9)}${px(x + 12, -1, 1, 9)}${px(x + 7, -1, 1, 9)}${px(x + 3, 3, 9, 1)}</g>
    <g fill="${FRAME_DARK}">${px(x + 1, 8, 13, 1)}</g>
    ${left === null ? pixelText('--', x) : isOver ? pixelText('0m', x) : countdown(left, x)}`
}

// The cup holds this many rows of cocoa.
const COCOA_ROWS = 5

// Five-hour limit: a cup of cocoa on its saucer, as full as the window still
// free, a marshmallow afloat; its steam thins out as the cocoa goes down.
const cocoa = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? COCOA_ROWS : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * COCOA_ROWS))
  const top = 7 - rows
  const wisps = rows >= 4 ? 2 : rows >= 2 ? 1 : 0
  return `
    ${rows > 0 ? `<g fill="${COCOA}">${px(x + 5, top, 5, rows)}</g><g fill="${CREAM}">${px(x + 6, top, 2, 1)}</g>` : ''}
    <g fill="${CUP}">${px(x + 4, 2, 1, 6)}${px(x + 5, 7, 5, 1)}${px(x + 11, 3)}${px(x + 12, 3, 1, 3)}${px(x + 11, 5)}</g>
    <g fill="${CUP_DARK}">${px(x + 10, 2, 1, 6)}</g>
    <g fill="${CREAM}">${px(x + 2, 8, 12, 1)}</g>
    <g fill="${SAUCER_SHADE}">${px(x + 4, 8, 8, 1)}</g>
    <g fill="${CREAM}" opacity="0.6">
      ${wisps > 0 ? `<g class="steam1">${px(x + 6, 0)}${px(x + 5, -1)}</g>` : ''}
      ${wisps > 1 ? `<g class="steam2">${px(x + 8, 0)}${px(x + 9, -1)}</g>` : ''}
    </g>
    ${percentText(left, x)}`
}

// The pixels of a ball `d` pixels across, as [column, row] from its top left.
const disc = (d: number) =>
  Array.from({ length: d * d }, (_, k) => [k % d, Math.floor(k / d)] as const).filter(
    ([i, j]) => (i + 0.5 - d / 2) ** 2 + (j + 0.5 - d / 2) ** 2 <= (d / 2) ** 2 * 0.85,
  )

// Weekly limit: a ball of yarn, two needles stuck in it, that shrinks as the
// week's limit is used; its loose end trails along the desk. Once it is gone
// the needles lie on the desk.
const yarn = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const d = left === null ? 7 : left > 0 ? Math.max(2, Math.round((left / 100) * 7)) : 0
  if (d === 0) {
    return `
      <g fill="${NEEDLE}">${px(x + 3, 8, 8, 1)}${px(x + 5, 7, 8, 1)}</g>
      <g fill="${KNOB}">${px(x + 2, 8)}${px(x + 13, 7)}</g>
      <g fill="${YARN_DARK}">${px(x + 11, 8, 3, 1)}</g>
      ${percentText(left, x)}`
  }
  const x0 = x + 7 - Math.floor(d / 2)
  const top = 9 - d
  const cx = x + 7
  const ball = disc(d)
  return `
    <g fill="${NEEDLE}">${px(cx - 1, top)}${px(cx - 2, top - 1)}${px(cx - 3, top - 2)}${px(cx + 1, top)}${px(cx + 2, top - 1)}${px(cx + 3, top - 2)}</g>
    <g fill="${KNOB}">${px(cx - 4, top - 3)}${px(cx + 4, top - 3)}</g>
    <g fill="${YARN}">${ball.map(([i, j]) => px(x0 + i, top + j)).join('')}</g>
    <g fill="${YARN_DARK}">${ball.filter(([i, j]) => (i + j) % 3 === 0).map(([i, j]) => px(x0 + i, top + j)).join('')}</g>
    <g fill="${YARN_LIGHT}">${d > 3 ? px(x0 + 1, top + 1) : ''}</g>
    <g fill="${YARN_DARK}">${px(x0 + d, 8, Math.max(0, x + 14 - (x0 + d)), 1)}</g>
    ${percentText(left, x)}`
}

const desk = () => `
  <g fill="${DESK}">${px(0, DESK_Y, WIDTH, 1)}</g>
  <g fill="${DESK_DARK}">${px(2, DESK_Y + 1, 1, 1)}${px(WIDTH - 3, DESK_Y + 1, 1, 1)}</g>`

const ventanaSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    ${RISE_CSS}
    .flicker { animation: flicker 0.6s steps(1) infinite; }
    @keyframes flicker { 0%, 49.9% { transform: translate(0, 0); } 50%, 74.9% { transform: translate(0, 0.5px); } 75%, 100% { transform: translate(0, -0.5px); } }
    .smoke { animation: steam 2.4s steps(4) infinite; }
    .steam1 { animation: steam 2s steps(4) infinite; }
    .steam2 { animation: steam 2s steps(4) -1s infinite; }
    @keyframes steam { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -1px); opacity: 0; } }
    .moon { animation-name: moonset; animation-timing-function: step-end; animation-fill-mode: forwards; }
    ${MOON_CSS}
    .deepen { animation-name: deepen; animation-timing-function: linear; animation-fill-mode: forwards; }
    @keyframes deepen { from { opacity: 0; } to { opacity: 1; } }
    .star0 { animation: twinkle 2.2s steps(1) infinite; }
    .star1 { animation: twinkle 3.1s steps(1) -1.2s infinite; }
    .star2 { animation: twinkle 2.7s steps(1) -0.5s infinite; }
    @keyframes twinkle { 0%, 69.9% { opacity: 1; } 70%, 84.9% { opacity: 0.25; } 85%, 100% { opacity: 1; } }`,
    `
  ${desk()}
  ${candle(f.contextLeft, 0, f.isCompacting)}
  ${nightWindow(f.cacheLeft, f.cacheTtl, SLOT)}
  ${cocoa(f.fiveHour, SLOT * 2)}
  ${yarn(f.week, SLOT * 3)}`,
  )

export const ventana: FigureScene = {
  name: 'ventana',
  label: 'Ventana de noche',
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: ventanaSvg,
  cue: f => (f.cacheLeft !== null && f.cacheLeft <= 0 ? { act: 'yawn', label: 'Se puso la luna' } : null),
}
