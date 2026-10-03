// The gamer scene: the session's meters as a gaming desk lit by an RGB strip:
// a monitor's health hearts for the context, an arcade cabinet for the prompt
// cache, cans of energy drink for the five-hour limit, and a gamepad's battery
// for the week. Each has its number underneath in the 3x5 pixel font.
//
// The arcade's little hero walks to the flag by itself over the cache's hour,
// so the band need not be redrawn to keep it current; once the cache expires
// it is game over. At a quarter of the context or less the last heart blinks;
// while the conversation is compacted the hearts heal back to full.

import { wordsOf } from '../language'
import type { MeterScene, Meters } from './index'
import { COUNTDOWN_CSS, countdown, HEIGHT, hourSteps, percentText, pixelText, px, SCALE, sceneSvg, SLOT, smallSceneSvg, stageOf, WIDTH } from './pixels'

// Objects stand on the desk's lit edge at y 9.
const DESK_Y = 9

const RGB = ['#E8445A', '#F5C26B', '#5BD16E', '#5B8FD6', '#A86BE0']
const BEZEL = '#3A3A44'
const SCREEN = '#141B2E'
const HEART = '#E8445A'
const HEART_LIGHT = '#FF9AAA'
const HEART_EMPTY = '#4A2A33'
const CABINET = '#3B4FB8'
const CABINET_DARK = '#2C3A8A'
const PANEL = '#5A6FD8'
const MARQUEE = '#F5C26B'
const GROUND = '#5BD16E'
const HERO = '#F4F1E6'
const FLAG = '#E8445A'
const COIN = '#F5A623'
const CAN = '#46C46A'
const CAN_DARK = '#2E8A4A'
const BOLT = '#F5E04A'
const RIM = '#B0B0B8'
const CRUSHED = '#6E8A74'
const PAD = '#4A4A55'
const PAD_LIGHT = '#6A6A78'
const BUTTON_A = '#E8445A'
const BUTTON_B = '#5B8FD6'
const SHELL = '#C8C8C8'
const CELL = '#5BD16E'
const CELL_LOW = '#E8445A'

// A heart three pixels across: its left half (with the point) and its right.
const heartLeft = (x: number, y: number) => `${px(x, y, 1, 2)}${px(x + 1, y + 1, 1, 2)}`
const heartRight = (x: number, y: number) => px(x + 2, y, 1, 2)

// Where the hearts sit on the screen, from the left.
const HEARTS = [2, 6, 10]

// The pixels of the health still in the hearts: two halves to a heart.
const health = (x: number, halves: number) =>
  HEARTS.map((hx, i) => (halves >= 2 * i + 1 ? heartLeft(x + hx, 2) : '') + (halves >= 2 * i + 2 ? heartRight(x + hx, 2) : '')).join('')

// Context: a monitor showing three hearts of health, half a heart for every
// sixth of the context left. At a quarter or less what is left blinks; while
// the conversation is compacted the hearts heal back to full, from the left.
const monitor = (left: number | null, x: number, isCompacting: boolean) => {
  const halves = left === null ? 0 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * 6))
  const isLow = left !== null && left <= 25
  // How many columns of the hearts' eleven the health leaves bare.
  const last = halves === 0 ? null : (HEARTS[Math.ceil(halves / 2) - 1] ?? 0) + (halves % 2 === 1 ? 1 : 2)
  const bare = last === null ? 11 : 11 - (last - HEARTS[0]! + 1)
  const hearts = isCompacting
    ? `<g style="animation: heal${bare} 2s steps(${Math.max(1, bare)}) both">${health(x, 6)}</g>`
    : `<g${isLow ? ' class="lowhp"' : ''}>${health(x, halves)}</g>`
  return `
    <g fill="${BEZEL}">${px(x, 0, 15, 7)}${px(x + 7, 7)}${px(x + 5, 8, 5, 1)}</g>
    <g fill="${SCREEN}">${px(x + 1, 1, 13, 5)}</g>
    <g fill="${HEART_EMPTY}">${health(x, 6)}</g>
    <g fill="${HEART}">${hearts}</g>
    <g fill="${HEART_LIGHT}">${HEARTS.filter((_, i) => isCompacting || halves >= 2 * i + 1).map(hx => px(x + hx, 2)).join('')}</g>
    ${percentText(left, x)}`
}

