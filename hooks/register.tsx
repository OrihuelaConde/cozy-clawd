import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { ClawdMode, Stats } from '../types'
import { DEFAULT_FIGURE_SCENE, FIGURE_SCENES, figureSceneNamed, figuresAlt } from './escenas/index'
import type { Act, Figures } from './escenas/index'
import { DEFAULT_LANG, LANG_NAMES, LANGS, langOf } from './idioma'
import type { Lang, LangChoice, Words } from './idioma'

const PANE = 'clawd'
const mode = atom({ plugin: 'cozy-clawd', key: 'mode' } as const, 'idle')
const tool = atom({ plugin: 'cozy-clawd', key: 'tool' } as const, null)
const stats = atom({ plugin: 'cozy-clawd', key: 'stats' } as const, { contextLeft: null, fiveHour: null, week: null, cacheAt: null })
const isConfirming = atom({ plugin: 'cozy-clawd', key: 'isConfirming' } as const, false)
const redraws = atom({ plugin: 'cozy-clawd', key: 'redraws' } as const, 0)
const escena = atom({ plugin: 'cozy-clawd', key: 'escena' } as const, DEFAULT_FIGURE_SCENE.name)
const idioma = atom({ plugin: 'cozy-clawd', key: 'idioma' } as const, 'auto')

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

type Scene = { label: Words; eyes?: string; extra: string; css: string }

const BLINK = `
  @keyframes blink { 0%, 92% { opacity: 1; } 93%, 100% { opacity: 0; } }`

