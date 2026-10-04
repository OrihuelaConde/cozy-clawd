import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionCompactResult, SessionUsage, Timer } from 'claude-code'

import type { ClawdMode, Size, Stats } from '../types'
import { smallScene, smallSvg } from './small'
import type { ScenePick } from './small'
import { DEFAULT_METER_SCENE, METER_SCENES, meterSceneNamed, metersAlt, numbersLine } from './scenes/index'
import type { Meters } from './scenes/index'
import { INK, LOW_AT } from './scenes/pixels'
import { DEFAULT_LANG, ENGLISH_NAMES, LANG_NAMES, LANGS, langOf, TEXTS, wordsOf } from './language'
import type { Lang, LangChoice, Words } from './language'
import { columnsOf, isMeasuredShort, pictureOf, textCells } from './raster'
import type { Picture } from './raster'

const PANEL = 'clawd'
// The slash commands: the panel, and the scene by name.
const PANEL_COMMAND = 'cozy-clawd'
const SCENE_COMMAND = 'cozy-clawd-scene'
const mode = atom({ plugin: 'cozy-clawd', key: 'mode' } as const, 'idle')
const tool = atom({ plugin: 'cozy-clawd', key: 'tool' } as const, null)
// Claude Code keeps the prompt cache an hour or five minutes (cacheTtlOf);
// an hour until the session says otherwise.
const HOUR_S = 60 * 60
const FIVE_MINUTES_S = 5 * 60
const NO_STATS: Stats = { contextLeft: null, fiveHour: null, week: null, fiveHourResetsAt: null, weekResetsAt: null, cacheAt: null, cacheTtl: HOUR_S }
const stats = atom({ plugin: 'cozy-clawd', key: 'stats' } as const, NO_STATS)
const isConfirming = atom({ plugin: 'cozy-clawd', key: 'isConfirming' } as const, false)
const redraws = atom({ plugin: 'cozy-clawd', key: 'redraws' } as const, 0)
const sceneName = atom({ plugin: 'cozy-clawd', key: 'sceneName' } as const, DEFAULT_METER_SCENE.name)
const langChoice = atom({ plugin: 'cozy-clawd', key: 'langChoice' } as const, 'auto')
const sizeName = atom({ plugin: 'cozy-clawd', key: 'sizeName' } as const, 'small')

const BODY = '#D97757'
const EYE = '#1F1E1D'
const SPARK = '#F5C26B'
const DOT = '#B0AEA5'
const HANDLE = '#A0785A'
const STEEL = '#9A9A9A'
const SHELL = '#E0453A'
const WING = '#E8E6DC'
const SKY = '#8FB8DE'
const LEAF = '#9BC48A'

// CSS pixels per sprite pixel across; a sprite pixel is twice as tall.
const SCALE = 3
// The scene's box in sprite pixels: room for props on the right and above.
const VIEW_W = 25
const VIEW_H = 8
// Sprite rows above Clawd's head, where flying and floating props go.
const HEADROOM = 3

