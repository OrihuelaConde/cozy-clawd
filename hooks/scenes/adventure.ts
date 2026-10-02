// The adventure scene: the session's figures as an adventurer's gear on the
// stone floor of a keep: a mana potion for the context, an hourglass for the
// prompt cache, a chest of gold for the five-hour limit, and a quiver of
// arrows for the week. Each has its number underneath in the 3x5 pixel font.
//
// The hourglass runs by itself over the cache's hour, so the band need not be
// redrawn to keep it current. At a quarter of the context or less a spare
// vial waits beside the potion; while the conversation is compacted the
// potion fills up again, sparkling.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, level, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the stone floor at y 9.
const FLOOR_Y = 9

const STONE = '#6E6A63'
const STONE_DARK = '#57534D'
const GLASS = '#A8C8D8'
const CORK = '#A0785A'
const MANA = '#4F74D9'
const MANA_LIGHT = '#8FB0FF'
const SPARK = '#F5E6A8'
const WOOD = '#8B5A2B'
const WOOD_DARK = '#6B4220'
const SAND = '#E0C080'
const IRON = '#5A5A5A'
const GOLD = '#F2C14E'
const GOLD_DARK = '#C8962E'
const LEATHER = '#9A6438'
const LEATHER_DARK = '#74482A'
const SHAFT = '#C8A878'
const FEATHER = '#C0443A'
const FEATHER_LIGHT = '#E8E6DC'

// The potion's inside, row by row from the bottom: [y, first x, last x].
const POTION: [number, number, number][] = [[7, 6, 9], [6, 5, 10], [5, 5, 10], [4, 5, 10], [3, 6, 9]]

const potionRows = (x: number, rows: number) =>
  POTION.slice(0, rows).map(([y, a, b]) => px(x + a, y, b - a + 1, 1)).join('')

// Context: a mana potion, as full as the context left, bubbling. At a quarter
// or less a spare vial stands by; while the conversation is compacted the
// potion fills up again with sparkles over it.
const potion = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : level(left, POTION.length)
  const isLow = left !== null && left <= 25
  const mana = isCompacting
    ? `<g style="${refill(POTION.length - rows)}">${potionRows(x, POTION.length)}</g>`
    : potionRows(x, rows)
  const top = POTION[Math.max(0, (isCompacting ? POTION.length : rows) - 1)]?.[0] ?? 8
  return `
    <g fill="${MANA}">${mana}</g>
    ${rows > 1 || isCompacting ? `<g fill="${MANA_LIGHT}"><g class="bubble1">${px(x + 6, 6)}</g><g class="bubble2">${px(x + 8, 7)}</g></g>` : ''}
    <g fill="${GLASS}">
      ${px(x + 6, 0, 1, 3)}${px(x + 9, 0, 1, 3)}${px(x + 5, 3)}${px(x + 10, 3)}
      ${px(x + 4, 4, 1, 3)}${px(x + 11, 4, 1, 3)}${px(x + 5, 7)}${px(x + 10, 7)}${px(x + 6, 8, 4, 1)}
    </g>
    <g fill="#FFFFFF" opacity="0.5">${px(x + 6, 4, 1, 2)}</g>
    <g fill="${CORK}">${px(x + 7, -1, 2, 2)}</g>
    ${isLow && !isCompacting ? `<g fill="${GLASS}">${px(x + 12, 5, 1, 4)}${px(x + 14, 5, 1, 4)}${px(x + 13, 8)}</g><g fill="${MANA}">${px(x + 13, 6, 1, 2)}</g><g fill="${CORK}">${px(x + 13, 4)}</g>` : ''}
    ${isCompacting ? `<g fill="${SPARK}"><g class="spark1">${px(x + 5, Math.min(top, 3) - 2)}</g><g class="spark2">${px(x + 10, Math.min(top, 3) - 3)}</g><g class="spark3">${px(x + 12, 1)}</g></g>` : ''}
    ${percentText(left, x)}`
}

// The sand in the hourglass's bulbs: the top one's four rows, the last in the
// neck, and the bottom one's three. The glass is centred on x 7.
const topSand = (x: number) => `${px(x + 5, 0, 5, 2)}${px(x + 6, 2, 3, 1)}${px(x + 7, 3)}`
const bottomSand = (x: number) => `${px(x + 6, 5, 3, 1)}${px(x + 5, 6, 5, 2)}`

