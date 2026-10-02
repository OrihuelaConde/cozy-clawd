// The balcony scene: the session's figures as things on a sunny balcony: a
// watering can for the context, a daisy in a pot for the prompt cache, a bird
// feeder for the five-hour limit, and a jar of honey for the week. Each has its
// number underneath in the 3x5 pixel font.
//
// The daisy wilts by itself over the cache's hour, so the band need not be
// redrawn to keep it current. At a quarter of the context or less a rain cloud
// gathers over the watering can; while the conversation is compacted it rains
// and the can fills up.

import type { FigureScene, Figures } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, level, percentText, pixelText, px, refill, REFILL_CSS, SCALE, sceneSvg, SLOT, WIDTH } from './pixels'

// Objects stand on the floor tiles at y 9.
const FLOOR_Y = 9

const TILE = '#B5674A'
const TILE_DARK = '#8F4E37'
const RAIL = '#3A332D'
const CAN = '#5E8C6A'
const CAN_DARK = '#476B51'
const WATER = '#8FD3F0'
const CLOUD = '#B8C4D6'
const CLOUD_DARK = '#8E9AB0'
const POT = '#C2693E'
const POT_DARK = '#9A4F2E'
const SOIL = '#5A3A24'
const STEM = '#6FA35A'
const STEM_DRY = '#8A7A4A'
const PETAL = '#F4F1E6'
const PETAL_DRY = '#A07850'
const HEART = '#F5C26B'
const WOOD = '#A0785A'
const WOOD_DARK = '#7A5A42'
const GLASS = '#8C8A84'
const SEED = '#D9B26A'
const SEED_DARK = '#A07840'
const BIRD = '#5B8FD6'
const BIRD_DARK = '#3F6DAE'
const BIRD_BELLY = '#A9C6EE'
const BEAK = '#F5A623'
const EYE = '#F4F1E6'
const STRIPE = '#7A5520'
const HONEY = '#E0A030'
const HONEY_LIGHT = '#F2C45A'
const CLOTH = '#B5483E'
const CREAM = '#E8E6DC'
const BEE = '#F5C26B'

// The can holds this many rows of water.
const CAN_ROWS = 5

// A small rain cloud over the can's mouth. While the conversation is
// compacted, rain falls from it into the can.
const cloud = (x: number, isRaining: boolean) => `
  <g class="drift">
    <g fill="${CLOUD}">${px(x + 6, -2, 4, 1)}${px(x + 5, -1, 7, 1)}</g>
    <g fill="${CLOUD_DARK}">${px(x + 5, -1)}${px(x + 11, -1)}</g>
  </g>
  ${isRaining ? `<g fill="${WATER}">
    <g class="rain1">${px(x + 6, 0)}</g><g class="rain2">${px(x + 8, 0)}</g><g class="rain3">${px(x + 10, 0)}</g>
  </g>` : ''}`

// Context: a watering can, open at the top and seen through, its handle at
// the back and its spout rising to the left; its water level is the context
// left. A drop falls from its rose now and then while there is water to spare. At a
// quarter or less a rain cloud gathers over it; while the conversation is
// compacted the cloud rains and the can fills up.
const wateringCan = (left: number | null, x: number, isCompacting: boolean) => {
  const rows = left === null ? 0 : level(left, CAN_ROWS)
  const isLow = left !== null && left <= 25
  const water = isCompacting
    ? `<g style="${refill(CAN_ROWS - rows)}">${px(x + 6, 8 - CAN_ROWS, 5, CAN_ROWS)}</g>`
    : rows > 0 ? px(x + 6, 8 - rows, 5, rows) : ''
  return `
    <g fill="${WATER}">${water}</g>
    <g fill="${CAN}">${px(x + 5, 3, 1, 6)}${px(x + 11, 3, 1, 6)}${px(x + 6, 8, 5, 1)}${px(x + 4, 6)}${px(x + 3, 5)}${px(x + 2, 4)}</g>
    <g fill="${CAN_DARK}">${px(x + 4, 2, 2, 1)}${px(x + 11, 2, 2, 1)}${px(x + 13, 3)}${px(x + 14, 4, 1, 2)}${px(x + 13, 6)}${px(x + 12, 6)}${px(x + 1, 3)}${px(x, 2, 1, 2)}</g>
    ${rows > 1 && !isCompacting ? `<g fill="${WATER}"><g class="drip">${px(x, 4)}</g></g>` : ''}
    ${isLow || isCompacting ? cloud(x, isCompacting) : ''}
    ${percentText(left, x)}`
}

// A daisy's head around (cx, cy): petals five pixels across around a
// one-pixel heart.
const bloom = (cx: number, cy: number, petal: string, heart: string, petalOpacity = 1) => `
  <g fill="${petal}" opacity="${petalOpacity}">${px(cx, cy - 2)}${px(cx - 1, cy - 1, 3, 1)}${px(cx - 2, cy, 2, 1)}${px(cx + 1, cy, 2, 1)}${px(cx - 1, cy + 1, 3, 1)}${px(cx, cy + 2)}</g>
  <g fill="${heart}">${px(cx, cy)}</g>`