// Where the arcade's hero stands as the hour goes by, from the screen's left.
const STRIDES = 5

// Cache: an arcade cabinet whose little hero walks to the flag by itself over
// the cache's hour; once the cache expires the screen goes dark and the coin
// slot blinks for another token.
const arcade = (left: number | null, ttl: number, x: number) => {
  const isOver = left !== null && left <= 0
  const timing = left === null || isOver ? '' : `animation-duration: ${ttl}s; animation-delay: -${ttl - left}s`
  const screen = isOver
    ? ''
    : `<g fill="${GROUND}">${px(x + 5, 2, 6, 1)}</g>
      <g fill="${FLAG}">${px(x + 10, -1)}</g><g fill="${HERO}">${px(x + 10, 0, 1, 2)}</g>
      <g class="${timing ? 'walk' : ''}" style="${timing}"><g class="${timing ? 'hop' : ''}" fill="${HERO}">${px(x + 5, 1)}</g></g>`
  return `
    <g fill="${MARQUEE}">${px(x + 4, -2, 8, 1)}</g>
    <g fill="${CABINET}">${px(x + 4, -1, 1, 10)}${px(x + 11, -1, 1, 10)}${px(x + 5, 3, 6, 1)}${px(x + 5, 5, 6, 4)}</g>
    <g fill="${SCREEN}">${px(x + 5, -1, 6, 4)}</g>
    ${screen}
    <g fill="${PANEL}">${px(x + 3, 4, 10, 1)}</g>
    <g fill="${HEART}">${px(x + 5, 3)}</g>
    <g fill="${BUTTON_B}">${px(x + 9, 3)}</g><g fill="${GROUND}">${px(x + 10, 3)}</g>
    <g fill="${CABINET_DARK}">${px(x + 6, 6, 4, 2)}</g>
    <g fill="${COIN}" class="${isOver ? 'coinslot' : ''}">${px(x + 7, 6, 2, 1)}</g>
    ${left === null ? pixelText('--', x) : isOver ? pixelText('0m', x) : countdown(left, x)}`
}

// Where the cans stand, from the left.
const CANS = [1, 5, 9, 13]

// An energy drink can, three pixels across, a bolt on its band.
const can = (x: number) => `
  <g fill="${RIM}">${px(x, 3, 3, 1)}${px(x + 1, 2)}</g>
  <g fill="${CAN}">${px(x, 4, 3, 5)}</g>
  <g fill="${CAN_DARK}">${px(x, 6, 3, 1)}${px(x + 2, 4, 1, 5)}</g>
  <g fill="${BOLT}">${px(x + 1, 6)}</g>`

// A can drunk and crushed.
const crushed = (x: number) => `<g fill="${CRUSHED}">${px(x, 8, 3, 1)}${px(x + 1, 7)}</g>`

// Five-hour limit: a can of energy drink for every quarter of the window
// still free; the drunk ones lie crushed.
const cans = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const count = left === null ? CANS.length : Math.min(CANS.length, Math.max(0, Math.ceil(left / 25)))
  return `
    ${CANS.map((cx, i) => (i < count ? can(x + cx) : crushed(x + cx))).join('')}
    ${percentText(left, x)}`
}

// Weekly limit: a gamepad under a battery with a cell for every quarter of the
// week still free; the last one blinks red.
const gamepad = (used: number | null, x: number) => {
  const left = used === null ? null : 100 - used
  const cells = left === null ? 4 : Math.max(left > 0 ? 1 : 0, Math.round((left / 100) * 4))
  const isLow = cells === 1
  return `
    <g fill="${SHELL}">${px(x + 3, 0, 10, 1)}${px(x + 3, 3, 10, 1)}${px(x + 3, 1, 1, 2)}${px(x + 12, 1, 1, 2)}${px(x + 13, 1, 1, 2)}</g>
    <g fill="${isLow ? CELL_LOW : CELL}"${isLow ? ' class="lowcell"' : ''}>${Array.from({ length: cells }, (_, i) => px(x + 4 + i * 2, 1, 2, 2)).join('')}</g>
    <g fill="${PAD_LIGHT}">${px(x + 4, 5, 8, 1)}</g>
    <g fill="${PAD}">${px(x + 3, 6, 10, 1)}${px(x + 2, 7, 12, 1)}${px(x + 2, 8, 3, 1)}${px(x + 11, 8, 3, 1)}</g>
    <g fill="${SCREEN}">${px(x + 4, 6, 1, 2)}${px(x + 3, 7, 3, 1)}</g>
    <g fill="${BUTTON_A}">${px(x + 11, 6)}</g><g fill="${BUTTON_B}">${px(x + 12, 7)}</g><g fill="${GROUND}">${px(x + 10, 7)}</g>
    ${percentText(left, x)}`
}