// Cache: an hourglass whose sand runs by itself over the cache's hour, the top
// bulb draining and the bottom one filling, one grain at a time falling
// through the neck; it has run out once the cache expires.
const hourglass = (left: number | null, ttl: number, x: number) => {
  const isOut = left !== null && left <= 0
  const timing = left === null || isOut ? '' : `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  const sand = left === null
    ? `<g fill="${SAND}">${topSand(x)}</g>`
    : isOut
      ? `<g fill="${SAND}">${bottomSand(x)}</g>`
      : `<g fill="${SAND}"><g class="drain" style="${timing}">${topSand(x)}</g><g class="pile" style="${timing}">${bottomSand(x)}</g><g class="fall">${px(x + 7, 4)}</g></g>`
  return `
    <g fill="${GLASS}" opacity="0.6">
      ${px(x + 4, 0, 1, 2)}${px(x + 10, 0, 1, 2)}${px(x + 5, 2)}${px(x + 9, 2)}
      ${px(x + 6, 3, 1, 2)}${px(x + 8, 3, 1, 2)}
      ${px(x + 5, 5)}${px(x + 9, 5)}${px(x + 4, 6, 1, 2)}${px(x + 10, 6, 1, 2)}
    </g>
    ${sand}
    <g fill="${WOOD}">${px(x + 2, -1, 11, 1)}${px(x + 2, 8, 11, 1)}</g>
    <g fill="${WOOD_DARK}">${px(x + 2, 0, 1, 8)}${px(x + 12, 0, 1, 8)}</g>
    ${left === null ? pixelText('--', x) : isOut ? pixelText('0m', x) : countdown(left, x)}`
}

// The gold heaped in the chest, row by row from the rim up: [y, first x, last x].
const HEAP: [number, number, number][] = [[4, 4, 11], [3, 5, 10], [2, 6, 9], [1, 7, 8]]

// The last few coins, before the chest is empty.
const FEW_COINS: [number, number, number] = [4, 6, 8]

// Five-hour limit: an open chest whose heap of gold is the window still free,
// down to a few coins, a glint on it now and then.
const chest = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const steps = left === null ? HEAP.length + 1 : level(left, HEAP.length + 1)
  const heap = steps === 0 ? [] : steps === 1 ? [FEW_COINS] : HEAP.slice(0, steps - 1)
  const top = heap[heap.length - 1]
  return `
    <g fill="${WOOD_DARK}">${px(x + 3, 1, 10, 4)}${px(x + 4, 0, 8, 1)}</g>
    <g fill="${IRON}">${px(x + 3, 2, 10, 1)}</g>
    <g fill="${GOLD}">${heap.map(([y, a, b]) => px(x + a, y, b - a + 1, 1)).join('')}</g>
    <g fill="${GOLD_DARK}">${heap.map(([y, , b]) => px(x + b, y)).join('')}${heap.length > 1 ? px(x + 6, 4) + px(x + 9, 3) : ''}</g>
    ${top ? `<g class="glint" fill="#FFFFFF">${px(x + top[1] + 1, top[0])}</g>` : ''}
    <g fill="${WOOD}">${px(x + 3, 5, 10, 4)}</g>
    <g fill="${IRON}">${px(x + 3, 5, 10, 1)}${px(x + 5, 6, 1, 3)}${px(x + 10, 6, 1, 3)}</g>
    <g fill="${GOLD}">${px(x + 7, 6, 2, 2)}</g>
    <g fill="${WOOD_DARK}">${px(x + 7, 7)}</g>
    ${percentText(left, x)}`
}

// Where each arrow stands in the quiver, as [x, the top of its fletching],
// the first ones drawn last to go.
const ARROWS: [number, number][] = [[7, -2], [9, -1], [5, -1], [8, 0], [6, 0], [10, 0]]

// Weekly limit: a quiver with an arrow for every sixth of the week still free.
const quiver = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const count = left === null ? ARROWS.length : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * ARROWS.length))
  const arrows = ARROWS.slice(0, count)
  return `
    <g fill="${SHAFT}">${arrows.map(([ax, ty]) => px(x + ax, ty + 2, 1, 3 - ty)).join('')}</g>
    ${arrows.map(([ax, ty], i) => `<g fill="${i % 2 === 0 ? FEATHER : FEATHER_LIGHT}">${px(x + ax, ty, 1, 2)}</g>`).join('')}
    <g fill="${LEATHER}">${px(x + 5, 3, 6, 5)}${px(x + 6, 8, 4, 1)}</g>
    <g fill="${LEATHER_DARK}">${px(x + 5, 3, 6, 1)}${px(x + 5, 6, 6, 1)}${px(x + 10, 4, 1, 4)}</g>
    <g fill="${LEATHER_DARK}">${px(x + 11, 2)}${px(x + 12, 1)}${px(x + 4, 7)}${px(x + 3, 8)}</g>
    ${percentText(left, x)}`
}

// Stone slabs, each four pixels wide, a darker seam between them.
const floor = () =>
  Array.from({ length: WIDTH / 4 }, (_, i) => `<g fill="${i % 2 === 0 ? STONE : STONE_DARK}">${px(i * 4, FLOOR_Y, 4, 1)}</g>`).join('')

const adventureSvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    .bubble1 { animation: bubble 1.8s steps(3) infinite; }
    .bubble2 { animation: bubble 1.8s steps(3) -0.9s infinite; }
    @keyframes bubble { 0% { transform: translate(0, 0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -3px); opacity: 0; } }
    .spark1 { animation: twinkle 0.6s steps(1) infinite; }
    .spark2 { animation: twinkle 0.6s steps(1) -0.2s infinite; }
    .spark3 { animation: twinkle 0.6s steps(1) -0.4s infinite; }
    @keyframes twinkle { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .drain { animation-name: drain; animation-timing-function: steps(4); animation-fill-mode: forwards; }
    .pile { animation-name: pile; animation-timing-function: steps(3); animation-fill-mode: forwards; }
    @keyframes drain { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(4px 0 0 0); } }
    @keyframes pile { from { clip-path: inset(3px 0 0 0); } to { clip-path: inset(0 0 0 0); } }
    .fall { animation: fall 1.8s steps(3) infinite; }
    @keyframes fall { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(0, 3px); opacity: 0.5; } }
    .glint { animation: glint 2.6s steps(1) infinite; }
    @keyframes glint { 0%, 79.9% { opacity: 0; } 80%, 89.9% { opacity: 1; } 90%, 100% { opacity: 0; } }`,
    `
  ${floor()}
  ${potion(f.contextLeft, 0, f.isCompacting)}
  ${hourglass(f.cacheLeft, f.cacheTtl, SLOT)}
  ${chest(f.fiveHour, SLOT * 2)}
  ${quiver(f.week, SLOT * 3)}`,
  )

export const adventureScene: FigureScene = {
  name: 'adventure',
  label: { es: 'Aventura', en: 'Adventure' },
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: adventureSvg,
}