// The daisy in its four stages over the cache's hour: upright, nodding,
// drooping, wilted; each a group shown for its quarter.
const daisy = (x: number, timing: string) => `
  <g class="stage0" style="${timing}">
    <g fill="${STEM}">${px(x + 8, 3, 1, 2)}${px(x + 9, 3)}${px(x + 7, 4)}</g>
    ${bloom(x + 8, 0, PETAL, HEART)}
  </g>
  <g class="stage1" style="${timing}">
    <g fill="${STEM}">${px(x + 8, 3, 1, 2)}${px(x + 9, 3)}${px(x + 7, 4)}</g>
    ${bloom(x + 10, 0, PETAL, HEART)}
  </g>
  <g class="stage2" style="${timing}">
    <g fill="${STEM}">${px(x + 8, 1, 1, 4)}${px(x + 9, 0)}${px(x + 10, 0)}${px(x + 7, 4)}</g>
    ${bloom(x + 12, 2, PETAL, HEART, 0.8)}
  </g>
  <g class="stage3" style="${timing}">
    <g fill="${STEM_DRY}">${px(x + 8, 2, 1, 3)}${px(x + 9, 1)}${px(x + 10, 1)}${px(x + 11, 2)}${px(x + 7, 4)}</g>
    <g fill="${PETAL_DRY}">${px(x + 12, 3)}${px(x + 11, 4)}${px(x + 13, 4)}${px(x + 12, 5, 2, 1)}</g>
    <g fill="${HEART}" opacity="0.7">${px(x + 12, 4)}</g>
  </g>`

// The pot the daisy grows in.
const pot = (x: number) => `
  <g fill="${POT}">${px(x + 5, 5, 7, 1)}${px(x + 6, 6, 5, 3)}</g>
  <g fill="${POT_DARK}">${px(x + 5, 5, 7, 1)}${px(x + 10, 6, 1, 3)}</g>
  <g fill="${SOIL}">${px(x + 6, 5, 5, 1)}</g>`

// Cache: a daisy in a pot. It wilts by itself over the cache's hour, one stage
// a quarter, and stays wilted, with a fallen petal, once the cache expires.
const flowerPot = (left: number | null, ttl: number, x: number) => {
  if (left === null) {
    return `${pot(x)}<g fill="${STEM}">${px(x + 8, 3, 1, 2)}${px(x + 9, 3)}</g>${pixelText('--', x)}`
  }
  if (left <= 0) {
    return `${pot(x)}
      <g fill="${STEM_DRY}">${px(x + 8, 3, 1, 2)}${px(x + 9, 2)}${px(x + 10, 2)}${px(x + 11, 3)}${px(x + 7, 4)}</g>
      <g fill="${PETAL_DRY}">${px(x + 11, 4)}${px(x + 12, 5)}${px(x + 13, 8)}</g>
      ${pixelText('0m', x)}`
  }
  return `
    ${daisy(x, `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`)}
    ${pot(x)}
    ${countdown(left, x)}`
}

// Where the seeds sit in the feeder's glass, from the bottom.
const SEED_ROWS = 5

// Five-hour limit: a bird feeder whose glass holds the seeds left, a row for
// every fifth of the window, a bluebird pecking at the tray. With the seeds
// gone, so is the bird.
const feeder = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? SEED_ROWS : level(left, SEED_ROWS)
  return `
    <g fill="${WOOD_DARK}">${px(x + 9, 6, 1, 2)}${px(x + 8, 8, 3, 1)}${px(x + 8, -2, 3, 1)}</g>
    <g fill="${WOOD}">${px(x + 6, -1, 7, 1)}${px(x + 1, 5, 14, 1)}${px(x + 14, 4)}</g>
    <g fill="${GLASS}">${px(x + 7, 0, 1, 5)}${px(x + 11, 0, 1, 5)}</g>
    ${rows > 0 ? `<g fill="${SEED}">${px(x + 8, 5 - rows, 3, rows)}</g>
    <g fill="${SEED_DARK}">${Array.from({ length: rows }, (_, i) => px(x + 8 + ((i * 2) % 3), 4 - i)).join('')}${px(x + 6, 4)}${px(x + 12, 4)}</g>
    <g fill="${BIRD}">${px(x + 2, 3, 3, 2)}</g>
    <g fill="${BIRD_DARK}">${px(x + 2, 3, 2, 1)}${px(x + 1, 3)}${px(x, 2)}</g>
    <g fill="${BIRD_BELLY}">${px(x + 3, 4, 2, 1)}</g>
    <g class="peck">
      <g fill="${BIRD}">${px(x + 4, 2, 2, 1)}${px(x + 5, 3)}</g>
      <g fill="${EYE}">${px(x + 5, 2)}</g>
      <g fill="${BEAK}">${px(x + 6, 3)}</g>
    </g>` : ''}
    ${percentText(left, x)}`
}

// Where the honey sits in the jar, from the bottom.
const HONEY_ROWS = 5

