import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { ClawdMode, Stats } from '../types'
import { DEFAULT_FIGURE_SCENE, FIGURE_SCENES, figureSceneNamed, figuresAlt } from './scenes/index'
import type { Figures } from './scenes/index'
import { DEFAULT_LANG, LANG_NAMES, LANGS, langOf } from './language'
import type { Lang, LangChoice, Words } from './language'

const PANE = 'clawd'
// The slash commands: the pane, and the scene by name.
const PANE_COMMAND = 'cozy-clawd'
const SCENE_COMMAND = 'cozy-clawd-scene'
const mode = atom({ plugin: 'cozy-clawd', key: 'mode' } as const, 'idle')
const tool = atom({ plugin: 'cozy-clawd', key: 'tool' } as const, null)
const stats = atom({ plugin: 'cozy-clawd', key: 'stats' } as const, { contextLeft: null, fiveHour: null, week: null, cacheAt: null })
const isConfirming = atom({ plugin: 'cozy-clawd', key: 'isConfirming' } as const, false)
const redraws = atom({ plugin: 'cozy-clawd', key: 'redraws' } as const, 0)
const sceneName = atom({ plugin: 'cozy-clawd', key: 'sceneName' } as const, DEFAULT_FIGURE_SCENE.name)
const langChoice = atom({ plugin: 'cozy-clawd', key: 'langChoice' } as const, 'auto')

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