// Hammering in three frames: raised, swinging, struck with sparks.
const toolUse: Scene = {
  label: { es: 'Trabajando', en: 'Working' },
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

const scenes: Record<ClawdMode, Scene> = {
  // Nothing running (the pane only): asleep, breathing slowly, z's drifting up.
  idle: {
    label: { es: 'Durmiendo', en: 'Sleeping' },
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
    label: { es: 'Trabajando en la respuesta', en: 'Working on the answer' },
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
  // Nothing to do yet: a ladybug flies past overhead and Clawd follows it.
  // Kept for an idle "waiting" state; nothing sets this mode yet.
  waiting: {
    label: { es: 'Esperando', en: 'Waiting' },
    eyes: `<g class="follow">${OPEN_EYES}</g>`,
    extra: `
      <g class="bug">
        <g fill="${SHELL}">${px(1, 0, 3, 0.5)}${px(0, 0.5, 5, 1)}${px(1, 1.5, 3, 0.5)}</g>
        <g fill="${EYE}">${px(1, 0.5, 1, 0.5)}${px(3, 0.5, 1, 0.5)}${px(2, 1, 1, 0.5)}</g>
        <g fill="${STEEL}">${px(5, 0.5, 1, 1)}</g>
        <g class="wings" fill="${WING}" opacity="0.8">${px(1, -0.5, 1, 0.5)}${px(3, -0.5, 1, 0.5)}</g>
      </g>`,
    css: `
      .clawd { animation: bob 1.2s steps(1) infinite; }
      .follow { animation: follow 4s steps(1) infinite; }
      .bug { animation: fly 4s steps(48) infinite; }
      .wings { animation: flap 0.2s steps(1) infinite; }
      @keyframes bob { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 0.5px); } }
      @keyframes follow {
        0%, 24.9% { transform: translate(-1px, -0.5px); }
        25%, 49.9% { transform: translate(0, -0.5px); }
        50%, 79.9% { transform: translate(1px, -0.5px); }
        80%, 100% { transform: translate(0, 0); }
      }
      @keyframes fly {
        0% { transform: translate(-6px, -2.5px); }
        20% { transform: translate(1px, -3px); }
        40% { transform: translate(8px, -2.5px); }
        60% { transform: translate(15px, -3px); }
        80% { transform: translate(26px, -2.5px); }
        100% { transform: translate(26px, -2.5px); }
      }
      @keyframes flap { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Compacting the conversation: three loose sheets are pressed together,
  // Clawd's arm pushing down, until they are one small golden block.
  compacting: {
    label: { es: 'Compactando la conversación', en: 'Compacting the conversation' },
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
    label: { es: '¡Conversación compactada!', en: 'Conversation compacted!' },
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
    label: { es: 'Pensando', en: 'Thinking' },
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
  'tool-input': { ...toolUse, label: { es: 'Preparando una herramienta', en: 'Preparing a tool' } },
  'tool-use': { ...toolUse, label: { es: 'Usando una herramienta', en: 'Using a tool' } },
  // Writing the answer: walks in place while lines of text appear beside it.
  responding: {
    label: { es: 'Escribiendo', en: 'Writing' },
    extra: `
      <g fill="${DOT}">
        <g class="l1">${px(19, 0, 4, 0.5)}</g>
        <g class="l2">${px(19, 1.25, 3, 0.5)}</g>
        <g class="l3">${px(19, 2.5, 4, 0.5)}</g>
        <g class="l4">${px(19, 3.75, 2, 0.5)}</g>
      </g>`,
    css: `
      .clawd { animation: hop 0.8s steps(1) infinite; }
      .legs-a { animation: stepA 0.4s steps(1) infinite; }
      .legs-b { animation: stepB 0.4s steps(1) infinite; }
      .eyes { animation: blink 2.6s steps(1) infinite; }
      .l1 { animation: line1 2.4s steps(1) infinite; }
      .l2 { animation: line2 2.4s steps(1) infinite; }
      .l3 { animation: line3 2.4s steps(1) infinite; }
      .l4 { animation: line4 2.4s steps(1) infinite; }
      @keyframes hop { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }
      @keyframes stepA { 0%, 49.9% { transform: translate(0, -0.5px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes stepB { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -0.5px); } }
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

const toolScenes: Record<ToolKind, Scene> = {
  // Reading or searching: the page of the editing scene, already written, and a
  // magnifying glass that sweeps down and up over it while Clawd watches.
  look: {
    label: { es: 'Leyendo', en: 'Reading' },
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
    label: { es: 'Editando', en: 'Editing' },
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
    label: { es: 'Ejecutando un comando', en: 'Running a command' },
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
    label: { es: 'Navegando', en: 'Browsing' },
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
    label: { es: 'Lanzando un subagente', en: 'Launching a subagent' },
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
  // Waiting on the person (a question, a plan to approve): the ladybug.
  wait: scenes.waiting,
  other: toolUse,
}

// Each tool by name: its family and what the band says while it runs.
const TOOLS: Record<string, [ToolKind, Words]> = {
  Read: ['look', { es: 'Leyendo un archivo', en: 'Reading a file' }],
  Grep: ['look', { es: 'Buscando en el código', en: 'Searching the code' }],
  Glob: ['look', { es: 'Buscando archivos', en: 'Finding files' }],
  LS: ['look', { es: 'Mirando una carpeta', en: 'Looking at a folder' }],
  Edit: ['write', { es: 'Editando un archivo', en: 'Editing a file' }],
  MultiEdit: ['write', { es: 'Editando un archivo', en: 'Editing a file' }],
  NotebookEdit: ['write', { es: 'Editando un notebook', en: 'Editing a notebook' }],
  Write: ['write', { es: 'Escribiendo un archivo', en: 'Writing a file' }],
  Bash: ['shell', { es: 'Ejecutando un comando', en: 'Running a command' }],
  PowerShell: ['shell', { es: 'Ejecutando un comando', en: 'Running a command' }],
  WebFetch: ['web', { es: 'Leyendo una página web', en: 'Reading a web page' }],
  WebSearch: ['web', { es: 'Buscando en la web', en: 'Searching the web' }],
  Agent: ['agent', { es: 'Lanzando un subagente', en: 'Launching a subagent' }],
  Task: ['agent', { es: 'Lanzando un subagente', en: 'Launching a subagent' }],
  AskUserQuestion: ['wait', { es: 'Esperando tu respuesta', en: 'Waiting for your answer' }],
  ExitPlanMode: ['wait', { es: 'Esperando que apruebes el plan', en: 'Waiting for you to approve the plan' }],
}

// An MCP tool's own name, without the `mcp__<server>__` prefix.
const shortName = (tool: string) => (tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool)

// What the band shows for a mode, and for the tool when one runs. In the
// waiting mode `tool` says what is awaited: `answer` (a form a connector
// asked for) or anything else, a tool waiting for the person's approval.
const sceneFor = (m: ClawdMode, tool: string | null) => {
  if (m === 'waiting') {
    return {
      scene: scenes.waiting,
      label:
        tool === 'answer'
          ? { es: 'Esperando tu respuesta', en: 'Waiting for your answer' }
          : { es: 'Esperando tu aprobación', en: 'Waiting for your approval' },
    }
  }
  if ((m === 'tool-use' || m === 'tool-input') && tool !== null) {
    const [kind, label] = TOOLS[tool] ?? ['other', { es: `Usando ${shortName(tool)}`, en: `Using ${shortName(tool)}` }]
    return { scene: toolScenes[kind], label }
  }
  const scene = scenes[m] ?? scenes.requesting
  return { scene, label: scene.label }
}

// A piece of Clawd's arm that shows from `from`% of the cycle until it pulls
// the arm back at 80%.
const stretch = (name: string, from: number) =>
  `.${name} { animation: ${name} 3.2s steps(1) infinite; }
  @keyframes ${name} { 0%, ${from - 0.1}% { opacity: 0; } ${from}%, 79.9% { opacity: 1; } 80%, 100% { opacity: 0; } }`

// What Clawd does instead of sleeping when the scene on the right calls for
// it; the scene says what for, and the band says that instead of the label.
const cueScenes: Record<Act, Scene> = {
  // Clawd looks over at the scene and stretches an arm out toward it, its claw
  // grabbing at the air, then pulls back and tries again: for the cold mate.
  reach: {
    label: { es: 'Estirando el brazo', en: 'Reaching out' },
    extra: `
      <g fill="${BODY}">
        <g class="r1">${px(17, 2)}</g><g class="r2">${px(18, 2)}</g><g class="r3">${px(19, 2)}</g>
        <g class="r4">${px(20, 2)}</g><g class="r5">${px(21, 2)}</g>
        <g class="r6"><g class="open">${px(22, 1.5, 1, 0.5)}${px(22, 3, 1, 0.5)}</g><g class="closed">${px(22, 2)}</g></g>
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3.2s steps(1) infinite; }
      ${stretch('r1', 8)} ${stretch('r2', 14)} ${stretch('r3', 20)} ${stretch('r4', 26)} ${stretch('r5', 32)} ${stretch('r6', 38)}
      .open { animation: grab 0.5s steps(1) infinite; }
      .closed { animation: grab 0.5s steps(1) -0.25s infinite; }
      @keyframes grab { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      ${BLINK}`,
  },
  // Clawd stretches its arms up in a big yawn, then nods off: the moon set.
  yawn: {
    label: { es: 'Bostezando', en: 'Yawning' },
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
  // side: the watering can is running dry.
  watch: {
    label: { es: 'Preocupado', en: 'Worried' },
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
    <g class="enter"><g class="clawd">${sprite(scene.eyes ?? OPEN_EYES)}</g></g>
    <g class="props">${scene.extra}</g>
  </g>
</svg>`

// Each mode stays on screen at least this long: the engine hands a response's
// text over in one burst, often right before a tool call, so without a floor
// a mode can last a few milliseconds and never be seen.
const MIN_MS = 1500

// The compact button shows once this much of the context, or less, is free.
const COMPACT_AT = 25

// How long the prompt cache keeps a conversation after its last request:
// Claude Code's requests use the one-hour cache.
const CACHE_TTL_MIN = 60

// What the commands, the band's button and the pane say, in each language.
const TEXTS = {
  es: {
    clawdCommand: 'Abrí el panel para elegir la escena y el idioma de la franja',
    sceneCommand: 'Elegí la escena de la derecha de la franja',
    sceneHint: '[escena]',
    paneTitle: 'Escenas',
    paneOpened: 'Panel de escenas abierto.',
    sceneIs: (name: string) => `Escena: ${name}.`,
    available: (names: string) => `Hay: ${names}.`,
    noScene: (name: string) => `No hay una escena "${name}".`,
    alreadyScene: (name: string) => `La escena ya es ${name}.`,
    waitToCompact: 'Clawd: esperá a que termine el turno para compactar.',
    compactAsk: '¿Compactar?',
    yes: 'Sí',
    no: 'No',
    compact: 'Compactar',
    scene: 'Escena',
    pickScene: 'Elegí la escena de la derecha de la franja.',
    inUse: 'en uso',
    use: 'Usar',
    language: 'Idioma',
    auto: (name: string) => `Automático (${name})`,
  },
  en: {
    clawdCommand: "Open the panel to pick the band's scene and language",
    sceneCommand: "Pick the scene on the band's right",
    sceneHint: '[scene]',
    paneTitle: 'Scenes',
    paneOpened: 'Scenes panel opened.',
    sceneIs: (name: string) => `Scene: ${name}.`,
    available: (names: string) => `Available: ${names}.`,
    noScene: (name: string) => `There is no scene "${name}".`,
    alreadyScene: (name: string) => `The scene is already ${name}.`,
    waitToCompact: 'Clawd: wait for the turn to end before compacting.',
    compactAsk: 'Compact?',
    yes: 'Yes',
    no: 'No',
    compact: 'Compact',
    scene: 'Scene',
    pickScene: "Pick the scene on the band's right.",
    inUse: 'in use',
    use: 'Use',
    language: 'Language',
    auto: (name: string) => `Automatic (${name})`,
  },
} satisfies Record<Lang, unknown>

// The picks of the pane's language row, in its order.
const LANG_CHOICES: readonly LangChoice[] = ['auto', ...LANGS]

type Shown = { mode: ClawdMode; tool: string | null }

// The module's own copy of what is shown, so a stream writes state only on a change.
let current: Shown = { mode: 'idle', tool: null }
let shownAt = 0
let pending: Shown | null = null
let timer: Timer | null = null

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

// The cache's candle and minutes run down by themselves; the band is drawn
// again once, when the cache expires, to put the candle out.
let expiry: Timer | null = null

// Reads the context window and the usage limits as the engine last saw them.
// After an answer the cache starts over, and its expiry is scheduled anew.
async function refreshStats($: EngineInterface, isAnswer = false) {
  const usage = await $.session.usage()
  const limit = (kind: string) => usage.rateLimits.find(r => r.kind === kind)?.percentUsed ?? null
  const now = await $.clock.now()
  await update($, stats, s => ({
    contextLeft: usage.context.percent === undefined ? null : 100 - usage.context.percent,
    fiveHour: limit('five_hour'),
    week: limit('seven_day'),
    cacheAt: isAnswer ? now : s.cacheAt,
  }))
  if (isAnswer) {
    expiry?.cancel()
    expiry = $.clock.after(CACHE_TTL_MIN * 60_000 + 500, () => redrawBand($))
  }
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

// Compacting in the middle of a turn would cut it short: the button only says so.
async function compactNow($: EngineInterface, isWorking: boolean) {
  await update($, isConfirming, () => false)
  if (isWorking) {
    $.ui.toast(TEXTS[await langNow($)].waitToCompact)
    return
  }
  await $.session.compact()
}

// Switches the scene the band draws on its right: in the session's state,
// which draws the band and the pane again, and in the plugin's store, which
// the next session starts from. Not a userConfig field: the desktop app lists
// no plugin rows in /config, so $.config.set cannot reach one there.
async function chooseFigureScene($: EngineInterface, name: string) {
  await update($, escena, () => name)
  await $.store.set('escena', name)
}

// Whether the person had given the pane the keyboard, as it was last drawn or
// focused. On the desktop, a click on a Button of a pane without the keyboard
// only hands it the keyboard: `ui.focus` lands on the Button, and no press.
let isPaneFocused = false

// The scene the last pick left in the store, for a new session.
async function loadFigureScene($: EngineInterface) {
  const stored = await $.store.get('escena')
  if (typeof stored === 'string') {
    await update($, escena, () => figureSceneNamed(stored).name)
  }
}

// The language Claude Code shows the person, as far as a plugin can see it;
// worked out once a session, and again when the Language row changes.
let detected: Lang | null = null

// Claude Code hands a plugin neither the app's language nor its translated
// texts. The Language row of /config (the language Claude answers in) says
// it when the person set one; then the locale variables, in the order a
// program reads them; English when none names a language the mod speaks. A
// read the host does not answer counts as unset.
async function detectLang($: EngineInterface): Promise<Lang> {
  const rows = await $.config.list().catch(() => [])
  const locales = [
    rows.find(row => row.key === 'language')?.value,
    await $.env.get('LC_ALL').catch(() => undefined),
    await $.env.get('LC_MESSAGES').catch(() => undefined),
    await $.env.get('LANG').catch(() => undefined),
  ]

  return locales.map(langOf).find(lang => lang !== null) ?? DEFAULT_LANG
}

async function detectedLang($: EngineInterface) {
  detected ??= await detectLang($)
  return detected
}

// The language the band, the pane and the commands speak: the person's pick
// in the pane, or the one detected.
async function langNow($: EngineInterface): Promise<Lang> {
  const choice = await read($, idioma)
  return choice === 'auto' ? await detectedLang($) : choice
}

// Declares the commands, their menu lines in the language spoken now; again
// when it changes.
async function registerCommands($: EngineInterface) {
  const t = TEXTS[await langNow($)]
  await $.command.register({ name: 'clawd', description: t.clawdCommand })
  await $.command.register({ name: 'clawd-escena', description: t.sceneCommand, argumentHint: t.sceneHint })
}

// Switches the language as the person picked it in the pane: in the
// session's state, which draws the band and the pane again, and in the
// plugin's store, which the next session starts from.
async function chooseLang($: EngineInterface, choice: LangChoice) {
  await update($, idioma, () => choice)
  await $.store.set('idioma', choice)
  await registerCommands($)
}

// The language the last pick left in the store, for a new session.
async function loadLang($: EngineInterface) {
  const stored = await $.store.get('idioma').catch(() => undefined)
  const choice = LANG_CHOICES.find(c => c === stored)
  if (choice !== undefined) {
    await update($, idioma, () => choice)
  }
}

// What the scene on the right shows: the figures, the cache's seconds left
// right now, and whether the conversation is being compacted.
const figuresOf = (s: Stats, now: number, isCompacting = false): Figures => ({
  contextLeft: s.contextLeft,
  fiveHour: s.fiveHour,
  week: s.week,
  cacheLeft: s.cacheAt === null ? null : Math.max(0, (s.cacheAt + CACHE_TTL_MIN * 60_000 - now) / 1000),
  cacheTtl: CACHE_TTL_MIN * 60,
  isCompacting,
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    detected = null
    await loadLang($)
    await registerCommands($)
    current = { mode: await read($, mode), tool: await read($, tool) }
    await loadFigureScene($)
    await refreshStats($)

    return next(e)
  })

  // The first click on Usar or a language, in a pane without the keyboard,
  // arrives as a focus move and no press (see isPaneFocused), so it picks the
  // scene or the language here. Tab and
  // the arrows move the ring only in a pane that holds the keyboard.
  on('ui.focus', { requestId: PANE }, async ($, e, next) => {
    const wasFocused = isPaneFocused
    const result = await next(e)
    if (result.deny === undefined) {
      isPaneFocused = true
    }
    if (wasFocused || e.origin.kind !== 'person') {
      return result
    }
    const name = e.element?.startsWith('usar-') ? e.element.slice('usar-'.length) : undefined
    if (name !== undefined && FIGURE_SCENES.some(s => s.name === name)) {
      await chooseFigureScene($, name)
    }
    const choice = LANG_CHOICES.find(c => e.element === `idioma-${c}`)
    if (choice !== undefined) {
      await chooseLang($, choice)
    }

    return result
  })

  on('command.run', { command: 'clawd' }, async $ => {
    const t = TEXTS[await langNow($)]
    await $.ui.open({ id: PANE, title: t.paneTitle })

    return { text: t.paneOpened }
  })

  on('command.run', { command: 'clawd-escena' }, async ($, e) => {
    const t = TEXTS[await langNow($)]
    const names = FIGURE_SCENES.map(s => s.name).join(', ')
    const shown = figureSceneNamed(await read($, escena)).name
    const name = e.args.trim().toLowerCase()
    if (name === '') {
      return { text: `${t.sceneIs(shown)} ${t.available(names)}` }
    }
    if (!FIGURE_SCENES.some(s => s.name === name)) {
      return { text: `${t.noScene(name)} ${t.available(names)}` }
    }
    if (name === shown) {
      return { text: t.alreadyScene(name) }
    }
    await chooseFigureScene($, name)

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

  // Each model request of the main turn: working until pieces arrive, then
  // thinking, writing or calling a tool as the pieces say. A tool call shows
  // its tool from its first piece, the same as while it runs, so the scene
  // does not restart between the two.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      return yield* next(e)
    }
    await show($, 'requesting')
    for await (const chunk of next(e)) {
      if (chunk.kind === 'thinking') {
        await show($, 'thinking')
      } else if (chunk.kind === 'text') {
        await show($, 'responding')
      } else if (chunk.kind === 'tool') {
        await show($, 'tool-use', chunk.name)
      }
      yield chunk
    }
    await refreshStats($, true)
  })

  on('tool.call', async ($, e, next) => {
    await show($, 'tool-use', e.tool)

    return next(e)
  })

  // The engine is about to ask the person to allow a tool: Clawd waits with
  // the ladybug until the next thing happens (the tool runs, or the turn moves on).
  on('classic.PermissionRequest', async ($, e, next) => {
    await show($, 'waiting', e.tool_name)

    return next(e)
  })

  // A connector asks the person to fill in a form.
  on('classic.Elicitation', async ($, e, next) => {
    await show($, 'waiting', 'answer')

    return next(e)
  })

  // The session started over (a resume, a /clear, after a compaction): the
  // context and the limits read differently now.
  on('classic.SessionStart', async ($, e, next) => {
    await refreshStats($)

    return next(e)
  })

  // Compacting the main conversation, by hand, by the button or by the engine;
  // not the compaction the engine prepares ahead of time.
  on('session.compact', async ($, e, next) => {
    if (e.agentId || e.trigger === 'precompute') {
      return next(e)
    }
    await show($, 'compacting')
    let isDone = false
    try {
      const result = await next(e)
      isDone = result.skip === undefined
      return result
    } finally {
      // The fresh figures first, so the celebration shows the scene refilled.
      await refreshStats($)
      await (isDone ? celebrate($) : show($, 'idle'))
    }
  })

  on('turn.complete', async ($, e, next) => {
    await show($, 'idle')
    await refreshStats($)

    return next(e)
  })

  // The band above the prompt, always there: Clawd and what it is doing on the
  // left, the scene of the session's figures and the compact button on the
  // right. Drawn as plain images (no isInteractive): the sandboxed frame paints
  // a white backdrop. Redrawing reloads the images and restarts their
  // animations, so the band reads only values that change on a new mode, a new
  // reading or the cache's expiry.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface === 'terminal') {
      return next(e)
    }

    const { Box, Button, Markdown, Svg, Text } = $.ui.resolve(e)
    const lang = await langNow($)
    const t = TEXTS[lang]
    const drawnMode = await read($, mode)
    // A turn that ended without telling (an interruption) leaves no stale mode.
    const isIdle = !e.props.isWorking && drawnMode !== 'compacting' && drawnMode !== 'compacted'
    const figures = figuresOf(await read($, stats), await $.clock.now(), drawnMode === 'compacting')
    const isLow = figures.contextLeft !== null && figures.contextLeft <= COMPACT_AT
    await read($, redraws)
    const isAsking = await read($, isConfirming)
    const figureScene = figureSceneNamed(await read($, escena))
    // Idle, Clawd sleeps, unless the scene on the right calls for something else.
    const cue = isIdle ? (figureScene.cue?.(figures) ?? null) : null
    const idle = cue === null ? { scene: scenes.idle, label: scenes.idle.label } : { scene: cueScenes[cue.act], label: cue.label }
    const { scene, label } = isIdle ? idle : sceneFor(drawnMode, await read($, tool))
    const isOngoing = !isIdle && drawnMode !== 'compacted'

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
              <Button key="compact-yes" label={t.yes} variant="primary" onPress={() => compactNow($, e.props.isWorking)} />
              <Button key="compact-no" label={t.no} onPress={() => update($, isConfirming, () => false)} />
            </Box>
          ) : (
            isLow && <Button key="compact" label={t.compact} onPress={() => update($, isConfirming, () => true)} />
          )}
          <Svg
            source={figureScene.svg(figures)}
            alt={figuresAlt(figures, lang)}
            width={figureScene.width * figureScene.scale}
            height={figureScene.height * figureScene.scale}
          />
        </Box>
      </Box>
    )
  })

  // The pane where the person picks the scene on the band's right. Where
  // images draw, a gallery: each scene with the session's figures as they are
  // now, the one in use marked. The terminal, with no band, shows what Clawd is
  // doing in words and a picker of the scenes.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    isPaneFocused = e.props.isFocused
    await read($, redraws)
    const lang = await langNow($)
    const t = TEXTS[lang]
    const choice = await read($, idioma)
    const auto = LANG_NAMES[await detectedLang($)]
    const choiceName = (c: LangChoice) => (c === 'auto' ? t.auto(auto) : LANG_NAMES[c])
    const shown = figureSceneNamed(await read($, escena)).name
    if (e.surface === 'terminal') {
      const { Box, Select, Text } = $.ui.resolve(e)
      const { scene, label } = sceneFor(await read($, mode), await read($, tool))

      return (
        <Box flexDirection="column">
          <Text>{scene === scenes.idle || scene === scenes.compacted ? label[lang] : `${label[lang]}…`}</Text>
          <Select
            key="escena"
            label={t.scene}
            options={FIGURE_SCENES.map(s => ({ value: s.name, label: s.label[lang] }))}
            value={shown}
            onSelect={name => chooseFigureScene($, name)}
          />
          <Select
            key="idioma"
            label={t.language}
            options={LANG_CHOICES.map(c => ({ value: c, label: choiceName(c) }))}
            value={choice}
            onSelect={value => chooseLang($, LANG_CHOICES.find(c => c === value) ?? 'auto')}
          />
        </Box>
      )
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const figures = figuresOf(await read($, stats), await $.clock.now())

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor>{t.language}:</Text>
          {LANG_CHOICES.map(c =>
            c === choice ? (
              <Text key={`idioma-${c}`} bold>
                {choiceName(c)}
              </Text>
            ) : (
              <Button key={`idioma-${c}`} label={choiceName(c)} onPress={() => chooseLang($, c)} />
            ),
          )}
        </Box>
        <Text dimColor>{t.pickScene}</Text>
        {FIGURE_SCENES.map(s => {
          const isInUse = s.name === shown

          return (
            <Box
              key={`escena-${s.name}`}
              flexDirection="column"
              alignItems="center"
              gap={1}
              padding={1}
              borderStyle="round"
              borderColor={isInUse ? BODY : undefined}
              borderDimColor={!isInUse}
            >
              <Svg source={s.svg(figures)} alt={`${s.label[lang]}: ${figuresAlt(figures, lang)}`} width={s.width * s.scale} height={s.height * s.scale} />
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Text bold>{s.label[lang]}</Text>
                {isInUse ? (
                  <Text dimColor>{t.inUse}</Text>
                ) : (
                  <Button key={`usar-${s.name}`} label={t.use} onPress={() => chooseFigureScene($, s.name)} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}