// The desk's edge: an RGB strip whose colors chase each other along it.
const strip = () =>
  Array.from({ length: WIDTH / 4 }, (_, i) => `<g class="rgb" style="animation-delay: -${(i * 0.4).toFixed(1)}s">${px(i * 4, DESK_Y, 4, 1)}</g>`).join('')

// The hearts' eleven columns uncovered from the left, from `n` bare to none.
const HEAL_CSS = Array.from({ length: 12 }, (_, n) =>
  `@keyframes heal${n} { from { clip-path: inset(0 ${n}px 0 0); } to { clip-path: inset(0 0 0 0); } }`).join('\n    ')

const gamerSvg = (f: Meters) =>
  sceneSvg(
    `${COUNTDOWN_CSS}
    ${HEAL_CSS}
    .rgb { animation: rgb 4s steps(1) infinite; }
    @keyframes rgb { ${RGB.map((c, i) => `${((i / RGB.length) * 100).toFixed(1)}% { fill: ${c}; }`).join(' ')} 100% { fill: ${RGB[0]}; } }
    .lowhp, .lowcell { animation: lowblink 0.8s steps(1) infinite; }
    @keyframes lowblink { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0.2; } }
    .walk { animation-name: walk; animation-timing-function: steps(${STRIDES}); animation-fill-mode: forwards; }
    @keyframes walk { from { transform: translate(0, 0); } to { transform: translate(${STRIDES}px, 0); } }
    .hop { animation: hop 0.8s steps(1) infinite; }
    @keyframes hop { 0%, 79.9% { transform: translate(0, 0); } 80%, 100% { transform: translate(0, -1px); } }
    .coinslot { animation: lowblink 1s steps(1) infinite; }`,
    `
  ${strip()}
  ${monitor(f.contextLeft, 0, f.isCompacting)}
  ${arcade(f.cacheLeft, f.cacheTtl, SLOT)}
  ${cans(f.fiveHour, SLOT * 2)}
  ${gamepad(f.week, SLOT * 3)}`,
  )

// The scene in the small size, on the desk's RGB strip: the monitor, a
// heart of health for each step of the context left, the last one blinking
// at a quarter or less, healing while compacting; the arcade cabinet, its
// hero walking to the flag over the cache's hour, game over once it expires;
// the cans of energy drink, crushed as the five-hour limit goes; and the
// gamepad's battery, running down over the week.
const CENTERS = [4.5, 15.5, 25.5, 36]

// The strip's colors, repeated along it and shifting by themselves.
const STRIP = [HEART, MARQUEE, GROUND, BUTTON_B, PANEL, HEART_LIGHT]

