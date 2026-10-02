// The steampunk scene: the session's figures as brass and copper machines on
// a workshop's plank floor: a boiler's sight glass for the context, a clock
// for the prompt cache, a scuttle of coal for the five-hour limit, and an
// airship's altitude for the week. Each has its number underneath in the 3x5
// pixel font.
//
// The clock's minute hand goes round by itself over the cache's hour, so the
// band need not be redrawn to keep it current; once the cache expires the
// clock stops and Clawd reaches over to wind it. At a quarter of the context
// or less the boiler runs cold and Clawd frets over its pressure; while the
// conversation is compacted the boiler whistles and the sight glass fills.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the planks at y 9.
const FLOOR_Y = 9

const PLANK = '#6B4E3A'
const PLANK_DARK = '#5A4130'
const COPPER = '#B87333'
const COPPER_DARK = '#8A5524'
const RIVET = '#E0A060'
const BRASS = '#C9A54A'
const BRASS_DARK = '#9C7E34'
const GLASS = '#A8C8D8'
const WATER = '#8FD3F0'
const STEAM = '#E8E6DC'
const FACE = '#EFE6D2'
const HAND = '#3A2A1E'
const RED = '#C0443A'
const IRON = '#5A5A62'
const COAL = '#3E3E46'
const COAL_LIGHT = '#7A7A88'
const CANVAS = '#D8C9A8'
const CANVAS_DARK = '#B8A47E'
const WOOD = '#8B5A2B'
const FIRE = '#F5A623'
const FIRE_LIGHT = '#F5E04A'

// The sight glass holds this many rows of water.
const GLASS_ROWS = 6

// Context: a copper boiler whose sight glass shows the water left, the
// context left; its fire burns and it puffs steam while it has pressure. At a
// quarter or less the fire dies down to an ember and the gauge's needle drops
// into the red; while the conversation is compacted it whistles hard and the
// sight glass fills up.
const boiler = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * GLASS_ROWS))
  const isLow = left !== null && left <= 25 && !isCompacting
  const water = isCompacting
    ? `<g style="${refill(GLASS_ROWS - rows)}">${px(x + 12, 8 - GLASS_ROWS, 1, GLASS_ROWS)}</g>`
    : rows > 0 ? px(x + 12, 8 - rows, 1, rows) : ''
  const puffs = isCompacting
    ? `<g fill="${STEAM}" opacity="0.85"><g class="whistle1">${px(x + 8, -1)}</g><g class="whistle2">${px(x + 9, -2)}</g><g class="whistle3">${px(x + 8, -2)}</g></g>`
    : isLow ? '' : `<g fill="${STEAM}" opacity="0.6"><g class="puff">${px(x + 8, -1)}</g></g>`
  const fire = isLow
    ? `<g fill="${RED}" opacity="0.7">${px(x + 6, 7)}</g>`
    : `<g fill="${FIRE}" class="flicker">${px(x + 5, 7, 3, 1)}</g><g fill="${FIRE_LIGHT}" class="flicker2">${px(x + 6, 7)}</g>`
  return `
    <g fill="${COPPER}">${px(x + 3, 3, 7, 6)}${px(x + 4, 2, 5, 1)}</g>
    <g fill="${COPPER_DARK}">${px(x + 9, 3, 1, 6)}</g>
    <g fill="${RIVET}">${px(x + 4, 4)}${px(x + 8, 4)}</g>
    <g fill="${COAL}">${px(x + 5, 6, 3, 2)}</g>
    ${fire}
    <g fill="${BRASS_DARK}">${px(x + 8, 0, 1, 2)}</g>
    <g fill="${BRASS}">${px(x + 4, 0, 3, 2)}</g>
    <g fill="${FACE}">${px(x + 5, 0)}</g>
    <g fill="${isLow ? RED : HAND}">${isLow ? px(x + 4, 1) : px(x + 5, 1)}</g>
    <g fill="${GLASS}" opacity="0.35">${px(x + 12, 2, 1, GLASS_ROWS)}</g>
    <g fill="${WATER}">${water}</g>
    <g fill="${BRASS}">${px(x + 11, 1, 3, 1)}${px(x + 11, 8, 3, 1)}${px(x + 10, 3, 2, 1)}${px(x + 10, 7, 2, 1)}</g>
    ${puffs}
    ${percentText(left, x)}`
}

