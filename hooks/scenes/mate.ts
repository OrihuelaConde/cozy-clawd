// The mate scene: the session's meters as things on a checked tablecloth
// for a mate: a thermos of hot water for the context, the mate for the prompt
// cache, a plate of medialunas for the five-hour limit, and a pack of yerba for
// the week. Each has its number underneath in the 3x5 pixel font.
//
// The mate's steam fades by itself over the cache's hour, so the band need not
// be redrawn to keep it current; once the cache expires the yerba is washed
// out. While the conversation is compacted, the kettle boils and the thermos
// fills up.

import { wordsOf } from '../language'
import type { MeterScene, Meters } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, hourSteps, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, smallSceneSvg, stageOf, WIDTH } from './pixels'

// Objects stand on the tablecloth, which takes rows 8 and 9.
const CLOTH_Y = 8

const CLOTH = '#B5483E'
const CREAM = '#E8E6DC'
const SHADOW = '#8C8A84'
const STEEL = '#C8C8C8'
const STEEL_DARK = '#9A9A9A'
const THERMOS = '#4F7B5A'
const THERMOS_DARK = '#3B5E45'
const WATER = '#8FD3F0'
const GAUGE = '#2B3A40'
const GOURD = '#8B5A2B'
const GOURD_DARK = '#6B4220'
const GOURD_LIGHT = '#B07A45'
const YERBA = '#7FA65A'
const WASHED = '#9A9A8A'
const PASTRY = '#D99A4E'
const PASTRY_DARK = '#B5763A'
const PACK = '#6B8E4E'
const PACK_DARK = '#557341'

// A kettle ready to refill the thermos: round, its handle arched over the lid
// and its spout rising to the left, steaming. Boiling, its lid rattles and the
// spout puffs hard.
const kettle = (x: number, isBoiling: boolean) => `
  <g fill="${STEEL_DARK}">${px(x + 3, 1, 3, 1)}${px(x + 2, 2)}${px(x + 6, 2)}${px(x + 3, 7, 3, 1)}</g>
  <g fill="${STEEL}">${px(x, 3)}${px(x + 1, 4, 6, 1)}${px(x + 2, 5, 5, 2)}</g>
  <g fill="${STEEL}"${isBoiling ? ' class="rattle"' : ''}>${px(x + 3, 3, 3, 1)}</g>
  <g fill="${CREAM}" opacity="${isBoiling ? 0.85 : 0.6}">${
    isBoiling
      ? `<g class="boil1">${px(x, 1)}</g><g class="boil2">${px(x + 1, 0)}</g><g class="boil3">${px(x, 0)}</g>`
      : `<g class="kettle-steam">${px(x, 1)}</g>`
  }</g>`

// How far the thermos steps right to make room for the kettle.
const ASIDE = 2

// The water strip's rows, from the bottom.
const STRIP = 5

// Context: a thermos with a strip of water down its side that drops as the
// context fills. At a quarter or less, a kettle waits beside it to refill it,
// and the thermos steps aside for it. While the conversation is compacted the
// kettle boils and the water rises to the top.
const thermos = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * STRIP))
  const isLow = left !== null && left <= 25
  const hasKettle = isLow || isCompacting
  const at = hasKettle ? x + ASIDE : x
  const water = isCompacting
    ? `<g style="${refill(STRIP - rows)}">${px(at + 7, 7 - STRIP, 1, STRIP)}</g>`
    : rows > 0 ? px(at + 7, 7 - rows, 1, rows) : ''
  return `
    <g fill="${STEEL}">${px(at + 7, -2)}${px(at + 6, -1, 3, 1)}${px(at + 5, 0, 5, 1)}</g>
    <g fill="${THERMOS}">${px(at + 5, 1, 5, 7)}</g>
    <g fill="${THERMOS_DARK}">${px(at + 9, 1, 1, 7)}${px(at + 10, 2)}${px(at + 10, 5)}${px(at + 11, 2, 1, 4)}</g>
    <g fill="${GAUGE}">${px(at + 7, 2, 1, 5)}</g>
    <g fill="${WATER}">${water}</g>
    ${hasKettle ? kettle(x, isCompacting) : ''}
    ${percentText(left, x)}`
}