const gamerSmall = (f: Meters) => {
  const hearts = f.isCompacting ? 3 : ([0, 1, 2, 3][stageOf(f.contextLeft)] ?? 0)
  const heart = (i: number) => {
    const x = 1 + i * 3
    if (f.isCompacting) {
      return `<g fill="${HEART_EMPTY}">${px(x, 2, 2, 2)}</g><g class="heal${i}"><g fill="${HEART}">${px(x, 2, 2, 2)}</g><g fill="${HEART_LIGHT}">${px(x, 2)}</g></g>`
    }
    if (i >= hearts) {
      return `<g fill="${HEART_EMPTY}">${px(x, 2, 2, 2)}</g>`
    }
    const full = `<g fill="${HEART}">${px(x, 2, 2, 2)}</g><g fill="${HEART_LIGHT}">${px(x, 2)}</g>`
    return hearts === 1 ? `<g fill="${HEART_EMPTY}">${px(x, 2, 2, 2)}</g><g class="blink">${full}</g>` : full
  }
  const monitor = `
    <g fill="${BEZEL}">${px(0, 0, 10, 6)}${px(4, 6, 2, 1)}</g>
    <g fill="${SCREEN}">${px(1, 1, 8, 4)}</g>
    ${[0, 1, 2].map(heart).join('')}`

  const cabinet = (screen: string) => `
    <g fill="${CABINET}">${px(12, 0, 7, 7)}</g>
    <g fill="${CABINET_DARK}">${px(19, 0, 1, 7)}</g>
    <g fill="${MARQUEE}">${px(13, 0, 5, 1)}</g>
    <g fill="${SCREEN}">${px(13, 1, 5, 3)}</g>
    ${screen}
    <g fill="${PANEL}">${px(13, 5, 5, 1)}</g>
    <g fill="${BUTTON_A}">${px(14, 5)}</g><g fill="${BUTTON_B}">${px(16, 5)}</g>`
  const screenAt = (hero: number) => `
    <g fill="${GROUND}">${px(13, 3, 5, 1)}</g>
    <g fill="${FLAG}">${px(17, 1)}</g><g fill="${RIM}">${px(17, 2)}</g>
    <g class="walk" fill="${HERO}">${px(hero, 2)}</g>`
  const arcade = hourSteps(
    f,
    [cabinet(screenAt(13)), cabinet(screenAt(14)), cabinet(screenAt(16))],
    cabinet(`<g fill="${HEART}">${px(14, 1)}${px(16, 1)}${px(15, 2)}${px(14, 3)}${px(16, 3)}</g>`),
  )

  const fiveLeft = f.fiveHour === null ? null : 100 - f.fiveHour
  const standing = [0, 1, 2, 3][stageOf(fiveLeft)] ?? 0
  const can = (x: number, i: number) =>
    i < standing
      ? `<g fill="${RIM}">${px(x, 3, 2, 1)}</g><g fill="${CAN}">${px(x, 4, 1, 3)}</g><g fill="${CAN_DARK}">${px(x + 1, 4, 1, 3)}</g><g fill="${BOLT}">${px(x, 5)}</g>`
      : `<g fill="${CRUSHED}">${px(x, 6, 2, 1)}</g>`
  const cans = [22, 25, 28].map(can).join('')

  const weekLeft = f.week === null ? null : 100 - f.week
  const cells = [0, 1, 2, 3][stageOf(weekLeft)] ?? 0
  const gamepad = `
    <g fill="${SHELL}">${px(34, 1, 5, 1)}${px(34, 3, 5, 1)}${px(34, 2)}${px(38, 2)}${px(39, 2)}</g>
    ${cells > 0 ? `<g fill="${cells === 1 ? CELL_LOW : CELL}">${px(35, 2, cells, 1)}</g>` : ''}
    <g fill="${PAD_LIGHT}">${px(34, 5, 5, 1)}</g>
    <g fill="${PAD}">${px(33, 6, 7, 1)}${px(35, 5)}</g>
    <g fill="${BUTTON_A}">${px(37, 5)}</g><g fill="${BUTTON_B}">${px(38, 6)}</g>`

  const strip = Array.from({ length: 46 }, (_, i) => `<g fill="${STRIP[i % STRIP.length]}">${px(i, 7)}</g>`).join('')

  return smallSceneSvg(
    `
    .blink { animation: blink 0.8s steps(1) infinite; }
    @keyframes blink { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .heal0, .heal1, .heal2 { animation: heal 2s steps(1) both; }
    .heal1 { animation-name: heal1; }
    .heal2 { animation-name: heal2; }
    @keyframes heal { 0%, 32.9% { opacity: 0; } 33%, 100% { opacity: 1; } }
    @keyframes heal1 { 0%, 65.9% { opacity: 0; } 66%, 100% { opacity: 1; } }
    @keyframes heal2 { 0%, 98.9% { opacity: 0; } 99%, 100% { opacity: 1; } }
    .walk { animation: walk 0.8s steps(1) infinite; }
    @keyframes walk { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -1px); } }
    .strip { animation: strip 1.2s steps(6) infinite; }
    @keyframes strip { from { transform: translate(0, 0); } to { transform: translate(-6px, 0); } }`,
    `<g class="strip">${strip}</g>${monitor}${arcade}${cans}${gamepad}`,
  )
}

export const gamerScene: MeterScene = {
  name: 'gamer',
  label: wordsOf(t => t.scenes.gamer),
  width: WIDTH,
  height: HEIGHT,
  scale: SCALE,
  svg: gamerSvg,
  small: { svg: gamerSmall, centers: CENTERS },
}