// Clawd as drawn on the terminal's welcome screen: 18 x 5 pixels, each twice
// as tall as wide like a terminal's quarter-block cell. Coordinates are in
// sprite pixels with Clawd's head at y 0; a prop's square pixel is 1 x 0.5.
const px = (x: number, y: number, w = 1, h = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`

const sprite = (eyes: string) => `
  <g class="body" fill="${BODY}">${px(3, 0, 12, 4)}</g>
  <g class="arm-l" fill="${BODY}">${px(1, 2, 2, 1)}</g>
  <g class="arm-r" fill="${BODY}">${px(15, 2, 2, 1)}</g>
  <g class="legs-a" fill="${BODY}">${px(4, 4)}${px(11, 4)}</g>
  <g class="legs-b" fill="${BODY}">${px(6, 4)}${px(13, 4)}</g>
  <g class="eyes" fill="${EYE}">${eyes}</g>`

const OPEN_EYES = px(5, 1) + px(12, 1)
const CLOSED_EYES = px(5, 1.6, 1, 0.4) + px(12, 1.6, 1, 0.4)

// A "z" three pixels wide and five half-pixels tall, its stroke on the diagonal.
const zee = (x: number, y: number) =>
  px(x, y, 3, 0.5) + px(x + 2, y + 0.5, 1, 0.5) + px(x + 1, y + 1, 1, 0.5) + px(x, y + 1.5, 1, 0.5) + px(x, y + 2, 3, 0.5)

// What Clawd does in one mode. `body` stands in for the one sprite when the
// scene draws several Clawds of its own (the pastimes, taking turns).
type Scene = { label: Words; eyes?: string; extra: string; css: string; body?: string }

const BLINK = `
  @keyframes blink { 0%, 92% { opacity: 1; } 93%, 100% { opacity: 0; } }`

// Hammering in three frames: raised, swinging, struck with sparks.
const toolUse: Scene = {
  label: wordsOf(t => t.states.working),
  extra: `
    <g class="up">
      <g fill="${HANDLE}">${px(17, -1, 1, 3)}</g>
      <g fill="${STEEL}">${px(16, -2, 3, 1)}</g>
    </g>
    <g class="mid">
      <g fill="${HANDLE}">${px(17, 1.5, 1, 0.5)}${px(18, 1, 1, 0.5)}${px(19, 0.5, 1, 0.5)}</g>
      <g fill="${STEEL}">${px(19.5, -0.5, 2, 1)}</g>
    </g>
    <g class="down">
      <g fill="${HANDLE}">${px(17, 2, 3, 0.5)}</g>
      <g fill="${STEEL}">${px(20, 1, 1, 3)}</g>
      <g fill="${SPARK}">${px(22, 0.5, 1, 0.5)}${px(22, 3.5, 1, 0.5)}${px(23, 2, 1, 0.5)}</g>
    </g>`,
  css: `
    .up { animation: up 0.7s steps(1) infinite; }
    .mid { animation: mid 0.7s steps(1) infinite; }
    .down { animation: down 0.7s steps(1) infinite; }
    .arm-r { animation: lift 0.7s steps(1) infinite; }
    .clawd { animation: thud 0.7s steps(1) infinite; }
    @keyframes up { 0%, 39.9% { opacity: 1; } 40%, 100% { opacity: 0; } }
    @keyframes mid { 0%, 39.9% { opacity: 0; } 40%, 54.9% { opacity: 1; } 55%, 100% { opacity: 0; } }
    @keyframes down { 0%, 54.9% { opacity: 0; } 55%, 100% { opacity: 1; } }
    @keyframes lift { 0%, 39.9% { transform: translate(0, -1px); } 40%, 54.9% { transform: translate(0, -0.5px); } 55%, 100% { transform: translate(0, 0); } }
    @keyframes thud { 0%, 54.9% { transform: translate(0, 0); } 55%, 69.9% { transform: translate(0, 0.5px); } 70%, 100% { transform: translate(0, 0); } }`,
}

const scenes: Record<Exclude<ClawdMode, 'waiting'>, Scene> = {
  // Nothing to do and the prompt cache expired: asleep, breathing slowly, z's
  // drifting up. With the cache still warm Clawd passes the time instead.
  idle: {
    label: wordsOf(t => t.states.sleeping),
    eyes: CLOSED_EYES,
    extra: `
      <g fill="${DOT}">
        <g class="z1">${zee(18, -0.5)}</g>
        <g class="z2">${zee(21, -2.5)}</g>
      </g>`,
    css: `
      .clawd { animation: breathe 3s steps(1) infinite; }
      .z1 { animation: drift 3s linear infinite; }
      .z2 { animation: drift 3s linear 1.5s infinite; opacity: 0; }
      @keyframes breathe { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 0.25px); } }
      @keyframes drift { 0% { opacity: 0; transform: translate(0, 0.5px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(1px, -0.5px); } }`,
  },
  // A model request in flight: the engine hands the response over whole, so
  // this covers waiting and generating alike. Clawd stacks blocks one by one,
  // lifting an arm to place each; the finished stack sparkles and clears.
  requesting: {
    label: wordsOf(t => t.states.workingOnAnswer),
    extra: `
      <g class="b1" fill="${SPARK}">${px(18, 4, 2, 1)}</g>
      <g class="b2" fill="${SKY}">${px(20, 4, 2, 1)}</g>
      <g class="b3" fill="${LEAF}">${px(19, 3, 2, 1)}</g>
      <g class="done" fill="${WING}">${px(17, 2.5, 1, 0.5)}${px(22, 2, 1, 0.5)}${px(23, 3.5, 1, 0.5)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .arm-r { animation: place 2.4s steps(1) infinite; }
      .b1 { animation: drop1 2.4s steps(48) infinite; }
      .b2 { animation: drop2 2.4s steps(48) infinite; }
      .b3 { animation: drop3 2.4s steps(48) infinite; }
      .done { animation: done 2.4s steps(1) infinite; }
      @keyframes place {
        0%, 11.9% { transform: translate(0, -1px); } 12%, 19.9% { transform: translate(0, 0); }
        20%, 31.9% { transform: translate(0, -1px); } 32%, 39.9% { transform: translate(0, 0); }
        40%, 51.9% { transform: translate(0, -1px); } 52%, 100% { transform: translate(0, 0); }
      }
      @keyframes drop1 { 0% { transform: translate(0, -5px); } 12%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes drop2 { 0%, 19% { transform: translate(0, -5px); opacity: 0; } 20% { transform: translate(0, -5px); opacity: 1; } 32%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes drop3 { 0%, 39% { transform: translate(0, -4px); opacity: 0; } 40% { transform: translate(0, -4px); opacity: 1; } 52%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes done { 0%, 55.9% { opacity: 0; } 56%, 63.9% { opacity: 1; } 64%, 69.9% { opacity: 0; } 70%, 77.9% { opacity: 1; } 78%, 100% { opacity: 0; } }
      ${BLINK}`,
  },
  // Compacting the conversation: three loose sheets are pressed together,
  // Clawd's arm pushing down, until they are one small golden block.
  compacting: {
    label: wordsOf(t => t.states.compacting),
    extra: `
      <g class="sheets" fill="${WING}">
        <g class="s1">${px(18, 1.5, 4, 0.5)}</g>
        <g class="s2">${px(19, 2.5, 4, 0.5)}</g>
        <g class="s3">${px(18, 3.5, 4, 0.5)}</g>
      </g>
      <g class="cube" fill="${SPARK}">${px(19, 3, 2, 1)}</g>
      <g class="cube" fill="#FFFFFF" opacity="0.6">${px(19, 3, 1, 0.5)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0.5px); }
      .arm-r { animation: press 2.4s steps(1) infinite; }
      .s1 { animation: s1 2.4s steps(1) infinite; }
      .s2 { animation: s2 2.4s steps(1) infinite; }
      .sheets { animation: sheets 2.4s steps(1) infinite; }
      .cube { animation: cube 2.4s steps(1) infinite; }
      @keyframes press { 0%, 34.9% { transform: translate(0, -1px); } 35%, 69.9% { transform: translate(0, 0.5px); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes s1 { 0%, 34.9% { transform: translate(0, 0); } 35%, 49.9% { transform: translate(0, 1px); } 50%, 100% { transform: translate(0, 2px); } }
      @keyframes s2 { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(-1px, 1px); } }
      @keyframes sheets { 0%, 69.9% { opacity: 1; } 70%, 100% { opacity: 0; } }
      @keyframes cube { 0%, 69.9% { opacity: 0; } 70%, 100% { opacity: 1; } }`,
  },
  // A compaction just finished: Clawd hops twice for joy, arms up, among sparkles.
  compacted: {
    label: wordsOf(t => t.states.compacted),
    eyes: px(5, 1, 1, 0.5) + px(12, 1, 1, 0.5),
    extra: `
      <g fill="${SPARK}">
        <g class="k1">${px(17, -1, 1, 0.5)}${px(1, -1.5, 1, 0.5)}</g>
        <g class="k2">${px(19, 1, 1, 0.5)}${px(0, 0.5, 1, 0.5)}</g>
        <g class="k3">${px(18, -2.5, 1, 0.5)}${px(2, -2.5, 1, 0.5)}</g>
      </g>`,
    css: `
      .clawd { animation: jump 1.2s steps(1) infinite; }
      .arm-l, .arm-r { animation: cheer 1.2s steps(1) infinite; }
      .k1 { animation: twinkle 0.6s steps(1) infinite; }
      .k2 { animation: twinkle 0.6s steps(1) -0.2s infinite; }
      .k3 { animation: twinkle 0.6s steps(1) -0.4s infinite; }
      @keyframes jump { 0%, 19.9% { transform: translate(0, -1px); } 20%, 49.9% { transform: translate(0, 0); } 50%, 69.9% { transform: translate(0, -1px); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes cheer { 0%, 19.9% { transform: translate(0, -1px); } 20%, 49.9% { transform: translate(0, -0.5px); } 50%, 69.9% { transform: translate(0, -1px); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes twinkle { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Thinking: two thought dots, then a light bulb that switches on.
  thinking: {
    label: wordsOf(t => t.states.thinking),
    extra: `
      <g fill="${DOT}">
        <g class="d1">${px(16, 0, 1, 0.5)}</g>
        <g class="d2">${px(17, -1, 1, 0.5)}</g>
      </g>
      <g class="bulb">
        <g class="glass">${px(20, -2, 3, 0.5)}${px(19, -1.5, 5, 1)}${px(20, -0.5, 3, 0.5)}</g>
        <g fill="${STEEL}">${px(20, 0, 3, 0.5)}${px(21, 0.5, 1, 0.5)}</g>
        <g class="lit">
          <g fill="#FFFFFF">${px(20, -1.5, 1, 0.5)}</g>
          <g class="rays" fill="${SPARK}">${px(18, -2.5, 1, 0.5)}${px(24, -2.5, 1, 0.5)}${px(24, -0.5, 1, 0.5)}</g>
        </g>
      </g>`,
    css: `
      .eyes { transform: translate(1px, -0.5px); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .d1 { animation: d1 3s steps(1) infinite; }
      .d2 { animation: d2 3s steps(1) infinite; }
      .bulb { animation: bulb 3s steps(1) infinite; }
      .glass { animation: glass 3s steps(1) infinite; }
      .lit { animation: lit 3s steps(1) infinite; }
      .rays { animation: rays 0.3s steps(1) infinite; }
      @keyframes d1 { 0%, 9.9% { opacity: 0; } 10%, 100% { opacity: 1; } }
      @keyframes d2 { 0%, 24.9% { opacity: 0; } 25%, 100% { opacity: 1; } }
      @keyframes bulb { 0%, 39.9% { opacity: 0; } 40%, 100% { opacity: 1; } }
      @keyframes glass { 0%, 59.9% { fill: ${DOT}; } 60%, 100% { fill: ${SPARK}; } }
      @keyframes lit { 0%, 59.9% { opacity: 0; } 60%, 100% { opacity: 1; } }
      @keyframes rays { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0.3; } }
      ${BLINK}`,
  },
  // The model is writing a tool call's arguments: already swinging.
  'tool-input': { ...toolUse, label: wordsOf(t => t.states.preparingTool) },
  'tool-use': { ...toolUse, label: wordsOf(t => t.states.usingTool) },
  // Writing the answer: types away, a hand at a time, while lines of text
  // appear beside it.
  responding: {
    label: wordsOf(t => t.states.writing),
    extra: `
      <g fill="${DOT}">
        <g class="l1">${px(19, 0, 4, 0.5)}</g>
        <g class="l2">${px(19, 1.25, 3, 0.5)}</g>
        <g class="l3">${px(19, 2.5, 4, 0.5)}</g>
        <g class="l4">${px(19, 3.75, 2, 0.5)}</g>
      </g>`,
    css: `
      .arm-l { animation: typeL 0.3s steps(1) infinite; }
      .arm-r { animation: typeR 0.3s steps(1) infinite; }
      .eyes { animation: blink 2.6s steps(1) infinite; }
      .l1 { animation: line1 2.4s steps(1) infinite; }
      .l2 { animation: line2 2.4s steps(1) infinite; }
      .l3 { animation: line3 2.4s steps(1) infinite; }
      .l4 { animation: line4 2.4s steps(1) infinite; }
      @keyframes typeL { 0%, 49.9% { transform: translate(0, -0.5px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes typeR { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }
      @keyframes line1 { 0%, 9.9% { opacity: 0; } 10%, 100% { opacity: 1; } }
      @keyframes line2 { 0%, 29.9% { opacity: 0; } 30%, 100% { opacity: 1; } }
      @keyframes line3 { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
      @keyframes line4 { 0%, 69.9% { opacity: 0; } 70%, 100% { opacity: 1; } }
      ${BLINK}`,
  },
}

// A class that shows from `from`% of the cycle until 95%, then clears with the rest.
const appear = (name: string, from: number) =>
  `.${name} { animation: ${name} var(--cycle) steps(1) infinite; }
  @keyframes ${name} { 0%, ${from - 0.1}% { opacity: 0; } ${from}%, 94.9% { opacity: 1; } 95%, 100% { opacity: 0; } }`

// A sheet of paper beside Clawd, x 19 to 23, its top at y 1.
const PAPER = `<g fill="${WING}">${px(19, 1, 5, 4)}</g>`

// A round globe six pixels across, x 18 to 23, from y 0 to 3.
const GLOBE = px(20, 0, 2, 0.5) + px(19, 0.5, 4, 0.5) + px(18, 1, 6, 1) + px(19, 2, 4, 0.5) + px(20, 2.5, 2, 0.5)

// The metal ring around the globe's right half, one pixel out, from the north
// pole over to the south pole, where it meets the stand.
const MERIDIAN =
  px(20, -0.5, 2, 0.5) + px(22, 0, 1, 0.5) + px(23, 0.5, 1, 0.5) + px(24, 1, 1, 1) + px(23, 2, 1, 0.5) + px(22, 2.5, 1, 0.5)

// Land on one turn of the globe, as [x within the six columns, row of half a pixel].
const LAND: [number, number][] = [
  [1, 1], [2, 1], [0, 2], [1, 2], [1, 3], [2, 4],
  [4, 1], [4, 2], [5, 2], [3, 3], [4, 3], [4, 4],
]

// The props each family of tools hands Clawd while it runs.
type ToolKind = 'look' | 'write' | 'shell' | 'web' | 'agent' | 'wait' | 'other'

const toolScenes: Record<Exclude<ToolKind, 'wait'>, Scene> = {
  // Reading or searching: the page of the editing scene, already written, and a
  // magnifying glass that sweeps down and up over it while Clawd watches.
  look: {
    label: wordsOf(t => t.states.reading),
    extra: `
      ${PAPER}
      <g fill="${DOT}">${px(20, 1.5, 3, 0.5)}${px(20, 2.5, 2, 0.5)}${px(20, 3.5, 3, 0.5)}</g>
      <g transform="translate(19 0)"><g class="scan">
        <g fill="${HANDLE}">${px(-1, 2, 1, 0.5)}${px(-2, 2.5, 1, 0.5)}</g>
        <g fill="${STEEL}">${px(0, 1.5, 1, 0.5)}</g>
        <g fill="${SKY}" opacity="0.55">${px(1, 0.5, 2, 1)}</g>
        <g fill="${STEEL}">${px(1, 0, 2, 0.5)}${px(1, 1.5, 2, 0.5)}${px(0, 0.5, 1, 1)}${px(3, 0.5, 1, 1)}</g>
        <g fill="#FFFFFF">${px(1, 0.5, 1, 0.5)}</g>
      </g></g>`,
    css: `
      .eyes { transform: translate(1px, 0.5px); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .scan { animation: scan 2s steps(1) infinite; }
      @keyframes scan {
        0%, 24.9% { transform: translate(0, 0); } 25%, 49.9% { transform: translate(1px, 0.5px); }
        50%, 74.9% { transform: translate(0, 1.5px); } 75%, 100% { transform: translate(1px, 2px); }
      }
      ${BLINK}`,
  },
  // Editing or writing a file: a pencil writes line after line on a page.
  write: {
    label: wordsOf(t => t.states.editing),
    extra: `
      ${PAPER}
      <g fill="${EYE}">
        <g class="i1">${px(19, 2, 1, 0.5)}</g><g class="i2">${px(20, 2, 1, 0.5)}</g><g class="i3">${px(21, 2, 1, 0.5)}</g>
        <g class="i4">${px(19, 3, 1, 0.5)}</g><g class="i5">${px(20, 3, 1, 0.5)}</g><g class="i6">${px(21, 3, 1, 0.5)}</g>
        <g class="i7">${px(19, 4, 1, 0.5)}</g><g class="i8">${px(20, 4, 1, 0.5)}</g>
      </g>
      <g transform="translate(19 1.5)"><g class="pencil">
        <g fill="${EYE}">${px(0, 0, 1, 0.5)}</g>
        <g fill="${SPARK}">${px(1, -0.5, 1, 0.5)}${px(2, -1, 1, 0.5)}</g>
        <g fill="#E8A0A0">${px(3, -1.5, 1, 0.5)}</g>
      </g></g>`,
    css: `
      svg { --cycle: 3s; }
      .eyes { transform: translate(1px, 0.5px); }
      .pencil { animation: pencil 3s steps(1) infinite; }
      @keyframes pencil {
        0%, 9.9% { transform: translate(0, 0); } 10%, 19.9% { transform: translate(1px, 0); } 20%, 29.9% { transform: translate(2px, 0); }
        30%, 39.9% { transform: translate(0, 1px); } 40%, 49.9% { transform: translate(1px, 1px); } 50%, 59.9% { transform: translate(2px, 1px); }
        60%, 69.9% { transform: translate(0, 2px); } 70%, 100% { transform: translate(1px, 2px); }
      }
      ${appear('i1', 10)} ${appear('i2', 20)} ${appear('i3', 30)}
      ${appear('i4', 40)} ${appear('i5', 50)} ${appear('i6', 60)}
      ${appear('i7', 70)} ${appear('i8', 80)}`,
  },
  // Running a command: Clawd types at a monitor where green code rains down,
  // each column at its own pace: a bright head and a trail that fades.
  shell: {
    label: wordsOf(t => t.states.runningCommand),
    extra: `
      <defs><clipPath id="screen">${px(19, 0.5, 4, 2)}</clipPath></defs>
      <g fill="${STEEL}">${px(18, 0, 6, 3)}${px(20, 3, 2, 1.5)}${px(19, 4.5, 4, 0.5)}</g>
      <g fill="#0B140D">${px(19, 0.5, 4, 2)}</g>
      <g clip-path="url(#screen)">
        ${[19, 20, 21, 22].map(x => `<g class="rain c${x}">
          <g fill="#0F4D20">${px(x, -1.5, 1, 0.5)}</g>
          <g fill="#1E8A3C">${px(x, -1, 1, 0.5)}</g>
          <g fill="#3FD46A">${px(x, -0.5, 1, 0.5)}</g>
          <g fill="#D2FFD2">${px(x, 0, 1, 0.5)}</g>
        </g>`).join('')}
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .arm-l { animation: tapL 0.3s steps(1) infinite; }
      .arm-r { animation: tapR 0.3s steps(1) infinite; }
      .rain { animation: rain 1.2s steps(7) infinite; }
      .c19 { animation-duration: 1.1s; animation-delay: -0.3s; }
      .c20 { animation-duration: 1.5s; animation-delay: -0.9s; }
      .c21 { animation-duration: 0.9s; animation-delay: -0.1s; }
      .c22 { animation-duration: 1.3s; animation-delay: -0.6s; }
      @keyframes tapL { 0%, 49.9% { transform: translate(0, -0.5px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes tapR { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }
      @keyframes rain { from { transform: translate(0, 0); } to { transform: translate(0, 3.5px); } }`,
  },
  // On the web: a desk globe as tall as Clawd turns on its stand.
  web: {
    label: wordsOf(t => t.states.browsing),
    extra: `
      <defs><clipPath id="globe">${GLOBE}</clipPath></defs>
      <g fill="${SKY}">${GLOBE}</g>
      <g clip-path="url(#globe)"><g class="spin" fill="${LEAF}">
        ${[0, 6].map(dx => LAND.map(([x, row]) => px(18 + dx + x, row * 0.5, 1, 0.5)).join('')).join('')}
      </g></g>
      <g fill="#FFFFFF" opacity="0.5">${px(19, 1, 1, 0.5)}</g>
      <g fill="${STEEL}">${MERIDIAN}${px(20, 3, 2, 1.5)}${px(19, 4.5, 4, 0.5)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .arm-r { transform: translate(0, -0.5px); }
      .spin { animation: spin 2.4s steps(6) infinite; }
      @keyframes spin { from { transform: translate(0, 0); } to { transform: translate(-6px, 0); } }
      ${BLINK}`,
  },
  // Launching a subagent: a small Clawd runs off while the big one waves.
  agent: {
    label: wordsOf(t => t.states.launchingSubagent),
    extra: `
      <g transform="translate(17 3)"><g class="mini">
        <g fill="${BODY}">${px(0, 0, 5, 1.5)}</g>
        <g fill="${EYE}">${px(1, 0.5, 1, 0.5)}${px(3, 0.5, 1, 0.5)}</g>
        <g class="mini-a" fill="${BODY}">${px(1, 1.5, 1, 0.5)}</g>
        <g class="mini-b" fill="${BODY}">${px(3, 1.5, 1, 0.5)}</g>
      </g></g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .arm-r { animation: wave 0.4s steps(1) infinite; }
      .mini { animation: run 1.6s steps(1) infinite; }
      .mini-a { animation: flap 0.2s steps(1) infinite; }
      .mini-b { animation: flap 0.2s steps(1) infinite reverse; }
      @keyframes wave { 0%, 49.9% { transform: translate(0, -1px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes flap { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      @keyframes run {
        0% { transform: translate(0, 0); opacity: 1; } 10% { transform: translate(1px, 0); } 20% { transform: translate(2px, 0); }
        30% { transform: translate(3px, 0); } 40% { transform: translate(4px, 0); } 50% { transform: translate(5px, 0); }
        60% { transform: translate(6px, 0); } 70% { transform: translate(7px, 0); } 80% { transform: translate(9px, 0); opacity: 1; }
        80.1%, 100% { transform: translate(9px, 0); opacity: 0; }
      }`,
  },
  // Any other tool: the hammer.
  other: toolUse,
}

// Each tool by name: its family and what the band says while it runs.
const TOOLS: Record<string, [ToolKind, Words]> = {
  Read: ['look', wordsOf(t => t.tools.readingFile)],
  Grep: ['look', wordsOf(t => t.tools.searchingCode)],
  Glob: ['look', wordsOf(t => t.tools.findingFiles)],
  LS: ['look', wordsOf(t => t.tools.lookingAtFolder)],
  Edit: ['write', wordsOf(t => t.tools.editingFile)],
  MultiEdit: ['write', wordsOf(t => t.tools.editingFile)],
  NotebookEdit: ['write', wordsOf(t => t.tools.editingNotebook)],
  Write: ['write', wordsOf(t => t.tools.writingFile)],
  Bash: ['shell', wordsOf(t => t.states.runningCommand)],
  PowerShell: ['shell', wordsOf(t => t.states.runningCommand)],
  WebFetch: ['web', wordsOf(t => t.tools.readingWebPage)],
  WebSearch: ['web', wordsOf(t => t.tools.searchingWeb)],
  Agent: ['agent', wordsOf(t => t.states.launchingSubagent)],
  Task: ['agent', wordsOf(t => t.states.launchingSubagent)],
  AskUserQuestion: ['wait', wordsOf(t => t.states.waitingForAnswer)],
  ExitPlanMode: ['wait', wordsOf(t => t.tools.waitingForPlan)],
}

// An MCP tool's own name, without the `mcp__<server>__` prefix.
const shortName = (tool: string) => (tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool)

// What the band shows for a mode, and for the tool when one runs. In the
// waiting mode `tool` says what is awaited: `answer` (a form a connector
// asked for) or anything else, a tool waiting for the person's approval.
// While Clawd waits on the person it passes the time with one pastime after
// another, from the moment the wait began (`since`) to `now`.
// `pick` names the scene for the small size (hooks/small.ts).
const sceneFor = (m: ClawdMode, tool: string | null, since = 0, now = since): { scene: Scene; label: Words; pick: ScenePick } => {
  const turns = waitTurns(since, now)
  if (m === 'waiting') {
    return {
      scene: roundScene(turns),
      label: tool === 'answer' ? wordsOf(t => t.states.waitingForAnswer) : wordsOf(t => t.states.waitingForApproval),
      pick: { kind: 'round', turns },
    }
  }
  if ((m === 'tool-use' || m === 'tool-input') && tool !== null) {
    const [kind, label] = TOOLS[tool] ?? ['other', wordsOf(t => t.tools.using(shortName(tool)))]
    return kind === 'wait'
      ? { scene: roundScene(turns), label, pick: { kind: 'round', turns } }
      : { scene: toolScenes[kind], label, pick: { kind: 'tool', key: kind } }
  }
  const scene = scenes[m] ?? scenes.requesting
  return { scene, label: scene.label, pick: { kind: 'mode', key: m } }
}

// What Clawd does as the prompt cache runs out, between waiting and sleeping.
const cacheScenes: Record<'worry' | 'yawn', Scene> = {
  // Clawd stretches its arms up in a big yawn, then nods off: a thirtieth of the
  // cache's life or less is left, two minutes of an hour.
  yawn: {
    label: wordsOf(t => t.states.yawning),
    eyes: `<g class="drowsy">${px(5, 1.5, 1, 0.5)}${px(12, 1.5, 1, 0.5)}</g><g class="shut">${CLOSED_EYES}</g>`,
    extra: `
      <g class="mouth" fill="${EYE}"><g class="gape">${px(8, 2, 2, 1)}</g><g class="ajar">${px(8, 2.5, 2, 0.5)}</g></g>
      <g fill="${DOT}"><g class="z1">${zee(18, -0.5)}</g></g>`,
    css: `
      .arm-l, .arm-r { animation: stretchup 4s steps(1) infinite; }
      .drowsy { animation: drowsy 4s steps(1) infinite; }
      .shut { animation: shut 4s steps(1) infinite; }
      .ajar { animation: ajar 4s steps(1) infinite; }
      .gape { animation: gape 4s steps(1) infinite; }
      .z1 { animation: doze 4s linear infinite; }
      @keyframes stretchup { 0%, 14.9% { transform: translate(0, 0); } 15%, 44.9% { transform: translate(0, -1px); } 45%, 100% { transform: translate(0, 0); } }
      @keyframes drowsy { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      @keyframes shut { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
      @keyframes ajar { 0%, 14.9% { opacity: 0; } 15%, 19.9% { opacity: 1; } 20%, 39.9% { opacity: 0; } 40%, 44.9% { opacity: 1; } 45%, 100% { opacity: 0; } }
      @keyframes gape { 0%, 19.9% { opacity: 0; } 20%, 39.9% { opacity: 1; } 40%, 100% { opacity: 0; } }
      @keyframes doze { 0%, 59.9% { opacity: 0; transform: translate(0, 0.5px); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(1px, -0.5px); } }`,
  },
  // Clawd keeps an anxious eye on the scene, a drop of sweat running down its
  // side: a sixth of the cache's life or less is left, ten
  // minutes of an hour.
  worry: {
    label: wordsOf(t => t.states.worried),
    extra: `<g class="sweat" fill="${SKY}">${px(15, 0, 1, 0.5)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 2.4s steps(1) infinite; }
      .clawd { animation: fret 0.8s steps(1) infinite; }
      .sweat { animation: sweat 1.6s steps(4) infinite; }
      @keyframes fret { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, 0.25px); } }
      @keyframes sweat { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(0, 1.5px); } }
      ${BLINK}`,
  },
}

// One of the things Clawd does to pass the time between turns: its eyes, its
// props and its motions, each rule of its css under its own class.
type Pastime = { name: string; eyes?: string; extra: string; css: string }

// A note of music: a head, a stem and a flag hanging off its top, the head's
// left at (x, y).
const note = (x: number, y: number) => px(x, y, 2, 0.5) + px(x + 1, y - 1.5, 1, 1.5) + px(x + 2, y - 1, 1, 0.5)

// Keyframes that jump a thing from point to point, each held an equal share
// of the cycle; the points are offsets from where it is drawn.
const hops = (name: string, points: [number, number][]) =>
  `@keyframes ${name} { ${points
    .map(([x, y], i) => `${((i / points.length) * 100).toFixed(2)}% { transform: translate(${x}px, ${y}px); }`)
    .join(' ')} 100% { transform: translate(${points[0]?.[0] ?? 0}px, ${points[0]?.[1] ?? 0}px); } }`

// Where a juggled ball goes, as an offset from the left hand: up and over the
// head to the right hand, then back low.
const JUGGLE: [number, number][] = [
  [0, 0], [1, -2], [2, -3.5], [5, -4.5], [8, -4.5], [11, -4.5], [13, -3.5], [14, -2], [15, 0], [12, -2.5], [7, -3], [3, -2.5],
]

// Where a soap bubble drifts from the wand's ring, up and to the right.
const BUBBLE: [number, number][] = [[0, 0], [1, -0.5], [1, -1], [2, -1.5], [2, -2], [3, -2.5], [3, -3], [3, -3]]

const PASTIMES: readonly Pastime[] = [
  // Looks around, this way and that, tapping a foot.
  {
    name: 'gaze',
    eyes: `<g class="gaze-look">${OPEN_EYES}</g>`,
    extra: '',
    css: `
      .gaze .eyes rect { animation: blink 3s steps(1) infinite; }
      .gaze .gaze-look { animation: gaze-look 4.5s steps(1) infinite; }
      .gaze .legs-b { animation: gaze-tap 0.6s steps(1) infinite; }
      @keyframes gaze-look {
        0%, 24.9% { transform: translate(-1px, 0); } 25%, 37.9% { transform: translate(0, 0); }
        38%, 64.9% { transform: translate(1px, 0); } 65%, 79.9% { transform: translate(1px, -0.5px); } 80%, 100% { transform: translate(0, 0); }
      }
      @keyframes gaze-tap { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }`,
  },
  // Whistles a tune, eyes half shut, notes floating off.
  {
    name: 'whistle',
    eyes: px(5, 1.5, 1, 0.5) + px(12, 1.5, 1, 0.5) + px(9, 2.5, 1, 0.5),
    extra: `
      <g class="whistle-n1" fill="${SPARK}">${note(17, 1)}</g>
      <g class="whistle-n2" fill="${SKY}">${note(19, 0)}</g>`,
    css: `
      .whistle .clawd { animation: whistle-bob 1.2s steps(1) infinite; }
      .whistle-n1 { animation: whistle-float 2.4s steps(4) infinite; }
      .whistle-n2 { animation: whistle-float 2.4s steps(4) -1.2s infinite; }
      @keyframes whistle-bob { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, 0.5px); } }
      @keyframes whistle-float { 0% { opacity: 0; transform: translate(0, 0.5px); } 25% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; transform: translate(2px, -1.5px); } }`,
  },
  // Juggles three balls over its head, the hands taking turns.
  {
    name: 'juggle',
    eyes: `<g class="juggle-up">${OPEN_EYES}</g>`,
    extra: `
      <g class="juggle-b1" fill="${SHELL}">${px(1, 1.5, 1, 0.5)}</g>
      <g class="juggle-b2" fill="${SKY}">${px(1, 1.5, 1, 0.5)}</g>
      <g class="juggle-b3" fill="${LEAF}">${px(1, 1.5, 1, 0.5)}</g>`,
    css: `
      .juggle-up { transform: translate(0, -0.5px); }
      .juggle .arm-l { animation: juggle-pump 0.6s steps(1) infinite; }
      .juggle .arm-r { animation: juggle-pump 0.6s steps(1) -0.3s infinite; }
      .juggle-b1 { animation: juggle-ball 1.8s steps(1) infinite; }
      .juggle-b2 { animation: juggle-ball 1.8s steps(1) -0.6s infinite; }
      .juggle-b3 { animation: juggle-ball 1.8s steps(1) -1.2s infinite; }
      @keyframes juggle-pump { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }
      ${hops('juggle-ball', JUGGLE)}`,
  },
  // Plays with a yo-yo: down on its string, a spin at the bottom, back up.
  {
    name: 'yoyo',
    eyes: `<g class="yoyo-look">${OPEN_EYES}</g>`,
    extra: `
      <g class="yoyo-string" fill="${WING}">${px(17, 1.5, 1, 2.5)}</g>
      <g class="yoyo-toy">
        <g fill="${SHELL}">${px(16, 2, 3, 1)}</g>
        <g class="yoyo-spin" fill="${WING}">${px(16, 2, 1, 0.5)}</g>
        <g class="yoyo-spin2" fill="${WING}">${px(18, 2.5, 1, 0.5)}</g>
      </g>`,
    css: `
      .yoyo .arm-r { transform: translate(0, -1px); }
      .yoyo-look { animation: yoyo-look 2s steps(1) infinite; }
      .yoyo-toy { animation: yoyo-drop 2s steps(1) infinite; }
      .yoyo-string { animation: yoyo-reel 2s steps(1) infinite; }
      .yoyo-spin { animation: yoyo-spin 0.3s steps(1) infinite; }
      .yoyo-spin2 { animation: yoyo-spin 0.3s steps(1) -0.15s infinite; }
      @keyframes yoyo-drop {
        0%, 9.9% { transform: translate(0, 0); } 10%, 19.9% { transform: translate(0, 0.5px); } 20%, 29.9% { transform: translate(0, 1px); }
        30%, 39.9% { transform: translate(0, 1.5px); } 40%, 59.9% { transform: translate(0, 2px); } 60%, 69.9% { transform: translate(0, 1.5px); }
        70%, 79.9% { transform: translate(0, 1px); } 80%, 89.9% { transform: translate(0, 0.5px); } 90%, 100% { transform: translate(0, 0); }
      }
      @keyframes yoyo-reel {
        0%, 9.9% { clip-path: inset(0 0 2px 0); } 10%, 19.9% { clip-path: inset(0 0 1.5px 0); } 20%, 29.9% { clip-path: inset(0 0 1px 0); }
        30%, 39.9% { clip-path: inset(0 0 0.5px 0); } 40%, 59.9% { clip-path: inset(0 0 0 0); } 60%, 69.9% { clip-path: inset(0 0 0.5px 0); }
        70%, 79.9% { clip-path: inset(0 0 1px 0); } 80%, 89.9% { clip-path: inset(0 0 1.5px 0); } 90%, 100% { clip-path: inset(0 0 2px 0); }
      }
      @keyframes yoyo-look { 0%, 29.9% { transform: translate(1px, 0); } 30%, 69.9% { transform: translate(1px, 0.5px); } 70%, 100% { transform: translate(1px, 0); } }
      @keyframes yoyo-spin { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Blows soap bubbles through a wand and watches them drift off.
  {
    name: 'bubbles',
    eyes: `<g class="bubbles-look">${OPEN_EYES}</g>`,
    extra: `
      <g fill="${HANDLE}">${px(17, 2, 1, 0.5)}${px(18, 1.5, 1, 0.5)}</g>
      <g fill="${STEEL}">${px(19, 0.5, 1, 0.5)}${px(20, 0, 1, 0.5)}${px(21, 0.5, 1, 0.5)}${px(20, 1, 1, 0.5)}</g>
      <g class="bubbles-b1"><g fill="${SKY}" opacity="0.6">${px(20, 0, 2, 1)}</g><g fill="#FFFFFF" opacity="0.8">${px(20, 0, 1, 0.5)}</g></g>
      <g class="bubbles-b2" fill="${SKY}" opacity="0.8">${px(20, 0.5, 1, 0.5)}</g>
      <g class="bubbles-b3" fill="${SKY}" opacity="0.8">${px(20, 0.5, 1, 0.5)}</g>`,
    css: `
      .bubbles-look { animation: bubbles-look 3s steps(1) infinite; }
      .bubbles-b1 { animation: bubbles-rise 3s steps(1) infinite, bubbles-pop 3s steps(1) infinite; }
      .bubbles-b2 { animation: bubbles-rise 3s steps(1) -1s infinite, bubbles-pop 3s steps(1) -1s infinite; }
      .bubbles-b3 { animation: bubbles-rise 3s steps(1) -2s infinite, bubbles-pop 3s steps(1) -2s infinite; }
      ${hops('bubbles-rise', BUBBLE)}
      @keyframes bubbles-pop { 0%, 12.4% { opacity: 0; } 12.5%, 87.4% { opacity: 1; } 87.5%, 100% { opacity: 0; } }
      @keyframes bubbles-look { 0%, 39.9% { transform: translate(1px, 0); } 40%, 100% { transform: translate(1px, -0.5px); } }`,
  },
  // Reads a book held out to the right, now and then turning a page.
  {
    name: 'read',
    eyes: `<g class="read-eyes">${OPEN_EYES}</g>`,
    extra: `
      <g fill="${SHELL}">${px(17, 3, 5, 0.5)}</g>
      <g fill="${WING}">${px(17, 1, 2, 2)}${px(20, 1, 2, 2)}</g>
      <g fill="${DOT}">${px(17, 1.5, 2, 0.5)}${px(17, 2.5, 1, 0.5)}${px(20, 1.5, 2, 0.5)}${px(20, 2.5, 2, 0.5)}${px(19, 1, 1, 2)}</g>
      <g fill="${WING}">
        <g class="read-p1">${px(20, 0.5, 1, 2)}</g>
        <g class="read-p2">${px(19, 0, 1, 2)}</g>
        <g class="read-p3">${px(18, 0.5, 1, 2)}</g>
      </g>`,
    css: `
      .read-eyes { transform: translate(1px, 0.5px); }
      .read .eyes rect { animation: blink 3.5s steps(1) infinite; }
      .read .clawd { animation: read-nod 3s steps(1) infinite; }
      .read-p1 { animation: read-p1 3s steps(1) infinite; }
      .read-p2 { animation: read-p2 3s steps(1) infinite; }
      .read-p3 { animation: read-p3 3s steps(1) infinite; }
      @keyframes read-nod { 0%, 69.9% { transform: translate(0, 0); } 70%, 100% { transform: translate(0, 0.25px); } }
      @keyframes read-p1 { 0%, 79.9% { opacity: 0; } 80%, 84.9% { opacity: 1; } 85%, 100% { opacity: 0; } }
      @keyframes read-p2 { 0%, 84.9% { opacity: 0; } 85%, 89.9% { opacity: 1; } 90%, 100% { opacity: 0; } }
      @keyframes read-p3 { 0%, 89.9% { opacity: 0; } 90%, 94.9% { opacity: 1; } 95%, 100% { opacity: 0; } }`,
  },
  // Dances: sways side to side, arms up by turns, notes twinkling above.
  {
    name: 'dance',
    eyes: px(5, 1, 1, 0.5) + px(12, 1, 1, 0.5),
    extra: `
      <g class="dance-n1" fill="${SPARK}">${note(1, -1.5)}</g>
      <g class="dance-n2" fill="${LEAF}">${note(17, -1)}</g>`,
    css: `
      .dance .clawd { animation: dance-sway 1s steps(1) infinite; }
      .dance .arm-l { animation: dance-arm 1s steps(1) infinite; }
      .dance .arm-r { animation: dance-arm 1s steps(1) -0.5s infinite; }
      .dance .legs-a { animation: dance-step 0.5s steps(1) infinite; }
      .dance .legs-b { animation: dance-step 0.5s steps(1) -0.25s infinite; }
      .dance-n1 { animation: dance-twinkle 1s steps(1) infinite; }
      .dance-n2 { animation: dance-twinkle 1s steps(1) -0.5s infinite; }
      @keyframes dance-sway { 0%, 49.9% { transform: translate(-1px, 0); } 50%, 100% { transform: translate(1px, 0); } }
      @keyframes dance-arm { 0%, 49.9% { transform: translate(0, -1px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes dance-step { 0%, 49.9% { transform: translate(0, -0.5px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes dance-twinkle { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Follows a ladybug that flies past overhead, bobbing.
  {
    name: 'ladybug',
    eyes: `<g class="ladybug-follow">${OPEN_EYES}</g>`,
    extra: `
      <g class="ladybug-flight">
        <g fill="${SHELL}">${px(1, 0, 3, 0.5)}${px(0, 0.5, 5, 1)}${px(1, 1.5, 3, 0.5)}</g>
        <g fill="${EYE}">${px(1, 0.5, 1, 0.5)}${px(3, 0.5, 1, 0.5)}${px(2, 1, 1, 0.5)}</g>
        <g fill="${STEEL}">${px(5, 0.5, 1, 1)}</g>
        <g class="ladybug-wings" fill="${WING}" opacity="0.8">${px(1, -0.5, 1, 0.5)}${px(3, -0.5, 1, 0.5)}</g>
      </g>`,
    css: `
      .ladybug .clawd { animation: ladybug-bob 1.2s steps(1) infinite; }
      .ladybug .ladybug-follow { animation: ladybug-follow 4s steps(1) infinite; }
      .ladybug .ladybug-flight { animation: ladybug-fly 4s steps(48) infinite; }
      .ladybug .ladybug-wings { animation: ladybug-flap 0.2s steps(1) infinite; }
      @keyframes ladybug-bob { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 0.5px); } }
      @keyframes ladybug-follow {
        0%, 24.9% { transform: translate(-1px, -0.5px); }
        25%, 49.9% { transform: translate(0, -0.5px); }
        50%, 79.9% { transform: translate(1px, -0.5px); }
        80%, 100% { transform: translate(0, 0); }
      }
      @keyframes ladybug-fly {
        0% { transform: translate(-6px, -2.5px); }
        20% { transform: translate(1px, -3px); }
        40% { transform: translate(8px, -2.5px); }
        60% { transform: translate(15px, -3px); }
        80% { transform: translate(26px, -2.5px); }
        100% { transform: translate(26px, -2.5px); }
      }
      @keyframes ladybug-flap { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
]

// Clawd at rest between pastimes: breathing slowly, blinking now and then,
// glancing one way and the other. It asks for no attention.
const REST: Pastime = {
  name: 'rest',
  eyes: `<g class="rest-look">${OPEN_EYES}</g>`,
  extra: '',
  css: `
    .rest .clawd { animation: rest-breathe 4s steps(1) infinite; }
    .rest .eyes rect { animation: rest-blink 5s steps(1) infinite; }
    .rest .rest-look { animation: rest-look 13s steps(1) infinite; }
    @keyframes rest-breathe { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, 0.25px); } }
    @keyframes rest-blink { 0%, 95.9% { opacity: 1; } 96%, 100% { opacity: 0; } }
    @keyframes rest-look {
      0%, 54.9% { transform: translate(0, 0); } 55%, 67.9% { transform: translate(1px, 0); }
      68%, 79.9% { transform: translate(0, 0); } 80%, 91.9% { transform: translate(-1px, 0); } 92%, 100% { transform: translate(0, 0); }
    }`,
}

// How long Clawd rests before a pastime, and how long the pastime lasts.
const REST_S = 30
const PASTIME_S = 9

// How many times each pastime comes up in one round, in a shuffled order.
const ROUND_SHUFFLES = 2

// A number in [0, 1) for each whole number, the same every time
// (mulberry32): the round's order and a wait's pastime come from it, so a
// redraw keeps them as they were.
const chance = (n: number) => {
  let t = Math.imul(n + 1, 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The pastimes' order in round `round`: each of them `ROUND_SHUFFLES` times,
// shuffled, never the same one twice in a row, the round's last and first
// included.
const roundOrder = (round: number) => {
  const order: number[] = []
  for (let k = 0; k < ROUND_SHUFFLES; k++) {
    const deck = PASTIMES.map((_, i) => i)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(chance(round * 100 + k * 10 + i) * (i + 1))
      ;[deck[i], deck[j]] = [deck[j] ?? 0, deck[i] ?? 0]
    }
    if (deck[0] === order[order.length - 1]) {
      ;[deck[0], deck[1]] = [deck[1] ?? 0, deck[0] ?? 0]
    }
    order.push(...deck)
  }
  if (order[order.length - 1] === order[0]) {
    const n = order.length
    ;[order[n - 1], order[n - 2]] = [order[n - 2] ?? 0, order[n - 1] ?? 0]
  }
  return order
}

// A group of the round that shows in `windows` (from and to, in seconds of
// the cycle) and is hidden the rest of it.
const windowsCss = (name: string, windows: [number, number][], cycle: number, at: number) => {
  const pct = (s: number) => `${((s / cycle) * 100).toFixed(3)}%`
  const frames = windows.map(([from, to]) => `${pct(from)} { opacity: 1; } ${pct(to)} { opacity: 0; }`).join(' ')
  return `.turn-${name} { animation: turn-${name} ${cycle}s steps(1) -${at.toFixed(1)}s infinite; }
    @keyframes turn-${name} { 0% { opacity: 0; } ${frames} 100% { opacity: 0; } }`
}

// Clawd in a group of its own: its pose, its eyes and its props.
const pastimeBody = (p: Pastime, turn = '') =>
  `<g class="${turn} ${p.name}"><g class="clawd">${sprite(p.eyes ?? OPEN_EYES)}</g>${p.extra}</g>`

// One pastime by itself, as the preview shows it and as Clawd waits on the person.
const pastimeScene = (p: Pastime): Scene => ({
  label: wordsOf(t => t.states.waiting),
  body: pastimeBody(p),
  extra: '',
  css: `${p.css}
    ${BLINK}`,
})

// A round of rest and pastimes, all in one image so no redraw is needed to
// change them: `turns` says when each shows.
const roundScene = (turns: string): Scene => ({
  label: wordsOf(t => t.states.waiting),
  body: [pastimeBody(REST, `turn-${REST.name}`), ...PASTIMES.map(p => pastimeBody(p, `turn-${p.name}`))].join(''),
  extra: '',
  css: `${turns}
    ${[REST, ...PASTIMES].map(p => p.css).join('')}
    ${BLINK}`,
})

// How long a round lasts, in seconds, with `restS` of rest before each pastime.
const roundLength = (restS: number) => PASTIMES.length * ROUND_SHUFFLES * (restS + PASTIME_S)

// A round's CSS `atS` seconds into it, the pastimes in `order`, each after
// `restS` of rest: when each of the rest and the pastimes shows, the same in
// either size.
const roundTurns = (atS: number, order: readonly number[], restS: number) => {
  const slot = restS + PASTIME_S
  const cycle = roundLength(restS)
  const rests = order.map((_, k): [number, number] => [k * slot, k * slot + restS])
  const turns = PASTIMES.map((_, i) =>
    order.flatMap((p, k): [number, number][] => (p === i ? [[k * slot + restS, (k + 1) * slot]] : [])),
  )
  const at = atS % cycle
  return `${windowsCss(REST.name, rests, cycle, at)}
    ${PASTIMES.map((p, i) => windowsCss(p.name, turns[i] ?? [], cycle, at)).join('\n    ')}`
}

// Clawd between turns with the prompt cache warm: at rest, and every so
// often a pastime picked at random. The round goes by the clock (`atS`, in
// seconds), so a redraw takes it up where it was rather than from the start.
const waitingTurns = (atS: number) => roundTurns(atS, roundOrder(Math.floor(atS / roundLength(REST_S))), REST_S)
const waitingScene = (atS: number): Scene => roundScene(waitingTurns(atS))

// How long Clawd rests between pastimes while it waits on the person.
const WAIT_REST_S = 3

// While Clawd waits on the person it passes the time with one pastime after
// another, a short rest between them, from the moment the wait began
// (`since`, in milliseconds, which also picks their order) to `now`. It
// starts with a pastime rather than a rest.
const waitTurns = (since: number, now: number) =>
  roundTurns(WAIT_REST_S + Math.max(0, now - since) / 1000, roundOrder(Math.floor(since / 1000)), WAIT_REST_S)

// Each scene enters with a small hop of Clawd while its props fade in, so a
// change of mode reads as a transition rather than a cut.
const ENTER = `
  .enter { animation: enter 0.3s steps(3) 1 both; }
  .props { animation: fadein 0.4s ease-out 1 both; }
  @keyframes enter { 0% { transform: translate(0, 0.5px); } 50% { transform: translate(0, -0.5px); } 100% { transform: translate(0, 0); } }
  @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }`

// The sprite's y is stretched by two, so the viewBox is twice as tall in units.
const svgFor = (scene: Scene) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H * 2}" shape-rendering="crispEdges">
  <style>
    g { transform-box: view-box; }
    ${ENTER}
    ${scene.css}
  </style>
  <g transform="translate(0 ${HEADROOM * 2}) scale(1 2)">
    <g class="enter">${scene.body ?? `<g class="clawd">${sprite(scene.eyes ?? OPEN_EYES)}</g>`}</g>
    <g class="props">${scene.extra}</g>
  </g>
</svg>`

// Each mode stays on screen at least this long: the engine hands a response's
// text over in one burst, often right before a tool call, so without a floor
// a mode can last a few milliseconds and never be seen.
const MIN_MS = 1500

// The compact button shows once this much of the context, or less, is free:
// where the scenes show the context low.
const COMPACT_AT = LOW_AT

// The picks of the panel's language row, in its order.
const LANG_CHOICES: readonly LangChoice[] = ['auto', ...LANGS]

type Shown = { mode: ClawdMode; tool: string | null }

// The module's own copy of what is shown, so a stream writes state only on a change.
let current: Shown = { mode: 'idle', tool: null }
let shownAt = 0
let pending: Shown | null = null
let timer: Timer | null = null

// Whether the main turn runs: from its first model request until it completes.
let isTurnRunning = false

const same = (a: Shown, b: Shown) => a.mode === b.mode && a.tool === b.tool

async function apply($: EngineInterface, next: Shown) {
  current = next
  shownAt = await $.clock.now()
  await update($, tool, () => next.tool)
  await update($, mode, () => next.mode)
}

// Applies what the last call asked for once the current one has had its time.
async function settle($: EngineInterface) {
  timer = null
  const next = pending
  pending = null
  if (next !== null && !same(next, current)) {
    await apply($, next)
  }
}

async function show($: EngineInterface, nextMode: ClawdMode, nextTool: string | null = null) {
  const next: Shown = { mode: nextMode, tool: nextTool }
  if (nextMode === 'idle') {
    timer?.cancel()
    timer = null
    pending = null
    if (current.mode !== 'idle') {
      await apply($, next)
    }
    return
  }
  if (timer !== null) {
    pending = next
    return
  }
  if (same(next, current)) {
    return
  }
  const wait = shownAt + MIN_MS - (await $.clock.now())
  if (wait > 0) {
    pending = next
    timer = $.clock.after(wait, () => settle($))
    return
  }
  await apply($, next)
}

// With this share of the prompt cache's life left Clawd frets, ten minutes
// of an hour; with this share, two minutes of an hour, it yawns.
const worryS = (ttl: number) => ttl / 6
const yawnS = (ttl: number) => ttl / 30

// The meters as the session's state holds them; a state written by an
// older version of the mod lacks what it did not keep.
async function statsNow($: EngineInterface): Promise<Stats> {
  return { ...NO_STATS, ...(await read($, stats)) }
}

// The cache's figure and minutes run down by themselves, and the meters of
// the usage limits stay as they were read; the band is drawn again only as
// the cache runs out (when Clawd starts to fret, when it yawns, and when the
// cache expires, to show it gone) and as a limit's window starts over.
// After a hot reload, which cancels the old module's timers, they are
// scheduled again from the state, which stays.
let statTimers: Timer[] = []

async function scheduleRedraws($: EngineInterface, s: Stats) {
  for (const t of statTimers) {
    t.cancel()
  }
  statTimers = []
  const now = await $.clock.now()
  const cacheAt = s.cacheAt
  const cacheSteps = cacheAt === null ? [] : [s.cacheTtl - worryS(s.cacheTtl), s.cacheTtl - yawnS(s.cacheTtl), s.cacheTtl].map(atS => cacheAt + atS * 1000)
  for (const at of [...cacheSteps, s.fiveHourResetsAt, s.weekResetsAt]) {
    if (at !== null && at > now) {
      statTimers.push($.clock.after(at - now + 500, () => redrawBand($)))
    }
  }
}

// An environment variable Claude Code reads as on.
const isOn = (value: string | undefined) => value !== undefined && /^(1|true|yes|on)$/i.test(value.trim())

const ttlNamed = (value: unknown) => (value === '1h' ? HOUR_S : value === '5m' ? FIVE_MINUTES_S : null)

// How long the prompt cache keeps the main conversation, in seconds, as
// Claude Code picks it: five minutes when FORCE_PROMPT_CACHING_5M is on;
// the one CLAUDE_CODE_PROMPT_CACHE_TTL, or else the promptCacheTtl setting,
// names; an hour when ENABLE_PROMPT_CACHING_1H is on (on Bedrock,
// ENABLE_PROMPT_CACHING_1H_BEDROCK). Otherwise an hour on a Claude
// subscription within its usage limits and five minutes on anything else.
// No event names the length itself (only a model switch's), so the mod
// tells a subscription by its usage limits, which only a subscription
// reports, and a request past them by a limit used up. Before any answer
// of this session the limits have no reading yet: null, unknown.
async function cacheTtlOf($: EngineInterface, usage: SessionUsage | null, isAnswer: boolean): Promise<number | null> {
  if (isOn(await $.env.get('FORCE_PROMPT_CACHING_5M').catch(() => undefined))) {
    return FIVE_MINUTES_S
  }
  const named =
    ttlNamed(await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL').catch(() => undefined)) ??
    ttlNamed((await $.settings.read().catch(() => ({}) as Record<string, unknown>)).promptCacheTtl)
  if (named !== null) {
    return named
  }
  const isBedrock = isOn(await $.env.get('CLAUDE_CODE_USE_BEDROCK').catch(() => undefined))
  if (
    isOn(await $.env.get('ENABLE_PROMPT_CACHING_1H').catch(() => undefined)) ||
    (isBedrock && isOn(await $.env.get('ENABLE_PROMPT_CACHING_1H_BEDROCK').catch(() => undefined)))
  ) {
    return HOUR_S
  }
  const limits = (usage?.rateLimits ?? []).filter(r => r.kind === 'five_hour' || r.kind === 'seven_day')
  if (limits.length === 0) {
    return isAnswer ? FIVE_MINUTES_S : null
  }
  return limits.some(r => r.percentUsed >= 100) ? FIVE_MINUTES_S : HOUR_S
}

// Whether Claude Code caches no prompt at all.
async function isCacheOff($: EngineInterface) {
  return isOn(await $.env.get('DISABLE_PROMPT_CACHING').catch(() => undefined))
}

// The context left in a window the engine has no reading of yet (a new
// session, or one just compacted or cleared, until its next response): an
// estimate of what the next request will send, as /context makes it
// without asking the API; null where the host has none.
async function estimatedContextLeft($: EngineInterface, window: number) {
  const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => null)
  const tokens = usage?.context.breakdown?.totalTokens
  return tokens === undefined || window <= 0 ? null : Math.max(0, 100 - (tokens / window) * 100)
}

// When a limit's window starts over, from the engine's timestamp.
const resetOf = (resetsAt: string | undefined) => {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)
  return Number.isNaN(at) ? null : at
}

// Reads the context window and the usage limits as the engine last saw them,
// leaving the meters as they were when it can't. After an answer the cache
// starts over, as long as Claude Code says it keeps it, and its last minutes
// are scheduled anew.
async function refreshStats($: EngineInterface, isAnswer = false) {
  const usage = await $.session.usage().catch(() => null)
  const now = await $.clock.now()
  const ttl = isAnswer ? await cacheTtlOf($, usage, true) : null
  const isOff = isAnswer && (await isCacheOff($))
  const percent = usage?.context.percent
  const contextLeft = usage === null ? undefined : percent !== undefined ? 100 - percent : await estimatedContextLeft($, usage.context.window)
  const limit = (kind: string) => usage?.rateLimits.find(r => r.kind === kind)
  await update($, stats, old => {
    const s = { ...NO_STATS, ...old }
    return {
      ...s,
      ...(usage === null
        ? {}
        : {
            contextLeft: contextLeft ?? null,
            fiveHour: limit('five_hour')?.percentUsed ?? null,
            week: limit('seven_day')?.percentUsed ?? null,
            fiveHourResetsAt: resetOf(limit('five_hour')?.resetsAt),
            weekResetsAt: resetOf(limit('seven_day')?.resetsAt),
          }),
      ...(isAnswer ? { cacheAt: isOff ? null : now, cacheTtl: ttl ?? s.cacheTtl } : {}),
    }
  })
  await scheduleRedraws($, await statsNow($))
}

// The conversation the session shows changed: after /clear its cache is not
// the old one's; a conversation resumed or forked was answered when the
// engine says, and its cache likely expired or not as the engine reckons it.
// From that the cache's length, unknown before an answer, may follow: still
// warm after more than five minutes, it keeps an hour; expired within the
// hour, five minutes.
async function restartCache($: EngineInterface, source: string, sinceS: number | undefined, isExpired: boolean | undefined) {
  const now = await $.clock.now()
  const usage = await $.session.usage().catch(() => null)
  const ruled = await cacheTtlOf($, usage, false)
  await update($, stats, old => {
    const s = { ...NO_STATS, ...old }
    if (source === 'clear' || sinceS === undefined) {
      return { ...s, cacheAt: null }
    }
    const told = isExpired === false && sinceS > FIVE_MINUTES_S ? HOUR_S : isExpired === true && sinceS < HOUR_S ? FIVE_MINUTES_S : null
    return { ...s, cacheAt: now - sinceS * 1000, cacheTtl: told ?? ruled ?? s.cacheTtl }
  })
  await scheduleRedraws($, await statsNow($))
}

async function redrawBand($: EngineInterface) {
  await update($, redraws, n => n + 1)
}

// How long Clawd hops for joy after a compaction.
const CELEBRATE_MS = 2400

// After a compaction Clawd celebrates a moment, then sleeps, unless the turn
// the compaction was part of has moved on by then.
async function celebrate($: EngineInterface) {
  await show($, 'compacted')
  // A quick compaction leaves the celebration waiting out the compacting
  // scene's MIN_MS first; it lasts its while from when it shows.
  const wait = current.mode === 'compacted' ? 0 : Math.max(0, shownAt + MIN_MS - (await $.clock.now()))
  $.clock.after(wait + CELEBRATE_MS, () => endCelebration($))
}

async function endCelebration($: EngineInterface) {
  if (current.mode === 'compacted' && timer === null) {
    await show($, 'idle')
  }
}

// Whether a press of Yes is compacting already: a second press before the
// band draws again compacts nothing more.
let isCompactPressed = false

// Compacting in the middle of a turn would cut it short: the button only
// says so, in the language of the band pressed.
async function compactNow($: EngineInterface, isWorking: boolean, lang: Lang) {
  if (isCompactPressed) {
    return
  }
  isCompactPressed = true
  try {
    await update($, isConfirming, () => false)
    if (isWorking) {
      $.ui.toast(TEXTS[lang].waitToCompact)
      return
    }
    // The call runs every session.compact hook but this plugin's own, so the
    // band shows the compaction from here.
    await whileCompacting($, () => $.session.compact())
  } finally {
    isCompactPressed = false
  }
}

// Clawd compacting while `compact` runs, then celebrating once it is done,
// or back to idle if a hook skipped it. A compaction from anywhere answers
// the compact button's question.
async function whileCompacting($: EngineInterface, compact: () => Promise<SessionCompactResult>) {
  await update($, isConfirming, () => false)
  await show($, 'compacting')
  let isDone = false
  try {
    const result = await compact()
    isDone = result.skip === undefined
    return result
  } finally {
    // The fresh meters first, so the celebration shows the scene refilled.
    await refreshStats($)
    await (isDone ? celebrate($) : show($, 'idle'))
  }
}

// Switches the scene the band draws on its right: in the session's state,
// which draws the band and the panel again, and in the plugin's store, which
// the next session starts from. Not a userConfig field: the desktop app lists
// no plugin rows in /config, so $.config.set cannot reach one there.
async function chooseMeterScene($: EngineInterface, name: string) {
  await update($, sceneName, () => name)
  await $.store.set('scene', name)
}

// Whether the person had given the panel the keyboard, as it was last drawn or
// focused. On the desktop, a click on a Button of a panel without the keyboard
// only hands it the keyboard: `ui.focus` lands on the Button, and no press.
let isPanelFocused = false

// The scene the last pick left in the store, for a new session.
async function loadMeterScene($: EngineInterface) {
  const stored = await $.store.get('scene').catch(() => undefined)
  if (typeof stored === 'string') {
    await update($, sceneName, () => meterSceneNamed(stored).name)
  }
}

// The language Claude Code shows the person, as far as a plugin can see it;
// worked out once a session, and again when the Language row changes.
let detected: Lang | null = null

// Claude Code hands a plugin neither the app's language nor its translated
// texts. The Language row of /config (the language Claude answers in) says
// it when the person set one; then the locale variables, in the order a
// program reads them; then the operating system's own setting, as a desktop
// app starts without those variables; English when none names a language
// the mod speaks. A read the host does not answer counts as unset.
async function detectLang($: EngineInterface): Promise<Lang> {
  const rows = await $.config.list().catch(() => [])
  const locales = [
    rows.find(row => row.key === 'language')?.value,
    await $.env.get('LC_ALL').catch(() => undefined),
    await $.env.get('LC_MESSAGES').catch(() => undefined),
    await $.env.get('LANG').catch(() => undefined),
  ]

  return locales.map(langOf).find(lang => lang !== null) ?? langOf(await systemLocale($)) ?? DEFAULT_LANG
}

// Where Windows keeps the person's languages: the list in the order they set
// it, its first the display language, then the regional format.
const WINDOWS_LOCALES = [
  ['HKCU\\Control Panel\\International\\User Profile', 'Languages'],
  ['HKCU\\Control Panel\\International', 'LocaleName'],
] as const

// How long the session's start waits on a system command for the language.
const LOCALE_TIMEOUT_MS = 3000

// The language the operating system shows the person, as a code (`es-AR`):
// on Windows read from the registry, on macOS the first of AppleLanguages;
// null where neither answers. Each command is run by its full path, from its
// own folder, never looked up in the project's: a project could hold a
// program by that name.
async function systemLocale($: EngineInterface): Promise<string | null> {
  if ((await $.env.get('OS').catch(() => undefined)) === 'Windows_NT') {
    const root = (await $.env.get('SystemRoot').catch(() => undefined)) ?? 'C:\\Windows'
    const system32 = `${root}\\System32`
    for (const [key, value] of WINDOWS_LOCALES) {
      const found = await $.process
        .run([`${system32}\\reg.exe`, 'query', key, '/v', value], { cwd: system32, timeoutMs: LOCALE_TIMEOUT_MS })
        .catch(() => null)
      const code = found?.exitCode === 0 ? /REG_\w+\s+([a-z]{2,3}\b[-\w]*)/i.exec(found.stdout)?.[1] : undefined
      if (code) {
        return code
      }
    }
    return null
  }
  // Anywhere but macOS there is no such program, and the call fails at once.
  const found = await $.process.run(['/usr/bin/defaults', 'read', '-g', 'AppleLanguages'], { cwd: '/', timeoutMs: LOCALE_TIMEOUT_MS }).catch(() => null)

  return found?.exitCode === 0 ? /[a-z]{2,3}\b[-\w]*/i.exec(found.stdout)?.[0] ?? null : null
}

async function detectedLang($: EngineInterface) {
  detected ??= await detectLang($)
  return detected
}

// The language the band, the panel and the commands speak: the person's pick
// in the panel, or the one detected.
async function langNow($: EngineInterface): Promise<Lang> {
  const choice = await read($, langChoice)
  return choice === 'auto' ? await detectedLang($) : choice
}

// The language the commands speak: as the band does, unless the session
// draws in a terminal, where Claude Code would measure their text short.
async function commandLang($: EngineInterface): Promise<Lang> {
  const lang = await langNow($)
  const surfaces: readonly string[] = await $.session.surfaces().catch(() => [])
  return surfaces.includes('terminal') ? langOn('terminal', lang) : lang
}

// Declares the commands, their menu lines in the language spoken now; again
// when it changes.
async function registerCommands($: EngineInterface) {
  const t = TEXTS[await commandLang($)]
  await $.command.register({ name: PANEL_COMMAND, description: t.panelCommand })
  await $.command.register({ name: SCENE_COMMAND, description: t.sceneCommand, argumentHint: t.sceneHint })
}

// Switches the language as the person picked it in the panel: in the
// session's state, which draws the band and the panel again, and in the
// plugin's store, which the next session starts from.
async function chooseLang($: EngineInterface, choice: LangChoice) {
  await update($, langChoice, () => choice)
  await $.store.set('language', choice)
  await registerCommands($)
}

// The language the last pick left in the store, for a new session.
async function loadLang($: EngineInterface) {
  const stored = await $.store.get('language').catch(() => undefined)
  const choice = LANG_CHOICES.find(c => c === stored)
  if (choice !== undefined) {
    await update($, langChoice, () => choice)
  }
}

// The sizes the terminal band draws in, the default first.
const SIZES: readonly Size[] = ['small', 'large']

// Switches the size of the terminal band: in the session's state, which draws
// the band and the panel again, and in the plugin's store, which the next
// session starts from.
async function chooseSize($: EngineInterface, size: Size) {
  await update($, sizeName, () => size)
  await $.store.set('size', size)
}

// The size the last pick left in the store, for a new session.
async function loadSize($: EngineInterface) {
  const stored = await $.store.get('size').catch(() => undefined)
  const size = SIZES.find(s => s === stored)
  if (size !== undefined) {
    await update($, sizeName, () => size)
  }
}

// A percent as the meters show it, whole, so the number and the drawing agree.
const whole = (n: number | null) => (n === null ? null : Math.round(n))

// What the scene on the right shows: the meters, whole percents; the cache's
// seconds left right now; a limit whose window has started over since it was
// read, unused; and whether the conversation is being compacted.
const metersOf = (s: Stats, now: number, isCompacting = false): Meters => ({
  contextLeft: whole(s.contextLeft),
  fiveHour: s.fiveHourResetsAt !== null && now >= s.fiveHourResetsAt ? 0 : whole(s.fiveHour),
  week: s.weekResetsAt !== null && now >= s.weekResetsAt ? 0 : whole(s.week),
  cacheLeft: s.cacheAt === null ? null : Math.max(0, (s.cacheAt + s.cacheTtl * 1000 - now) / 1000),
  cacheTtl: s.cacheTtl,
  isCompacting,
})

// What Clawd does with nothing to do, as the prompt cache runs out: at rest
// with a pastime now and then (`now` sets where in their round), worried with
// a sixth of the cache's life or less left (ten minutes of an hour), yawning
// with a thirtieth or less (two minutes), and asleep once the cache has
// expired.
const idleScene = (meters: Meters, now: number): { scene: Scene; label: Words; pick: ScenePick } => {
  const left = meters.cacheLeft
  const [scene, pick]: [Scene, ScenePick] =
    left === null || left > worryS(meters.cacheTtl)
      ? [waitingScene(now / 1000), { kind: 'round', turns: waitingTurns(now / 1000) }]
      : left <= 0
        ? [scenes.idle, { kind: 'mode', key: 'idle' }]
        : left <= yawnS(meters.cacheTtl)
          ? [cacheScenes.yawn, { kind: 'cache', key: 'yawn' }]
          : [cacheScenes.worry, { kind: 'cache', key: 'worry' }]
  return { scene, label: scene.label, pick }
}

// The terminal draws no SVG: there the band paints Clawd and the scene of
// meters as Rasters of block characters (hooks/raster.ts), and moves them a
// frame at a time with $.ui.blit. A picture counts its animations' time from
// when the band drew it, as the desktop starts an image over when it draws it
// again; drawn again with the very same image, it carries on.
//
// A frame is painted only when a picture's animations say what it shows may
// have changed (Picture.nextChange), and sent only when it did: most of
// their time the scenes hold still. A frame on its way holds back only its
// own picture's next one, and one the terminal never answers is taken as
// lost after a while.
//
// The engine keeps the band's last tree: collapsed (`[-]`) and opened again,
// the band shows it without drawing anew, its pictures at the frame they had.
// So a picture the terminal refuses (the band collapsed) is kept, tried now
// and then (`refusedSince`), and moves on from where its clock is once the
// terminal takes it again.
type LivePicture = {
  requestId: string
  key: string
  picture: Picture
  drawnAt: number
  seenAt: number
  background: number
  // The frame the terminal shows, as far as the band knows; '' when unknown.
  cells: string
  // When the picture's animations may next change what it shows.
  dueAt: number
  // When the frame on its way was sent.
  sendingSince: number | null
  refusedSince: number | null
  triedAt: number
}

// The pictures on screen, by site and key, and the timer that moves them,
// with when it is due.
const livePictures = new Map<string, LivePicture>()
let frameTimer: Timer | null = null
let frameDueAt = Infinity

// Some fifteen frames a second at most: the scenes' quickest motions take a
// fifth of a second.
const FRAME_MS = 66

// A picture the terminal still refuses this long after the band last drew it
// is no longer on screen (the band collapsed): it is tried once a second.
const MOUNT_GRACE_MS = 2000
const REFUSED_RETRY_MS = 1000

// A frame the terminal has not answered this long after it was sent is lost.
const BLIT_TIMEOUT_MS = 2000

// A frame timer this long past due never fired: the engine refused it.
const STALLED_MS = 1000

// The languages whose texts Claude Code measures short (hooks/raster.ts). It
// repaints a changed part of a row at the column it counts, so in a terminal a
// row of such text comes out garbled; there the mod speaks English instead, as
// Claude Code's own terminal UI does.
const MEASURED_SHORT = new Set(LANGS.filter(l => isMeasuredShort(JSON.stringify(TEXTS[l]))))
const langOn = (surface: string, lang: Lang) => (surface === 'terminal' && MEASURED_SHORT.has(lang) ? DEFAULT_LANG : lang)

// A language's own name, or in the terminal, where Claude Code would measure
// it short, its name in English.
const langName = (surface: string, lang: Lang) => (langOn(surface, lang) === lang ? LANG_NAMES[lang] : ENGLISH_NAMES[lang])

// What the label beside Clawd needs at least, in columns, in each language:
// the longest word of its labels, so no word breaks in two, and the `…` after
// it. A language written without spaces (Japanese) breaks between any two
// characters.
const minLabelColumns = (lang: Lang) => {
  const t = TEXTS[lang]
  const labels = [...Object.values(t.states), ...Object.values(t.tools).filter(v => typeof v === 'string')]
  const isSpaced = labels.some(label => label.includes(' '))
  const pieces = labels.flatMap(label => (isSpaced ? label.split(' ') : [...label]))
  return Math.max(...pieces.map(columnsOf)) + 1
}
const MIN_LABEL_COLUMNS = Object.fromEntries(LANGS.map(lang => [lang, minLabelColumns(lang)])) as Record<Lang, number>

// The engine draws the band's collapse mark, `[-]`, over its top right
// corner: the band leaves those columns, and one more beside them, clear.
const MARK_COLUMNS = 4

// The colors the terminal's translucent pixels are laid over: the theme's
// dark or light. Auto takes the terminal's own, as COLORFGBG tells it and
// as Claude Code reads it (its last color, 0 to 15: dark up to 6, and 8);
// dark where nothing tells.
const DARK_BACKGROUND = 0x1f1e1d
const LIGHT_BACKGROUND = 0xffffff
let background: number | null = null

const isLightTerminal = (colors: string | undefined) => {
  const last = colors?.split(';').pop()
  const n = last === undefined || last === '' ? NaN : Number(last)
  return Number.isInteger(n) && n >= 0 && n <= 15 && n > 6 && n !== 8
}

async function terminalBackground($: EngineInterface) {
  if (background === null) {
    const rows = await $.config.list().catch(() => [])
    const theme = rows.find(row => row.key === 'theme')?.value
    const isLight =
      typeof theme === 'string' &&
      (theme.startsWith('light') || (theme === 'auto' && isLightTerminal(await $.env.get('COLORFGBG').catch(() => undefined))))
    background = isLight ? LIGHT_BACKGROUND : DARK_BACKGROUND
  }
  return background
}

// Draws a picture in a terminal site: its frame now, which the tree carries,
// and the ones after it from the frame timer.
function livePicture($: EngineInterface, requestId: string, key: string, picture: Picture, now: number, bg: number) {
  const id = `${requestId} ${key}`
  const kept = livePictures.get(id)
  const drawnAt = kept?.picture === picture && kept.background === bg ? kept.drawnAt : now
  const t = (now - drawnAt) / 1000
  const cells = picture.paint(t, bg)
  const dueAt = drawnAt + picture.nextChange(t) * 1000
  livePictures.set(id, { requestId, key, picture, drawnAt, seenAt: now, background: bg, cells, dueAt, sendingSince: null, refusedSince: null, triedAt: now })
  scheduleFrames($, now)
  return cells
}

// The meters' numbers under a small scene, as a line of text with each
// centered under its meter: the pixel font can't be read at that size. The
// cache's minutes count down by the clock, a minute at a time.
const numbersPicture = (f: Meters, centers: readonly number[], columns: number): Picture => {
  const color = parseInt(INK.slice(1), 16)
  const left = f.cacheLeft
  return {
    columns,
    rows: 1,
    paint: t => textCells(numbersLine(f, centers, columns, t), color),
    nextChange: t => (left === null || left - t <= 0 ? Infinity : left - 60 * (Math.ceil((left - t) / 60) - 1)),
  }
}

const forgetPictures = (requestId: string, except: readonly string[] = []) => {
  for (const [id, live] of livePictures) {
    if (live.requestId === requestId && !except.includes(live.key)) {
      livePictures.delete(id)
    }
  }
}

// The band drew at `requestId`: what another site drew is gone.
const forgetOtherSites = (requestId: string) => {
  for (const [id, live] of livePictures) {
    if (live.requestId !== requestId) {
      livePictures.delete(id)
    }
  }
}

// Sets the frame timer for the soonest picture that has something to do: a
// frame due, a refused one to try again, a frame on its way to give up on.
// A frame on its way wakes the timer at its picture's next change as usual,
// since frames land long before that, or else when it is taken as lost. It
// keeps a timer due no later, unless that one is long past due, which the
// engine never fired; with nothing left to paint, it stops.
function scheduleFrames($: EngineInterface, now: number) {
  let due = Infinity
  for (const live of livePictures.values()) {
    const at =
      live.sendingSince !== null
        ? Math.min(live.dueAt > now ? live.dueAt : Infinity, live.sendingSince + BLIT_TIMEOUT_MS)
        : live.refusedSince !== null
          ? live.triedAt + REFUSED_RETRY_MS
          : live.cells === ''
            ? now
            : live.dueAt
    due = Math.min(due, at)
  }
  if (due === Infinity) {
    frameTimer?.cancel()
    frameTimer = null
    frameDueAt = Infinity
    return
  }
  // A moment past the change, so the frame painted is the one after it.
  due = Math.max(due + 2, now + FRAME_MS)
  if (frameTimer !== null && frameDueAt <= due && now < frameDueAt + STALLED_MS) {
    return
  }
  frameTimer?.cancel()
  frameDueAt = due
  try {
    frameTimer = $.clock.after(due - now, () => void paintFrames($))
  } catch {
    frameTimer = null
    frameDueAt = Infinity
  }
}

// Paints each picture whose animations have moved, and sends the frames
// that changed. One the terminal refuses (the band collapsed) gets its
// frame once a second, until the terminal shows it again.
async function paintFrames($: EngineInterface) {
  frameTimer = null
  frameDueAt = Infinity
  const now = await $.clock.now()
  for (const [id, live] of [...livePictures]) {
    if (livePictures.get(id) !== live) {
      continue
    }
    if (live.sendingSince !== null) {
      if (now - live.sendingSince < BLIT_TIMEOUT_MS) {
        continue
      }
      // Whether it landed or not, the next frame goes whatever it is.
      live.sendingSince = null
      live.cells = ''
    }
    const isRefused = live.refusedSince !== null
    if (isRefused ? now - live.triedAt < REFUSED_RETRY_MS : now < live.dueAt && live.cells !== '') {
      continue
    }
    const t = (now - live.drawnAt) / 1000
    const cells = live.picture.paint(t, live.background)
    live.dueAt = live.drawnAt + live.picture.nextChange(t) * 1000
    // Shown again, a refused picture shows the frame it had: it takes this one whatever it is.
    if (!isRefused && cells === live.cells) {
      continue
    }
    live.triedAt = now
    live.sendingSince = now
    void sendFrame($, id, live, cells, now)
  }
  scheduleFrames($, now)
}

// Sends one picture's frame. Should the band draw another picture there while
// the frame is on its way, the frame may land over it: the picture there now
// sends its own again.
async function sendFrame($: EngineInterface, id: string, live: LivePicture, cells: string, sentAt: number) {
  const sent = await $.ui.blit({ requestId: live.requestId, key: live.key, cells }).catch(() => ({ deny: 'no blit here' }))
  const now = await $.clock.now()
  const there = livePictures.get(id)
  if (there !== live) {
    if (there !== undefined) {
      there.cells = ''
    }
  } else if (live.sendingSince === sentAt) {
    live.sendingSince = null
    if (sent.deny === undefined) {
      live.cells = cells
      live.refusedSince = null
    } else if (sentAt - live.seenAt > MOUNT_GRACE_MS) {
      live.refusedSince ??= sentAt
    }
  }
  scheduleFrames($, now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    detected = null
    await loadLang($)
    await registerCommands($)
    current = { mode: await read($, mode), tool: await read($, tool) }
    await loadMeterScene($)
    await loadSize($)
    await refreshStats($)

    return next(e)
  })

  // The first click on Use or a language, in a panel without the keyboard,
  // arrives as a focus move and no press (see isPanelFocused), so it picks the
  // scene or the language here. Tab and
  // the arrows move the ring only in a panel that holds the keyboard.
  on('ui.focus', { requestId: PANEL }, async ($, e, next) => {
    const wasFocused = isPanelFocused
    const result = await next(e)
    if (result.deny === undefined) {
      isPanelFocused = true
    }
    if (wasFocused || e.origin.kind !== 'person') {
      return result
    }
    const name = e.element?.startsWith('use-') ? e.element.slice('use-'.length) : undefined
    if (name !== undefined && METER_SCENES.some(s => s.name === name)) {
      await chooseMeterScene($, name)
    }
    const choice = LANG_CHOICES.find(c => e.element === `language-${c}`)
    if (choice !== undefined) {
      await chooseLang($, choice)
    }

    return result
  })

  on('command.run', { command: PANEL_COMMAND }, async $ => {
    const t = TEXTS[await commandLang($)]
    await $.ui.open({ id: PANEL, title: t.panelTitle })

    return { text: t.panelOpened }
  })

  on('command.run', { command: SCENE_COMMAND }, async ($, e) => {
    const t = TEXTS[await commandLang($)]
    const names = METER_SCENES.map(s => s.name).join(', ')
    const shown = meterSceneNamed(await read($, sceneName)).name
    const name = e.args.trim().toLowerCase()
    if (name === '') {
      return { text: `${t.sceneIs(shown)} ${t.available(names)}` }
    }
    if (!METER_SCENES.some(s => s.name === name)) {
      return { text: `${t.noScene(name)} ${t.available(names)}` }
    }
    if (name === shown) {
      return { text: t.alreadyScene(name) }
    }
    await chooseMeterScene($, name)

    return { text: t.sceneIs(name) }
  })

  // The Language row of /config changed: the language detected may have too.
  on('config.set', { key: 'language' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined) {
      detected = null
      await redrawBand($)
      await registerCommands($)
    }

    return result
  })

  // The Theme row changed: the terminal's pictures lay their translucent
  // pixels over its background.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined) {
      background = null
      await redrawBand($)
    }

    return result
  })

  // Each model request of the main turn: working until pieces arrive, then
  // thinking, writing or calling a tool as the pieces say. A tool call shows
  // its tool from its first piece, the same as while it runs, so the scene
  // does not restart between the two. A request that got no response (it
  // failed, or was cut short) leaves the cache as it was.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      return yield* next(e)
    }
    isTurnRunning = true
    await show($, 'requesting')
    const stream = next(e)
    for await (const chunk of stream) {
      if (chunk.kind === 'thinking') {
        await show($, 'thinking')
      } else if (chunk.kind === 'text') {
        await show($, 'responding')
      } else if (chunk.kind === 'tool') {
        await show($, 'tool-use', chunk.name)
      }
      yield chunk
    }
    const result = await stream.result
    await refreshStats($, result.stopReason !== null)

    return result
  })

  // A tool runs: the main turn's, or a subagent's while the main turn runs.
  // A subagent left working in the background after the turn shows nothing.
  on('tool.call', async ($, e, next) => {
    if (!e.agentId || isTurnRunning) {
      await show($, 'tool-use', e.tool)
    }

    return next(e)
  })

  // The engine is about to ask the person to allow a tool: Clawd waits with a
  // pastime until the next thing happens (the tool runs, or the turn moves on).
  // A hook beneath that answers for the person (the settings' own, another
  // plugin's) leaves nothing to ask.
  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    if (result.decision === undefined) {
      await show($, 'waiting', e.tool_name)
    }

    return result
  })

  // The person allowed the tool Clawd waits on: it runs now. No event says
  // so but the decision the engine records for the operator's collector,
  // `tool_decision` (`source` `user_temporary` or `user_permanent`), which
  // it raises with no collector set up and with telemetry off, on every
  // surface. A decision of the rules or the mode comes with no ask.
  on('telemetry.log', { to: 'collector' }, async ($, e, next) => {
    const { decision, source } = e.attributes
    if (e.event === 'tool_decision' && decision === 'accept' && String(source).startsWith('user_')) {
      // What Clawd shows next: the wait may still be on its way to the band.
      const asked = pending ?? current
      if (asked.mode === 'waiting' && asked.tool !== 'answer') {
        await show($, 'tool-use', asked.tool)
      }
    }

    return next(e)
  })

  // A connector asks the person to fill in a form.
  on('classic.Elicitation', async ($, e, next) => {
    await show($, 'waiting', 'answer')

    return next(e)
  })

  // The person answered the form (or turned it down): the tool that asked
  // goes on.
  on('classic.ElicitationResult', async ($, e, next) => {
    const asked = pending ?? current
    if (asked.mode === 'waiting' && asked.tool === 'answer') {
      await show($, 'tool-use')
    }

    return next(e)
  })

  // The session started over (a resume, a /clear, after a compaction): the
  // context and the limits read differently now, and after a /clear, a resume
  // or a fork the prompt cache is another conversation's.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      await restartCache($, e.source, e.seconds_since_last_response, e.prompt_cache_likely_expired)
    }
    await refreshStats($)

    return next(e)
  })

  // Compacting the main conversation, by hand, by the button or by the engine;
  // not the compaction the engine prepares ahead of time.
  on('session.compact', async ($, e, next) => {
    if (e.agentId || e.trigger === 'precompute') {
      return next(e)
    }
    return whileCompacting($, () => next(e))
  })

  // The main turn is over; a subagent's run, inside it or in the
  // background, ends nothing on screen.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      return next(e)
    }
    isTurnRunning = false
    await show($, 'idle')
    await refreshStats($)

    return next(e)
  })

  // The band above the prompt, always there: Clawd and what it is doing on the
  // left, the scene of the session's meters and the compact button on the
  // right. Drawn as plain images (no isInteractive): the sandboxed frame paints
  // a white backdrop. Redrawing reloads the images and restarts their
  // animations, so the band reads only values that change on a new mode, a new
  // reading or a step of the cache running out.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      forgetPictures(e.requestId)
      return next(e)
    }

    const lang = langOn(e.surface, await langNow($))
    const t = TEXTS[lang]
    const drawnMode = await read($, mode)
    // A turn that ended without telling (an interruption) leaves no stale mode.
    const isIdle = !e.props.isWorking && drawnMode !== 'compacting' && drawnMode !== 'compacted'
    const now = await $.clock.now()
    const meters = metersOf(await statsNow($), now, drawnMode === 'compacting')
    // No Compact while a compaction runs.
    const isLow = drawnMode !== 'compacting' && meters.contextLeft !== null && meters.contextLeft <= COMPACT_AT
    await read($, redraws)
    const isAsking = await read($, isConfirming)
    const meterScene = meterSceneNamed(await read($, sceneName))
    const { scene, label, pick } = isIdle ? idleScene(meters, now) : sceneFor(drawnMode, await read($, tool), shownAt, now)
    const isOngoing = !isIdle && drawnMode !== 'compacted'

    // The terminal's band: Clawd and the meters as pictures of block
    // characters, Clawd's state beside it, in the size the person picked: the
    // small scenes (hooks/small.ts), or the large ones the desktop shows.
    // A scene of meters with no small drawing shows its large one. Where
    // both don't fit, Clawd with the meters in words; where Clawd doesn't
    // either, words alone.
    if (e.surface === 'terminal') {
      const { Box, Button, Raster, Text } = $.ui.resolve(e)
      const bg = await terminalBackground($)
      const said = `${label[lang]}${isOngoing ? '…' : ''}`
      const isSmall = (await read($, sizeName)) === 'small'
      const clawd = isSmall ? pictureOf(smallSvg(smallScene(pick)), 'quadrants') : pictureOf(svgFor(scene))
      const drawing = isSmall ? meterScene.small : undefined
      const metersPicture = pictureOf(drawing === undefined ? meterScene.svg(meters) : drawing.svg(meters))
      const numbers = drawing === undefined ? null : numbersPicture(meters, drawing.centers, metersPicture.columns)
      const controls = isAsking ? (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor>{t.compactAsk}</Text>
          <Button key="compact-yes" label={t.yes} variant="primary" onPress={() => compactNow($, e.props.isWorking, lang)} />
          <Button key="compact-no" label={t.no} onPress={() => update($, isConfirming, () => false)} />
        </Box>
      ) : (
        // A Button alone keeps to the top of the band's row; in a Box it centers.
        isLow && (
          <Box>
            <Button key="compact" label={t.compact} onPress={() => update($, isConfirming, () => true)} />
          </Box>
        )
      )
      // A Button draws as `[ label ]` here.
      const controlsWidth = isAsking ? columnsOf(t.compactAsk) + columnsOf(t.yes) + columnsOf(t.no) + 10 : isLow ? columnsOf(t.compact) + 4 : 0
      const room = e.props.bodyColumns - MARK_COLUMNS
      const minLabel = MIN_LABEL_COLUMNS[lang]
      const labelRoom = room - clawd.columns - 1 - 2 - (controlsWidth > 0 ? controlsWidth + 1 : 0) - metersPicture.columns
      const fitsAll = labelRoom >= minLabel && e.props.maxRows >= metersPicture.rows + (numbers?.rows ?? 0)
      const fitsClawd = room - clawd.columns - 1 >= minLabel && e.props.maxRows >= clawd.rows
      forgetOtherSites(e.requestId)
      forgetPictures(e.requestId, fitsAll ? ['clawd', 'meters', ...(numbers === null ? [] : ['numbers'])] : fitsClawd ? ['clawd'] : [])

      if (fitsAll) {
        return (
          <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={2} paddingRight={MARK_COLUMNS}>
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Raster key="clawd" columns={clawd.columns} rows={clawd.rows} cells={livePicture($, e.requestId, 'clawd', clawd, now, bg)} />
              <Box width={Math.min(columnsOf(said), labelRoom)}>
                <Text bold wrap="wrap">
                  {said}
                </Text>
              </Box>
            </Box>
            <Box flexDirection="row" alignItems="center" gap={1}>
              {controls}
              <Box flexDirection="column">
                <Raster key="meters" columns={metersPicture.columns} rows={metersPicture.rows} cells={livePicture($, e.requestId, 'meters', metersPicture, now, bg)} />
                {numbers && <Raster key="numbers" columns={numbers.columns} rows={numbers.rows} cells={livePicture($, e.requestId, 'numbers', numbers, now, bg)} />}
              </Box>
            </Box>
          </Box>
        )
      }
      const words = (
        <Box flexDirection="column" gap={1} width={fitsClawd ? room - clawd.columns - 1 : room}>
          <Text bold wrap="wrap">
            {fitsClawd ? said : `Clawd: ${said}`}
          </Text>
          <Text dimColor wrap="wrap">
            {metersAlt(meters, lang)}
          </Text>
          {controls}
        </Box>
      )
      return fitsClawd ? (
        <Box flexDirection="row" alignItems="center" gap={1} paddingRight={MARK_COLUMNS}>
          <Raster key="clawd" columns={clawd.columns} rows={clawd.rows} cells={livePicture($, e.requestId, 'clawd', clawd, now, bg)} />
          {words}
        </Box>
      ) : (
        <Box paddingRight={MARK_COLUMNS}>{words}</Box>
      )
    }

    const { Box, Button, Markdown, Svg, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={svgFor(scene)} alt={`Clawd: ${label[lang]}`} width={VIEW_W * SCALE} height={VIEW_H * 2 * SCALE} />
          <Markdown text={`### ${label[lang]}${isOngoing ? '…' : ''}`} dimColor />
        </Box>
        <Box flexDirection="row" alignItems="center" gap={1}>
          {isAsking ? (
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text dimColor>{t.compactAsk}</Text>
              <Button key="compact-yes" label={t.yes} variant="primary" onPress={() => compactNow($, e.props.isWorking, lang)} />
              <Button key="compact-no" label={t.no} onPress={() => update($, isConfirming, () => false)} />
            </Box>
          ) : (
            isLow && <Button key="compact" label={t.compact} onPress={() => update($, isConfirming, () => true)} />
          )}
          <Svg
            source={meterScene.svg(meters)}
            alt={metersAlt(meters, lang)}
            width={meterScene.width * meterScene.scale}
            height={meterScene.height * meterScene.scale}
          />
        </Box>
      </Box>
    )
  })

  // The panel where the person picks the scene on the band's right. Where
  // images draw, a gallery: each scene with the session's meters as they are
  // now, the one in use marked. The terminal, which draws no images, shows what Clawd is
  // doing in words and a picker of the scenes.
  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e) => {
    isPanelFocused = e.props.isFocused
    await read($, redraws)
    const lang = langOn(e.surface, await langNow($))
    const t = TEXTS[lang]
    const choice = await read($, langChoice)
    const auto = langName(e.surface, await detectedLang($))
    const choiceName = (c: LangChoice) => (c === 'auto' ? t.auto(auto) : langName(e.surface, c))
    const shown = meterSceneNamed(await read($, sceneName)).name
    if (e.surface === 'terminal') {
      const { Box, Select, Text } = $.ui.resolve(e)
      const shownMode = await read($, mode)
      const now = await $.clock.now()
      const { label } =
        shownMode === 'idle' ? idleScene(metersOf(await statsNow($), now), now) : sceneFor(shownMode, await read($, tool), shownAt, now)
      const isOngoing = shownMode !== 'idle' && shownMode !== 'compacted'

      return (
        <Box flexDirection="column">
          <Text>{isOngoing ? `${label[lang]}…` : label[lang]}</Text>
          <Select
            key="scene"
            label={t.scene}
            options={METER_SCENES.map(s => ({ value: s.name, label: s.label[lang] }))}
            value={shown}
            onSelect={name => chooseMeterScene($, name)}
          />
          <Select
            key="language"
            label={t.language}
            options={LANG_CHOICES.map(c => ({ value: c, label: choiceName(c) }))}
            value={choice}
            onSelect={value => chooseLang($, LANG_CHOICES.find(c => c === value) ?? 'auto')}
          />
          <Select
            key="size"
            label={t.size}
            options={SIZES.map(s => ({ value: s, label: t.sizes[s] }))}
            value={await read($, sizeName)}
            onSelect={value => chooseSize($, SIZES.find(s => s === value) ?? 'small')}
          />
        </Box>
      )
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const meters = metersOf(await statsNow($), await $.clock.now())

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" gap={1}>
          <Text dimColor>{t.language}:</Text>
          {LANG_CHOICES.map(c =>
            c === choice ? (
              <Text key={`language-${c}`} bold>
                {choiceName(c)}
              </Text>
            ) : (
              <Button key={`language-${c}`} label={choiceName(c)} onPress={() => chooseLang($, c)} />
            ),
          )}
        </Box>
        <Text dimColor>{t.pickScene}</Text>
        {METER_SCENES.map(s => {
          const isInUse = s.name === shown

          return (
            <Box
              key={`scene-${s.name}`}
              flexDirection="column"
              alignItems="center"
              gap={1}
              padding={1}
              borderStyle="round"
              borderColor={isInUse ? BODY : undefined}
              borderDimColor={!isInUse}
            >
              <Svg source={s.svg(meters)} alt={`${s.label[lang]}: ${metersAlt(meters, lang)}`} width={s.width * s.scale} height={s.height * s.scale} />
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Text bold>{s.label[lang]}</Text>
                {isInUse ? (
                  <Text dimColor>{t.inUse}</Text>
                ) : (
                  <Button key={`use-${s.name}`} label={t.use} onPress={() => chooseMeterScene($, s.name)} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}