// Cache: the mate and its bombilla. It steams in a loop that fades by itself
// over the cache's hour; once the cache has expired the yerba is washed out.
const mate = (left: number | null, ttl: number, x: number) => {
  const isWashed = left !== null && left <= 0
  const gourd = `
    <g fill="${isWashed ? WASHED : YERBA}">${px(x + 6, 1, 4, 1)}${px(x + 7, 0, 2, 1)}</g>
    <g fill="${STEEL}">${px(x + 9, 1)}${px(x + 10, 0)}${px(x + 11, -1)}${px(x + 12, -2)}</g>
    <g fill="${STEEL_DARK}">${px(x + 5, 2, 6, 1)}</g>
    <g fill="${GOURD}">${px(x + 4, 3, 8, 1)}${px(x + 3, 4, 10, 2)}${px(x + 4, 6, 8, 1)}${px(x + 5, 7, 6, 1)}</g>
    <g fill="${GOURD_DARK}">${px(x + 10, 3, 2, 1)}${px(x + 11, 4, 2, 2)}${px(x + 10, 6, 2, 1)}${px(x + 9, 7, 2, 1)}</g>
    <g fill="${GOURD_LIGHT}">${px(x + 5, 4)}</g>`
  if (left === null || isWashed) {
    return `${gourd}${pixelText(left === null ? '--' : '0m', x)}`
  }
  return `${gourd}
    <g class="warm" style="animation-duration: ${ttl}s; animation-delay: -${ttl - left}s">
      <g fill="${CREAM}" opacity="0.6">
        <g class="steam1">${px(x + 6, -1)}${px(x + 5, -2)}</g>
        <g class="steam2">${px(x + 8, -1)}${px(x + 9, -2)}</g>
      </g>
    </g>
    ${countdown(left, x)}`
}

// One medialuna, four pixels across and three tall: an arch whose tips curl down.
const medialuna = (x: number, y: number) => `
  <g fill="${PASTRY}">${px(x + 1, y, 2, 1)}${px(x, y + 1, 4, 1)}</g>
  <g fill="${PASTRY_DARK}">${px(x + 2, y + 1)}${px(x, y + 2)}${px(x + 3, y + 2)}</g>`

// Where each medialuna sits on the plate, the last one eaten first.
const PILE: [number, number][] = [[2, 3], [6, 3], [10, 3], [6, 0]]

// Five-hour limit: a plate with a medialuna for every quarter of the window
// still free; the eaten ones leave crumbs.
const plate = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const count = left === null ? PILE.length : Math.min(PILE.length, Math.max(0, Math.ceil(left / 25)))
  const crumbs = count < 3 ? `<g fill="${PASTRY_DARK}">${px(x + 11, 5)}${px(x + 13, 5)}${count < 2 ? px(x + 7, 5) : ''}${count < 1 ? px(x + 3, 5) : ''}</g>` : ''
  return `
    <g fill="${CREAM}">${px(x + 1, 6, 14, 1)}</g>
    <g fill="${SHADOW}">${px(x + 3, 7, 10, 1)}</g>
    ${crumbs}
    ${PILE.slice(0, count).map(([dx, y]) => medialuna(x + dx, y)).join('')}
    ${percentText(left, x)}`
}

// Weekly limit: a pack of yerba that gets flatter, from the top down, as the
// week's limit is used.
const pack = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? 8 : Math.max(1, Math.round((left / 100) * 8))
  const top = CLOTH_Y - rows
  // The label sits low on the pack, so it goes last as the pack flattens.
  const label = [4, 5].filter(y => y > top)
  return `
    <g fill="${PACK}">${px(x + 5, top, 6, rows)}</g>
    <g fill="${PACK_DARK}">${px(x + 5, top, 6, 1)}${px(x + 10, top, 1, rows)}</g>
    <g fill="${CREAM}">${label.map(y => px(x + 5, y, 5, 1)).join('')}</g>
    <g fill="${CLOTH}">${label.length === 2 ? px(x + 7, 4) : ''}</g>
    ${percentText(left, x)}`
}

// A gingham strip: cells two pixels wide, the rows offset by one cell.
const tablecloth = () =>
  [0, 1]
    .map(row =>
      Array.from({ length: WIDTH / 2 }, (_, i) => `<g fill="${(i + row) % 2 === 0 ? CLOTH : CREAM}">${px(i * 2, CLOTH_Y + row, 2, 1)}</g>`).join(''),
    )
    .join('')