// Weekly limit: a jar of honey under a checked cloth that empties as the
// week's limit is used, a row for every fifth of the week, a bee buzzing
// around it while there is honey.
const honeyJar = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const rows = left === null ? HONEY_ROWS : level(left, HONEY_ROWS)
  return `
    ${rows > 0 ? `<g fill="${HONEY}">${px(x + 6, 8 - rows, 5, rows)}</g><g fill="${HONEY_LIGHT}">${px(x + 7, 8 - rows, 1, rows)}</g>` : ''}
    <g fill="${GLASS}">${px(x + 5, 3, 1, 6)}${px(x + 11, 3, 1, 6)}${px(x + 6, 8, 5, 1)}</g>
    <g fill="${CREAM}">${px(x + 4, 1, 9, 1)}${px(x + 4, 2)}${px(x + 12, 2)}</g>
    <g fill="${CLOTH}">${px(x + 5, 1)}${px(x + 7, 1)}${px(x + 9, 1)}${px(x + 11, 1)}${px(x + 5, 2, 7, 1)}</g>
    <g fill="#FFFFFF" opacity="0.4">${px(x + 10, 4, 1, 2)}</g>
    ${rows > 0 ? `<g class="bee">
      <g fill="${BEE}">${px(x + 13, -1)}${px(x + 15, -1)}</g><g fill="${STRIPE}">${px(x + 14, -1)}</g>
      <g class="wings" fill="${CREAM}" opacity="0.8">${px(x + 14, -2)}</g>
    </g>` : ''}
    ${percentText(left, x)}`
}

// The balcony: a dim railing behind everything and a row of floor tiles. The
// balusters stand where no glass or open can lets them show through.
const railing = () => `
  <g fill="${RAIL}">${px(0, 0, WIDTH, 1)}${Array.from({ length: WIDTH / 8 }, (_, i) => px(i * 8 + 3, 1, 1, FLOOR_Y - 1)).join('')}</g>`

const floor = () =>
  Array.from({ length: WIDTH / 4 }, (_, i) => `<g fill="${i % 2 === 0 ? TILE : TILE_DARK}">${px(i * 4, FLOOR_Y, 4, 1)}</g>`).join('')

const balconySvg = (f: Figures) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${REFILL_CSS}
    .drift { animation: drift 4s steps(1) infinite; }
    @keyframes drift { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(1px, 0); } }
    .rain1 { animation: rain 0.6s steps(3) infinite; }
    .rain2 { animation: rain 0.6s steps(3) -0.2s infinite; }
    .rain3 { animation: rain 0.6s steps(3) -0.4s infinite; }
    @keyframes rain { from { transform: translate(0, 0); } to { transform: translate(0, 3px); } }
    .drip { animation: drip 3s steps(1) infinite; }
    @keyframes drip { 0%, 69.9% { opacity: 0; transform: translate(0, 0); } 70%, 79.9% { opacity: 1; transform: translate(0, 1px); } 80%, 89.9% { opacity: 1; transform: translate(0, 3px); } 90%, 100% { opacity: 0; transform: translate(0, 4px); } }
    .stage0 { animation-name: stage0; }
    .stage1 { animation-name: stage1; }
    .stage2 { animation-name: stage2; }
    .stage3 { animation-name: stage3; }
    .stage0, .stage1, .stage2, .stage3 { animation-timing-function: steps(1); animation-fill-mode: forwards; }
    @keyframes stage0 { 0%, 24.9% { opacity: 1; } 25%, 100% { opacity: 0; } }
    @keyframes stage1 { 0%, 24.9% { opacity: 0; } 25%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    @keyframes stage2 { 0%, 49.9% { opacity: 0; } 50%, 74.9% { opacity: 1; } 75%, 100% { opacity: 0; } }
    @keyframes stage3 { 0%, 74.9% { opacity: 0; } 75%, 100% { opacity: 1; } }
    .peck { animation: peck 1.4s steps(1) infinite; }
    @keyframes peck { 0%, 59.9% { transform: translate(0, 0); } 60%, 69.9% { transform: translate(0, 1px); } 70%, 79.9% { transform: translate(0, 0); } 80%, 89.9% { transform: translate(0, 1px); } 90%, 100% { transform: translate(0, 0); } }
    .bee { animation: buzz 3.2s steps(16) infinite; }
    @keyframes buzz { 0% { transform: translate(0, 0); } 25% { transform: translate(-3px, 1px); } 50% { transform: translate(-6px, 0); } 75% { transform: translate(-3px, -1px); } 100% { transform: translate(0, 0); } }
    .wings { animation: flap 0.2s steps(1) infinite; }
    @keyframes flap { 0%, 49.9% { opacity: 0.8; } 50%, 100% { opacity: 0; } }`,
    `
  ${railing()}
  ${floor()}
  ${wateringCan(f.contextLeft, 0, f.isCompacting)}
  ${flowerPot(f.cacheLeft, f.cacheTtl, SLOT)}
  ${feeder(f.fiveHour, SLOT * 2)}
  ${honeyJar(f.week, SLOT * 3)}`,
  )

export const balconyScene: FigureScene = {
  name: 'balcony',
  label: { es: 'Balcón', en: 'Balcony' },
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: balconySvg,
}