// How far the clock's face reaches either side of its center, row by row out
// from the middle, and its pixels as [column, row] from the center; the
// outermost of each row, and the top and bottom rows, are its brass rim.
const reach = (j: number) => [4, 4, 4, 3, 2][Math.abs(j)] ?? 0
const DISC = Array.from({ length: 9 }, (_, r) => r - 4).flatMap(j =>
  Array.from({ length: 2 * reach(j) + 1 }, (_, k): [number, number] => [k - reach(j), j]),
)
const isRim = ([i, j]: [number, number]) => Math.abs(i) === reach(j) || Math.abs(j) === 4

// The minute hand at each of the twelve marks: three pixels out from the center.
const handAt = (mark: number): [number, number][] => {
  const angle = (mark / 12) * 2 * Math.PI
  return [1, 2, 3].map(r => [Math.round(r * Math.sin(angle)), Math.round(-r * Math.cos(angle))])
}

const HANDS_CSS = Array.from({ length: 12 }, (_, i) => {
  const from = (i / 12) * 100
  const to = ((i + 1) / 12) * 100
  return `.hand${i} { animation-name: hand${i}; }
    @keyframes hand${i} { 0% { opacity: 0; } ${from.toFixed(2)}% { opacity: 1; } ${(to - 0.01).toFixed(2)}% { opacity: 1; } ${to.toFixed(2)}% { opacity: 0; } 100% { opacity: ${i === 11 ? 1 : 0}; } }`
}).join('\n    ')

// A gear five pixels across around (gx, gy): a ring on an axle, its teeth
// standing straight or askew by turns as it goes round.
const gear = (gx: number, gy: number, isTurning: boolean) => `
  <g fill="${IRON}">${px(gx - 1, gy - 1, 3, 1)}${px(gx - 1, gy + 1, 3, 1)}${px(gx - 1, gy)}${px(gx + 1, gy)}</g>
  <g fill="${BRASS_DARK}">${px(gx, gy)}</g>
  <g fill="${IRON}"${isTurning ? ' class="straight"' : ''}>${px(gx, gy - 2)}${px(gx, gy + 2)}${px(gx - 2, gy)}${px(gx + 2, gy)}</g>
  ${isTurning ? `<g fill="${IRON}" class="askew">${px(gx - 2, gy - 2)}${px(gx + 2, gy - 2)}${px(gx - 2, gy + 2)}${px(gx + 2, gy + 2)}</g>` : ''}`