const mateSvg = (f: Meters) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    .steam1 { animation: steam 2s steps(4) infinite; }
    .steam2 { animation: steam 2s steps(4) -1s infinite; }
    .kettle-steam { animation: steam 2s steps(4) -0.5s infinite; }
    .boil1 { animation: steam 0.9s steps(3) infinite; }
    .boil2 { animation: steam 0.9s steps(3) -0.3s infinite; }
    .boil3 { animation: steam 0.9s steps(3) -0.6s infinite; }
    .rattle { animation: rattle 0.4s steps(1) infinite; }
    @keyframes rattle { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -1px); } }
    ${REFILL_CSS}
    @keyframes steam { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(0, -1px); opacity: 0; } }
    .warm { animation-name: cool; animation-timing-function: linear; animation-fill-mode: forwards; }
    @keyframes cool { from { opacity: 1; } to { opacity: 0; } }`,
    `
  ${tablecloth()}
  ${thermos(f.contextLeft, 0, f.isCompacting)}
  ${mate(f.cacheLeft, f.cacheTtl, SLOT)}
  ${plate(f.fiveHour, SLOT * 2)}
  ${pack(f.week, SLOT * 3)}`,
  )

// The scene in the small size, on a row of the tablecloth: the thermos, its
// strip of water as full as the context left (no kettle: while compacting the
// strip fills up); the mate, its steam thinning over the cache's hour, the
// yerba washed out once it expires; the plate with three medialunas, two, one
// or crumbs; and the pack of yerba, flatter as the week is used.
const CENTERS = [4, 15.5, 26, 35.5]

const mateSmall = (f: Meters) => {
  const water = f.isCompacting ? 5 : ([0, 1, 3, 5][stageOf(f.contextLeft)] ?? 0)
  const thermos = `
    <g fill="${STEEL_DARK}">${px(3, 0, 2, 1)}</g>
    <g fill="${STEEL}">${px(2, 1, 4, 1)}</g>
    <g fill="${THERMOS}">${px(2, 2, 3, 5)}</g>
    <g fill="${THERMOS_DARK}">${px(6, 3, 1, 2)}</g>
    <g fill="${GAUGE}">${px(5, 2, 1, 5)}</g>
    ${water > 0 ? `<g${f.isCompacting ? ' class="fill"' : ''} fill="${WATER}">${px(5, 7 - water, 1, water)}</g>` : ''}`

  const gourd = (yerba: string) => `
    <g fill="${GOURD}">${px(13, 4, 5, 2)}${px(14, 6, 3, 1)}</g>
    <g fill="${GOURD_LIGHT}">${px(14, 4)}</g>
    <g fill="${GOURD_DARK}">${px(17, 4, 1, 2)}</g>
    <g fill="${yerba}">${px(14, 3, 3, 1)}</g>
    <g fill="${STEEL}">${px(16, 2)}${px(17, 1)}${px(18, 0)}</g>`
  const steam = (wisps: number, opacity: number) =>
    `<g fill="${CREAM}" opacity="${opacity}">${[px(14, 2), px(15, 1)]
      .slice(0, wisps)
      .map((p, i) => `<g class="wisp${i}">${p}</g>`)
      .join('')}</g>`
  const mate = hourSteps(f, [gourd(YERBA) + steam(2, 0.6), gourd(YERBA) + steam(1, 0.6), gourd(YERBA) + steam(1, 0.3)], gourd(WASHED))

  const fiveLeft = f.fiveHour === null ? null : 100 - f.fiveHour
  const count = [0, 1, 2, 3][stageOf(fiveLeft)] ?? 0
  const medialuna = ([x, y]: readonly [number, number]) =>
    `<g fill="${PASTRY}">${px(x + 1, y, 1, 2)}</g><g fill="${PASTRY_DARK}">${px(x, y + 1)}${px(x + 2, y + 1)}</g>`
  const plate = `
    <g fill="${CREAM}">${px(22, 6, 9, 1)}</g>
    ${([[23, 4], [27, 4], [25, 2]] as const).slice(0, count).map(medialuna).join('')}
    ${fiveLeft !== null && count === 0 ? `<g fill="${PASTRY_DARK}">${px(24, 5)}${px(28, 5)}</g>` : ''}`

  const weekLeft = f.week === null ? null : 100 - f.week
  const top = [6, 5, 3, 1][stageOf(weekLeft)] ?? 6
  const pack = `
    <g fill="${PACK}">${px(34, top, 3, 7 - top)}</g>
    <g fill="${PACK_DARK}">${px(37, top, 1, 7 - top)}</g>
    ${top <= 3 ? `<g fill="${CREAM}">${px(34, top + 2, 3, top === 1 ? 2 : 1)}</g>` : ''}`

  const cloth = Array.from({ length: 10 }, (_, i) => `<g fill="${i % 2 === 0 ? CLOTH : CREAM}">${px(i * 4, 7, 2, 1)}</g><g fill="${i % 2 === 0 ? CREAM : CLOTH}">${px(i * 4 + 2, 7, 2, 1)}</g>`).join('')

  return smallSceneSvg(
    `
    .fill { animation: fill 2s steps(5) both; }
    @keyframes fill { from { clip-path: inset(5px 0 0 0); } to { clip-path: inset(0 0 0 0); } }
    .wisp0 { animation: wisp 1.6s steps(1) infinite; }
    .wisp1 { animation: wisp 1.6s steps(1) -0.8s infinite; }
    @keyframes wisp { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -1px); } }`,
    `${cloth}${thermos}${mate}${plate}${pack}`,
  )
}

export const mateScene: MeterScene = {
  name: 'mate',
  label: wordsOf(t => t.scenes.mate),
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: mateSvg,
  small: { svg: mateSmall, centers: CENTERS },
}
