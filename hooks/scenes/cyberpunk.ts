// The cyberpunk scene: the session's figures as neon things on a rooftop in
// the rain, a dark skyline behind: a power cell for the context, a neon sign
// of a bowl of noodles for the prompt cache, a stack of credit chips for the
// five-hour limit, and signal bars for the week. Each has its number
// underneath in the 3x5 pixel font.
//
// The sign's tubes go out by themselves over the cache's hour, so the band
// need not be redrawn to keep it current; once the cache expires the sign is
// dark. At a quarter of the context or less the cell's charge flickers pink
// beside a loose charging cable; while the conversation is compacted the
// cable is plugged in and the cell charges.

import { wordsOf } from '../language'
import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the rooftop at y 9.
const ROOF_Y = 9

const ROOF = '#3A3550'
const ROOF_DARK = '#2E2A40'
const SKYLINE = '#241C38'
const RAIN = '#7FA8D8'
const CYAN = '#3FF0E8'
const PINK = '#FF4FA3'
const YELLOW = '#F5E04A'
const TUBE_OFF = '#3A3A4A'
const METAL = '#5A5470'
const METAL_LIGHT = '#8A8AA0'
const WINDOW = '#141020'
const CHIP = '#F5E04A'
const CHIP_DARK = '#C9A82E'
const BAR_OFF = '#2A3A4A'

// The cell holds this many rows of charge.
const CHARGE_ROWS = 6

// Context: a power cell whose window shows its charge, the context left. At a
// quarter or less the charge flickers pink and a charging cable lies beside
// it; while the conversation is compacted the cable is plugged in, a bolt
// flashes over the cell and the charge rises.
const powerCell = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * CHARGE_ROWS))
  const isLow = left !== null && left <= 25
  const charge = isCompacting
    ? `<g fill="${CYAN}" style="${refill(CHARGE_ROWS - rows)}">${px(x + 6, 8 - CHARGE_ROWS, 4, CHARGE_ROWS)}</g>`
    : rows > 0 ? `<g fill="${isLow ? PINK : CYAN}"${isLow ? ' class="flicker"' : ''}>${px(x + 6, 8 - rows, 4, rows)}</g>` : ''
  const cable = isCompacting
    ? `<g fill="${METAL_LIGHT}">${px(x + 11, 4, 2, 1)}${px(x + 13, 5, 1, 4)}</g>
      <g class="bolt" fill="${YELLOW}">${px(x + 8, -2)}${px(x + 7, -1)}${px(x + 8, -1)}${px(x + 7, 0)}</g>`
    : isLow ? `<g fill="${METAL_LIGHT}">${px(x + 11, 8, 4, 1)}${px(x + 14, 7)}</g>` : ''
  return `
    <g fill="${METAL_LIGHT}">${px(x + 7, 0, 2, 1)}</g>
    <g fill="${METAL}">${px(x + 5, 1, 6, 8)}</g>
    <g fill="${WINDOW}">${px(x + 6, 2, 4, 6)}</g>
    ${charge}
    <g fill="${WINDOW}" opacity="0.6">${px(x + 6, 4, 4, 1)}${px(x + 6, 6, 4, 1)}</g>
    ${cable}
    ${percentText(left, x)}`
}

// The sign's three parts: the bowl, the chopsticks in it and the steam over it.
const bowl = (x: number) => `${px(x + 3, 4, 10, 1)}${px(x + 3, 5)}${px(x + 12, 5)}${px(x + 4, 6)}${px(x + 11, 6)}${px(x + 5, 7, 6, 1)}`
const chopsticks = (x: number) => `${px(x + 9, 3)}${px(x + 10, 2)}${px(x + 11, 1)}${px(x + 12, 0)}${px(x + 10, 3)}${px(x + 11, 2)}${px(x + 12, 1)}${px(x + 13, 0)}`
const steam = (x: number) => `${px(x + 4, 2)}${px(x + 5, 1)}${px(x + 4, 0)}${px(x + 7, 2)}${px(x + 8, 1)}${px(x + 7, 0)}`