const scenes: Record<Exclude<ClawdMode, 'waiting'>, Scene> = {
  // Nothing to do and the prompt cache expired: asleep, breathing slowly, z's
  // drifting up. With the cache still warm Clawd passes the time instead.
  idle: {
    label: { es: 'Durmiendo: la caché venció', en: 'Sleeping: the cache expired' },
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

const toolScenes: Record<Exclude<ToolKind, 'wait'>, Scene> = {
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
// While Clawd waits on the person it passes the time with a pastime picked
// for that wait (`since`, when the wait began).
const sceneFor = (m: ClawdMode, tool: string | null, since = 0) => {
  if (m === 'waiting') {
    return {
      scene: waitScene(since),
      label:
        tool === 'answer'
          ? { es: 'Esperando tu respuesta', en: 'Waiting for your answer' }
          : { es: 'Esperando tu aprobación', en: 'Waiting for your approval' },
    }
  }
  if ((m === 'tool-use' || m === 'tool-input') && tool !== null) {
    const [kind, label] = TOOLS[tool] ?? ['other', { es: `Usando ${shortName(tool)}`, en: `Using ${shortName(tool)}` }]
    return { scene: kind === 'wait' ? waitScene(since) : toolScenes[kind], label }
  }
  const scene = scenes[m] ?? scenes.requesting
  return { scene, label: scene.label }
}

// What Clawd does as the prompt cache runs out, between waiting and sleeping.
const cacheScenes: Record<'worry' | 'yawn', Scene> = {
  // Clawd stretches its arms up in a big yawn, then nods off: two minutes or
  // less of the cache are left.
  yawn: {
    label: { es: 'Bostezando: la caché está por vencer', en: 'Yawning: the cache is about to expire' },
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
  // side: ten minutes or less of the cache are left.
  worry: {
    label: { es: 'Preocupado: la caché vence pronto', en: 'Worried: the cache expires soon' },
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
  label: { es: 'Esperando', en: 'Waiting' },
  body: pastimeBody(p),
  extra: '',
  css: `${p.css}
    ${BLINK}`,
})

// Clawd between turns with the prompt cache warm: at rest, and every so
// often a pastime picked at random, all in one image so no redraw is needed
// to change them. The round goes by the clock (`atS`, in seconds), so a
// redraw takes it up where it was rather than from the start.
const waitingScene = (atS: number): Scene => {
  const slot = REST_S + PASTIME_S
  const cycle = PASTIMES.length * ROUND_SHUFFLES * slot
  const order = roundOrder(Math.floor(atS / cycle))
  const rests = order.map((_, k): [number, number] => [k * slot, k * slot + REST_S])
  const turns = PASTIMES.map((_, i) =>
    order.flatMap((p, k): [number, number][] => (p === i ? [[k * slot + REST_S, (k + 1) * slot]] : [])),
  )
  const at = atS % cycle
  return {
    label: { es: 'Esperando', en: 'Waiting' },
    body: [pastimeBody(REST, `turn-${REST.name}`), ...PASTIMES.map(p => pastimeBody(p, `turn-${p.name}`))].join(''),
    extra: '',
    css: `${windowsCss(REST.name, rests, cycle, at)}
    ${PASTIMES.map((p, i) => windowsCss(p.name, turns[i] ?? [], cycle, at)).join('\n    ')}
    ${[REST, ...PASTIMES].map(p => p.css).join('')}
    ${BLINK}`,
  }
}

// What Clawd does while it waits on the person: one pastime, picked at
// random for the wait that began at `since` (milliseconds).
const waitScene = (since: number) => {
  const pick = PASTIMES[Math.floor(chance(Math.floor(since / 1000)) * PASTIMES.length)] ?? REST
  return pastimeScene(pick)
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
    <g class="enter">${scene.body ?? `<g class="clawd">${sprite(scene.eyes ?? OPEN_EYES)}</g>`}</g>
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
    paneCommand: 'Abrí el panel para elegir la escena y el idioma de la franja',
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
    paneCommand: "Open the panel to pick the band's scene and language",
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

// With this little of the prompt cache left, in seconds, Clawd frets; with
// this little, it yawns.
const WORRY_S = 10 * 60
const YAWN_S = 2 * 60

// The cache's candle and minutes run down by themselves; the band is drawn
// again only as the cache runs out: when Clawd starts to fret, when it
// yawns, and when the cache expires, to put the candle out.
let cacheTimers: Timer[] = []

// Reads the context window and the usage limits as the engine last saw them.
// After an answer the cache starts over, and its last minutes are scheduled anew.
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
    for (const t of cacheTimers) {
      t.cancel()
    }
    cacheTimers = []
    for (const leftS of [WORRY_S, YAWN_S, 0]) {
      cacheTimers.push($.clock.after((CACHE_TTL_MIN * 60 - leftS) * 1000 + 500, () => redrawBand($)))
    }
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
  await update($, sceneName, () => name)
  await $.store.set('scene', name)
}

// Whether the person had given the pane the keyboard, as it was last drawn or
// focused. On the desktop, a click on a Button of a pane without the keyboard
// only hands it the keyboard: `ui.focus` lands on the Button, and no press.
let isPaneFocused = false

// The scene the last pick left in the store, for a new session.
async function loadFigureScene($: EngineInterface) {
  const stored = await $.store.get('scene')
  if (typeof stored === 'string') {
    await update($, sceneName, () => figureSceneNamed(stored).name)
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

// The language the operating system shows the person, as a code (`es-AR`):
// on Windows read from the registry, on macOS the first of AppleLanguages;
// null where neither answers.
async function systemLocale($: EngineInterface): Promise<string | null> {
  if ((await $.env.get('OS').catch(() => undefined)) === 'Windows_NT') {
    for (const [key, value] of WINDOWS_LOCALES) {
      const found = await $.process.run(['reg.exe', 'query', key, '/v', value]).catch(() => null)
      const code = found?.exitCode === 0 ? /REG_\w+\s+([a-z]{2,3}\b[-\w]*)/i.exec(found.stdout)?.[1] : undefined
      if (code) {
        return code
      }
    }
    return null
  }
  const found = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages']).catch(() => null)

  return found?.exitCode === 0 ? /[a-z]{2,3}\b[-\w]*/i.exec(found.stdout)?.[0] ?? null : null
}

async function detectedLang($: EngineInterface) {
  detected ??= await detectLang($)
  return detected
}

// The language the band, the pane and the commands speak: the person's pick
// in the pane, or the one detected.
async function langNow($: EngineInterface): Promise<Lang> {
  const choice = await read($, langChoice)
  return choice === 'auto' ? await detectedLang($) : choice
}

// Declares the commands, their menu lines in the language spoken now; again
// when it changes.
async function registerCommands($: EngineInterface) {
  const t = TEXTS[await langNow($)]
  await $.command.register({ name: PANE_COMMAND, description: t.paneCommand })
  await $.command.register({ name: SCENE_COMMAND, description: t.sceneCommand, argumentHint: t.sceneHint })
}

// Switches the language as the person picked it in the pane: in the
// session's state, which draws the band and the pane again, and in the
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

// What Clawd does with nothing to do, as the prompt cache runs out: at rest
// with a pastime now and then (`now` sets where in their round), worried with
// ten minutes or less left, yawning with two or less, and asleep once the
// cache has expired.
const idleScene = (figures: Figures, now: number) => {
  const left = figures.cacheLeft
  const scene =
    left === null || left > WORRY_S
      ? waitingScene(now / 1000)
      : left <= 0
        ? scenes.idle
        : left <= YAWN_S
          ? cacheScenes.yawn
          : cacheScenes.worry
  return { scene, label: scene.label }
}

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
    const name = e.element?.startsWith('use-') ? e.element.slice('use-'.length) : undefined
    if (name !== undefined && FIGURE_SCENES.some(s => s.name === name)) {
      await chooseFigureScene($, name)
    }
    const choice = LANG_CHOICES.find(c => e.element === `language-${c}`)
    if (choice !== undefined) {
      await chooseLang($, choice)
    }

    return result
  })

  on('command.run', { command: PANE_COMMAND }, async $ => {
    const t = TEXTS[await langNow($)]
    await $.ui.open({ id: PANE, title: t.paneTitle })

    return { text: t.paneOpened }
  })

  on('command.run', { command: SCENE_COMMAND }, async ($, e) => {
    const t = TEXTS[await langNow($)]
    const names = FIGURE_SCENES.map(s => s.name).join(', ')
    const shown = figureSceneNamed(await read($, sceneName)).name
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

  // The engine is about to ask the person to allow a tool: Clawd waits with a
  // pastime until the next thing happens (the tool runs, or the turn moves on).
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
  // reading or a step of the cache running out.
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
    const now = await $.clock.now()
    const figures = figuresOf(await read($, stats), now, drawnMode === 'compacting')
    const isLow = figures.contextLeft !== null && figures.contextLeft <= COMPACT_AT
    await read($, redraws)
    const isAsking = await read($, isConfirming)
    const figureScene = figureSceneNamed(await read($, sceneName))
    const { scene, label } = isIdle ? idleScene(figures, now) : sceneFor(drawnMode, await read($, tool), shownAt)
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
    const choice = await read($, langChoice)
    const auto = LANG_NAMES[await detectedLang($)]
    const choiceName = (c: LangChoice) => (c === 'auto' ? t.auto(auto) : LANG_NAMES[c])
    const shown = figureSceneNamed(await read($, sceneName)).name
    if (e.surface === 'terminal') {
      const { Box, Select, Text } = $.ui.resolve(e)
      const shownMode = await read($, mode)
      const now = await $.clock.now()
      const { label } =
        shownMode === 'idle' ? idleScene(figuresOf(await read($, stats), now), now) : sceneFor(shownMode, await read($, tool), shownAt)
      const isOngoing = shownMode !== 'idle' && shownMode !== 'compacted'

      return (
        <Box flexDirection="column">
          <Text>{isOngoing ? `${label[lang]}…` : label[lang]}</Text>
          <Select
            key="scene"
            label={t.scene}
            options={FIGURE_SCENES.map(s => ({ value: s.name, label: s.label[lang] }))}
            value={shown}
            onSelect={name => chooseFigureScene($, name)}
          />
          <Select
            key="language"
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
              <Text key={`language-${c}`} bold>
                {choiceName(c)}
              </Text>
            ) : (
              <Button key={`language-${c}`} label={choiceName(c)} onPress={() => chooseLang($, c)} />
            ),
          )}
        </Box>
        <Text dimColor>{t.pickScene}</Text>
        {FIGURE_SCENES.map(s => {
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
              <Svg source={s.svg(figures)} alt={`${s.label[lang]}: ${figuresAlt(figures, lang)}`} width={s.width * s.scale} height={s.height * s.scale} />
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Text bold>{s.label[lang]}</Text>
                {isInUse ? (
                  <Text dimColor>{t.inUse}</Text>
                ) : (
                  <Button key={`use-${s.name}`} label={t.use} onPress={() => chooseFigureScene($, s.name)} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}