// Cache: a brass clock whose minute hand goes round by itself over the cache's
// hour, a gear turning beside it; once the cache expires the clock has run
// down, its hand back at twelve and the gear still.
const clock = (left: number | null, ttl: number, x: number) => {
  const isStopped = left === null || left <= 0
  const timing = isStopped ? '' : `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  const cx = x + 6
  const cy = 3
  const hand = (mark: number) => handAt(mark).map(([dx, dy]) => px(cx + dx, cy + dy)).join('')
  const hands = isStopped
    ? hand(0)
    : Array.from({ length: 12 }, (_, i) => `<g class="hand hand${i}" style="${timing}">${hand(i)}</g>`).join('')
  return `
    <g fill="${FACE}">${DISC.filter(p => !isRim(p)).map(([i, j]) => px(cx + i, cy + j)).join('')}</g>
    <g fill="${BRASS}">${DISC.filter(p => isRim(p) && !(p[0] > 0 && p[1] > 0)).map(([i, j]) => px(cx + i, cy + j)).join('')}${px(cx - 1, -2, 3, 1)}</g>
    <g fill="${BRASS_DARK}">${DISC.filter(p => isRim(p) && p[0] > 0 && p[1] > 0).map(([i, j]) => px(cx + i, cy + j)).join('')}${px(cx - 1, 8, 3, 1)}</g>
    <g fill="${HAND}" opacity="0.4">${px(cx, cy - 3)}${px(cx + 3, cy)}${px(cx, cy + 3)}</g>
    <g fill="${HAND}">${px(cx - 2, cy, 2, 1)}${hands}</g>
    <g fill="${RED}">${px(cx, cy)}</g>
    ${gear(x + 13, 6, !isStopped)}
    ${left === null ? pixelText('--', x) : left <= 0 ? pixelText('0m', x) : countdown(left, x)}`
}

// The coal heaped over the scuttle's rim, row by row up: [y, first x, last x].
const HEAP: [number, number, number][] = [[4, 4, 11], [3, 5, 10], [2, 6, 9], [1, 7, 8]]

// Five-hour limit: a copper scuttle of coal, heaped as high as the window
// still free.
const scuttle = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? HEAP.length : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * HEAP.length))
  const heap = HEAP.slice(0, rows)
  return `
    <g fill="${COAL}">${heap.map(([y, a, b]) => px(x + a, y, b - a + 1, 1)).join('')}</g>
    <g fill="${COAL_LIGHT}">${heap.map(([y, a], i) => px(x + a + 1 + (i % 2) * 2, y)).join('')}${rows > 1 ? px(x + 9, 4) : ''}</g>
    <g fill="${COPPER}">${px(x + 3, 5, 10, 1)}${px(x + 4, 6, 8, 2)}${px(x + 5, 8, 6, 1)}</g>
    <g fill="${COPPER_DARK}">${px(x + 11, 6, 1, 2)}${px(x + 10, 8)}${px(x + 3, 5)}</g>
    <g fill="${RIVET}">${px(x + 5, 6)}${px(x + 10, 6)}</g>
    <g fill="${IRON}">${px(x + 2, 3, 1, 2)}${px(x + 13, 3, 1, 2)}${px(x + 2, 2)}${px(x + 13, 2)}</g>
    ${percentText(left, x)}`
}

// Weekly limit: an airship that flies as high as the week still free, its
// propeller turning; with the week used up it rests on the floor.
const airship = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const top = -2 + Math.round((((100 - (left ?? 100)) / 100) * 5))
  const isLanded = left !== null && left <= 0
  return `
    <g class="${isLanded ? '' : 'float'}">
      <g fill="${CANVAS}">${px(x + 4, top, 7, 1)}${px(x + 3, top + 1, 9, 2)}${px(x + 4, top + 3, 7, 1)}</g>
      <g fill="${CANVAS_DARK}">${px(x + 3, top + 2, 9, 1)}${px(x + 6, top, 1, 4)}${px(x + 9, top, 1, 4)}</g>
      <g fill="${BRASS}">${px(x + 2, top, 1, 1)}${px(x + 2, top + 3, 1, 1)}${px(x + 2, top + 1, 1, 2)}</g>
      <g fill="${WOOD}">${px(x + 5, top + 5, 5, 1)}</g>
      <g fill="${BRASS_DARK}">${px(x + 5, top + 4)}${px(x + 9, top + 4)}</g>
      <g fill="${IRON}">${px(x + 1, top + 1, 1, 2)}</g>
      <g fill="${STEAM}" opacity="0.7">${isLanded ? '' : `<g class="prop1">${px(x, top + 1)}</g><g class="prop2">${px(x, top + 2)}</g>`}</g>
    </g>
    ${percentText(left, x)}`
}

// Planks with a brass rivet at each end.
const floor = () =>
  Array.from({ length: WIDTH / 8 }, (_, i) => `<g fill="${i % 2 === 0 ? PLANK : PLANK_DARK}">${px(i * 8, FLOOR_Y, 8, 1)}</g>`).join('')

const steampunkSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    ${HANDS_CSS}
    .hand { animation-timing-function: steps(1); animation-fill-mode: forwards; opacity: 0; }
    .puff { animation: steam 2.2s steps(4) infinite; }
    .whistle1 { animation: steam 0.9s steps(3) infinite; }
    .whistle2 { animation: steam 0.9s steps(3) -0.3s infinite; }
    .whistle3 { animation: steam 0.9s steps(3) -0.6s infinite; }
    @keyframes steam { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -1px); opacity: 0; } }
    .straight { animation: byturns 0.8s steps(1) infinite; }
    .askew { animation: byturns 0.8s steps(1) -0.4s infinite; }
    @keyframes byturns { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .flicker { animation: glow 0.9s steps(1) infinite; }
    .flicker2 { animation: glow 0.6s steps(1) -0.3s infinite; }
    @keyframes glow { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0.55; } }
    .float { animation: float 3s steps(1) infinite; }
    @keyframes float { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, 1px); } }
    .prop1 { animation: byturns 0.3s steps(1) infinite; }
    .prop2 { animation: byturns 0.3s steps(1) -0.15s infinite; }`,
    `
  ${floor()}
  ${boiler(f.contextLeft, 0, f.isCompacting)}
  ${clock(f.cacheLeft, f.cacheTtl, SLOT)}
  ${scuttle(f.fiveHour, SLOT * 2)}
  ${airship(f.week, SLOT * 3)}`,
  )

export const steampunk: FigureScene = {
  name: 'steampunk',
  label: { es: 'Steampunk', en: 'Steampunk' },
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: steampunkSvg,
  cue: f =>
    f.cacheLeft !== null && f.cacheLeft <= 0
      ? { act: 'reach', label: { es: 'Hay que darle cuerda al reloj', en: 'The watch needs winding' } }
      : f.contextLeft !== null && f.contextLeft <= 25
        ? { act: 'watch', label: { es: 'Baja la presión de la caldera', en: 'The boiler is losing pressure' } }
        : null,
}