// Cache: a neon sign of a bowl of noodles whose tubes go out by themselves
// over the cache's hour: the steam first, then the chopsticks, then the bowl
// flickers; once the cache has expired the sign is dark but for a spark.
const neonSign = (left: number | null, ttl: number, x: number) => {
  const isOut = left !== null && left <= 0
  const timing = left === null || isOut ? '' : `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  const lit = (cls: string, fill: string, tube: string) => `<g fill="${fill}" class="${timing ? cls : ''}" style="${timing}">${tube}</g>`
  const tubes = isOut
    ? `<g class="spark" fill="${YELLOW}">${px(x + 12, 4)}</g>`
    : `${lit('until25', YELLOW, steam(x))}${lit('until50', CYAN, chopsticks(x))}${lit('until75', PINK, bowl(x))}
      ${timing ? `<g class="from75" style="${timing}"><g class="buzz" fill="${PINK}">${bowl(x)}</g></g>` : ''}`
  return `
    <g fill="${TUBE_OFF}">${steam(x)}${chopsticks(x)}${bowl(x)}</g>
    ${tubes}
    <g fill="${METAL}">${px(x + 4, 8, 8, 1)}</g>
    ${left === null ? pixelText('--', x) : isOut ? pixelText('0m', x) : countdown(left, x)}`
}

// The chips stack this high at most.
const CHIP_ROWS = 6

// Five-hour limit: a stack of credit chips on a lit pad, a chip for every
// sixth of the window still free.
const credits = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? CHIP_ROWS : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * CHIP_ROWS))
  return `
    ${Array.from({ length: rows }, (_, i) => `<g fill="${i % 2 === 0 ? CHIP : CHIP_DARK}">${px(x + 5, 7 - i, 6, 1)}</g>`).join('')}
    ${rows > 0 ? `<g fill="${CHIP_DARK}">${px(x + 5, 8 - rows)}${px(x + 10, 8 - rows)}</g>` : ''}
    <g fill="${METAL}">${px(x + 3, 8, 10, 1)}</g>
    <g fill="${CYAN}">${px(x + 4, 8, 8, 1)}</g>
    ${percentText(left, x)}`
}

// Signal bars, each two pixels wide: [x, height].
const BARS: [number, number][] = [[3, 2], [6, 4], [9, 6], [12, 8]]

// Weekly limit: signal bars, one lit for every quarter of the week still
// free; the last one blinks pink.
const signal = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const lit = left === null ? BARS.length : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * BARS.length))
  const isLow = lit === 1
  return `
    ${BARS.map(([bx, h], i) => `<g fill="${i < lit ? (isLow ? PINK : CYAN) : BAR_OFF}"${i < lit && isLow ? ' class="flicker"' : ''}>${px(x + bx, 9 - h, 2, h)}</g>`).join('')}
    <g fill="${METAL_LIGHT}">${px(x + 13, -1, 1, 2)}</g>
    <g class="beacon" fill="${PINK}">${px(x + 13, -2)}</g>
    ${percentText(left, x)}`
}

// The skyline behind, as [x, width, top], with a lit window here and there.
const TOWERS: [number, number, number][] = [
  [0, 4, 3], [4, 5, 1], [9, 4, 4], [13, 6, 0], [19, 4, 2], [23, 5, 5], [28, 4, 1], [32, 6, 3],
  [38, 4, 0], [42, 5, 4], [47, 4, 2], [51, 6, 5], [57, 3, 1], [60, 4, 3],
]
const LIGHTS: [number, number, string][] = [[1, 4, CYAN], [6, 2, PINK], [15, 1, CYAN], [21, 3, PINK], [30, 2, CYAN], [40, 1, PINK], [49, 3, CYAN], [58, 2, PINK], [62, 4, CYAN]]

const skyline = () => `
  <g fill="${SKYLINE}">${TOWERS.map(([tx, w, top]) => px(tx, top, w, ROOF_Y - top)).join('')}</g>
  ${LIGHTS.map(([lx, ly, c], i) => `<g class="window${i % 3}" fill="${c}" opacity="0.5">${px(lx, ly)}</g>`).join('')}`

// Rain falling across the scene, as [x, period in seconds, delay].
const DROPS: [number, number, number][] = [[2, 0.9, 0], [11, 1.1, 0.4], [19, 1, 0.7], [26, 0.95, 0.2], [35, 1.05, 0.5], [43, 0.9, 0.8], [50, 1.1, 0.1], [58, 1, 0.6]]

const rain = () =>
  `<g fill="${RAIN}" opacity="0.35">${DROPS.map(([dx, period, delay]) => `<g class="drop" style="animation-duration: ${period}s; animation-delay: -${delay}s">${px(dx, -2, 1, 1)}</g>`).join('')}</g>`

const roof = () =>
  Array.from({ length: WIDTH / 4 }, (_, i) => `<g fill="${i % 2 === 0 ? ROOF : ROOF_DARK}">${px(i * 4, ROOF_Y, 4, 1)}</g>`).join('')

const cyberpunkSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    .drop { animation-name: fall; animation-timing-function: steps(11); animation-iteration-count: infinite; }
    @keyframes fall { from { transform: translate(0, 0); } to { transform: translate(-1px, 11px); } }
    .window0 { animation: twinkle 3.1s steps(1) infinite; }
    .window1 { animation: twinkle 4.3s steps(1) -1.5s infinite; }
    .window2 { animation: twinkle 3.7s steps(1) -2.6s infinite; }
    @keyframes twinkle { 0%, 69.9% { opacity: 0.5; } 70%, 100% { opacity: 0; } }
    .flicker { animation: flicker 1.3s steps(1) infinite; }
    @keyframes flicker { 0%, 59.9% { opacity: 1; } 60%, 64.9% { opacity: 0.3; } 65%, 79.9% { opacity: 1; } 80%, 84.9% { opacity: 0.3; } 85%, 100% { opacity: 1; } }
    .bolt { animation: flash 0.5s steps(1) infinite; }
    @keyframes flash { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .until25, .until50, .until75, .from75 { animation-timing-function: steps(1); animation-fill-mode: forwards; }
    .until25 { animation-name: until25; }
    .until50 { animation-name: until50; }
    .until75 { animation-name: until75; }
    .from75 { animation-name: from75; }
    @keyframes until25 { 0%, 24.9% { opacity: 1; } 25%, 100% { opacity: 0; } }
    @keyframes until50 { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    @keyframes until75 { 0%, 74.9% { opacity: 1; } 75%, 100% { opacity: 0; } }
    @keyframes from75 { 0%, 74.9% { opacity: 0; } 75%, 100% { opacity: 1; } }
    .buzz { animation: flicker 0.9s steps(1) infinite; }
    .spark { animation: spark 2.3s steps(1) infinite; }
    @keyframes spark { 0%, 89.9% { opacity: 0; } 90%, 94.9% { opacity: 1; } 95%, 100% { opacity: 0; } }
    .beacon { animation: flash 1.6s steps(1) infinite; }`,
    `
  ${skyline()}
  ${roof()}
  ${powerCell(f.contextLeft, 0, f.isCompacting)}
  ${neonSign(f.cacheLeft, f.cacheTtl, SLOT)}
  ${credits(f.fiveHour, SLOT * 2)}
  ${signal(f.week, SLOT * 3)}
  ${rain()}`,
  )

export const cyberpunkScene: FigureScene = {
  name: 'cyberpunk',
  label: wordsOf(t => t.scenes.cyberpunk),
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: cyberpunkSvg,
}
