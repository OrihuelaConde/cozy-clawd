// Clawd's scenes in the small size, which the terminal band shows unless the
// person picks the large one. Clawd is drawn as Claude Code's welcome screen
// draws it, a pixel a quadrant of a cell (hooks/raster.ts, `quadrants`):
// pixels twice as tall as wide, two colors to a cell. A scene is 30 pixels
// across and 10 down, 15 columns and 5 rows; Clawd stands in its bottom three
// rows, what floats over it goes in the two above, and what it handles to its
// right.
//
// Coordinates are in pixels with Clawd's head at y 0, so what floats has a
// negative y. A cell is the pixels at x 2k and 2k + 1 and at y 2k and 2k + 1:
// a drawing keeps to two colors in each, the terminal's own counting as one,
// or the cell shows the two it has most of. What moves moves by whole pixels,
// and by two where it must keep to its cells.
//
// The same scenes as the large size, under the same names (register.tsx);
// the band picks one with a `ScenePick` and draws it here.

// The large size's palette (register.tsx).
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

// What the band shows, as both sizes read it: a mode's own scene, a family of
// tools, a step of the cache running out, the round of rest and pastimes
// (`turns`, the CSS that shows each in its turn), or one pastime.
export type ScenePick =
  | { kind: 'mode'; key: string }
  | { kind: 'tool'; key: string }
  | { kind: 'cache'; key: string }
  | { kind: 'round'; turns: string }
  | { kind: 'pastime'; key: string }

type Scene = { eyes?: string; extra: string; css: string; body?: string }

const px = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`

// A character, in the cell that holds pixel (x, y).
const char = (x: number, y: number, c: string) => `<text x="${x}" y="${y}">${c}</text>`

// Clawd as the welcome screen draws it: a body 13 pixels wide, so its eyes
// fall in the same half of their cells, arms out to the sides, four legs.
const sprite = (eyes: string) => `
  <g class="body" fill="${BODY}">${px(2, 0, 13, 4)}</g>
  <g class="arm-l" fill="${BODY}">${px(0, 2, 2, 1)}</g>
  <g class="arm-r" fill="${BODY}">${px(15, 2, 2, 1)}</g>
  <g class="legs-a" fill="${BODY}">${px(2, 4)}${px(12, 4)}</g>
  <g class="legs-b" fill="${BODY}">${px(4, 4)}${px(14, 4)}</g>
  <g class="eyes" fill="${EYE}">${eyes}</g>`

const OPEN_EYES = px(4, 1) + px(12, 1)

// Shut eyes, too thin for a pixel: a low line in each eye's cell.
const CLOSED_EYES = char(4, 1, '_') + char(12, 1, '_')

const BLINK = `
  @keyframes blink { 0%, 92% { opacity: 1; } 93%, 100% { opacity: 0; } }`

// Hammering in three frames: raised, swinging, struck with sparks. Clawd's
// hand reaches a pixel further to hold the handle, which keeps them in
// cells of their own.
const toolUse: Scene = {
  extra: `
    <g class="hand" fill="${BODY}">${px(17, 2)}</g>
    <g class="up"><g fill="${HANDLE}">${px(18, -2, 1, 4)}</g><g fill="${STEEL}">${px(17, -3, 3, 1)}</g></g>
    <g class="mid"><g fill="${HANDLE}">${px(18, 1)}${px(19, 0)}</g><g fill="${STEEL}">${px(20, -1, 2, 1)}</g></g>
    <g class="down">
      <g fill="${HANDLE}">${px(18, 2, 2, 1)}</g>
      <g fill="${STEEL}">${px(20, 1, 1, 3)}</g>
      <g fill="${SPARK}">${px(22, 1)}${px(22, 3)}${px(23, 2)}</g>
    </g>`,
  css: `
    .eyes { transform: translate(1px, 0); }
    .up { animation: up 0.7s steps(1) infinite; }
    .mid { animation: mid 0.7s steps(1) infinite; }
    .down { animation: down 0.7s steps(1) infinite; }
    .arm-r, .hand { animation: lift 0.7s steps(1) infinite; }
    @keyframes up { 0%, 39.9% { opacity: 1; } 40%, 100% { opacity: 0; } }
    @keyframes mid { 0%, 39.9% { opacity: 0; } 40%, 54.9% { opacity: 1; } 55%, 100% { opacity: 0; } }
    @keyframes down { 0%, 54.9% { opacity: 0; } 55%, 100% { opacity: 1; } }
    @keyframes lift { 0%, 54.9% { transform: translate(0, -1px); } 55%, 100% { transform: translate(0, 0); } }`,
}

const scenes: Record<string, Scene> = {
  // Asleep, the cache expired: eyes shut, a small and a big z drifting up.
  idle: {
    eyes: CLOSED_EYES,
    extra: `
      <g fill="${DOT}">
        <g class="z1">${char(17, -1, 'z')}</g>
        <g class="z2">${char(17, -1, 'Z')}</g>
      </g>`,
    css: `
      .z1 { animation: drift 3s steps(1) infinite; }
      .z2 { animation: drift 3s steps(1) -1.5s infinite; }
      @keyframes drift {
        0%, 9.9% { opacity: 0; transform: translate(0, 0); } 10%, 39.9% { opacity: 1; transform: translate(0, 0); }
        40%, 69.9% { opacity: 1; transform: translate(2px, -2px); } 70%, 84.9% { opacity: 1; transform: translate(4px, -2px); }
        85%, 100% { opacity: 0; transform: translate(4px, -2px); }
      }`,
  },
  // A model request in flight: Clawd stacks three blocks, lifting an arm to
  // place each; the stack sparkles and clears.
  requesting: {
    extra: `
      <g class="b1" fill="${SPARK}">${px(18, 4, 2, 1)}</g>
      <g class="b2" fill="${SKY}">${px(20, 4, 2, 1)}</g>
      <g class="b3" fill="${LEAF}">${px(19, 3, 2, 1)}</g>
      <g class="done" fill="${WING}">${px(17, 0)}${px(22, 1)}${px(23, 3)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .arm-r { animation: place 2.4s steps(1) infinite; }
      .b1 { animation: drop1 2.4s steps(1) infinite; }
      .b2 { animation: drop2 2.4s steps(1) infinite; }
      .b3 { animation: drop3 2.4s steps(1) infinite; }
      .done { animation: done 2.4s steps(1) infinite; }
      @keyframes place {
        0%, 11.9% { transform: translate(0, -1px); } 12%, 19.9% { transform: translate(0, 0); }
        20%, 31.9% { transform: translate(0, -1px); } 32%, 39.9% { transform: translate(0, 0); }
        40%, 51.9% { transform: translate(0, -1px); } 52%, 100% { transform: translate(0, 0); }
      }
      @keyframes drop1 { 0% { transform: translate(0, -5px); } 4% { transform: translate(0, -3px); } 8% { transform: translate(0, -1px); } 12%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes drop2 { 0%, 19.9% { opacity: 0; } 20% { opacity: 1; transform: translate(0, -5px); } 24% { transform: translate(0, -3px); } 28% { transform: translate(0, -1px); } 32%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes drop3 { 0%, 39.9% { opacity: 0; } 40% { opacity: 1; transform: translate(0, -4px); } 44% { transform: translate(0, -2px); } 48% { transform: translate(0, -1px); } 52%, 80% { transform: translate(0, 0); opacity: 1; } 81%, 100% { opacity: 0; } }
      @keyframes done { 0%, 55.9% { opacity: 0; } 56%, 63.9% { opacity: 1; } 64%, 69.9% { opacity: 0; } 70%, 77.9% { opacity: 1; } 78%, 100% { opacity: 0; } }
      ${BLINK}`,
  },
  // Compacting the conversation: three loose sheets are pressed together,
  // Clawd's arm pushing down, until they are one small golden block.
  compacting: {
    extra: `
      <g class="sheets" fill="${WING}">
        <g class="s1">${px(18, -1, 4, 1)}</g>
        <g class="s2">${px(19, 1, 4, 1)}</g>
        <g class="s3">${px(18, 3, 4, 1)}</g>
      </g>
      <g class="cube"><g fill="${SPARK}">${px(18, 2, 2, 2)}</g><g fill="#FFFFFF">${px(18, 2)}</g></g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .arm-r { animation: press 2.4s steps(1) infinite; }
      .s1 { animation: s1 2.4s steps(1) infinite; }
      .s2 { animation: s2 2.4s steps(1) infinite; }
      .sheets { animation: sheets 2.4s steps(1) infinite; }
      .cube { animation: cube 2.4s steps(1) infinite; }
      @keyframes press { 0%, 34.9% { transform: translate(0, -1px); } 35%, 100% { transform: translate(0, 0); } }
      @keyframes s1 { 0%, 34.9% { transform: translate(0, 0); } 35%, 49.9% { transform: translate(0, 1px); } 50%, 100% { transform: translate(0, 2px); } }
      @keyframes s2 { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(-1px, 1px); } }
      @keyframes sheets { 0%, 69.9% { opacity: 1; } 70%, 100% { opacity: 0; } }
      @keyframes cube { 0%, 69.9% { opacity: 0; } 70%, 100% { opacity: 1; } }`,
  },
  // A compaction just finished: Clawd hops twice for joy, arms up, among sparkles.
  compacted: {
    extra: `
      <g fill="${SPARK}">
        <g class="k1">${px(18, -2)}${px(1, -3)}</g>
        <g class="k2">${px(19, 0)}${px(0, -1)}</g>
        <g class="k3">${px(18, -4)}${px(3, -4)}</g>
      </g>`,
    css: `
      .clawd { animation: jump 1.2s steps(1) infinite; }
      .arm-l, .arm-r { animation: cheer 1.2s steps(1) infinite; }
      .k1 { animation: twinkle 0.6s steps(1) infinite; }
      .k2 { animation: twinkle 0.6s steps(1) -0.2s infinite; }
      .k3 { animation: twinkle 0.6s steps(1) -0.4s infinite; }
      @keyframes jump { 0%, 19.9% { transform: translate(0, -1px); } 20%, 49.9% { transform: translate(0, 0); } 50%, 69.9% { transform: translate(0, -1px); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes cheer { 0%, 19.9% { transform: translate(0, -1px); } 20%, 49.9% { transform: translate(0, 0); } 50%, 69.9% { transform: translate(0, -1px); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes twinkle { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Thinking: two thought dots, then a light bulb that switches on.
  thinking: {
    extra: `
      <g fill="${DOT}">
        <g class="d1">${px(15, -1)}</g>
        <g class="d2">${px(17, -2)}</g>
      </g>
      <g class="bulb">
        <g class="glass">${px(20, -4, 4, 1)}${px(19, -3, 6, 1)}${px(20, -2, 4, 1)}</g>
        <g fill="${STEEL}">${px(20, -1, 4, 1)}</g>
        <g class="lit">
          <g fill="#FFFFFF">${px(20, -3)}</g>
          <g class="rays" fill="${SPARK}">${px(18, -4)}${px(25, -4)}${px(25, -2)}</g>
        </g>
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
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
      @keyframes rays { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      ${BLINK}`,
  },
  'tool-input': toolUse,
  'tool-use': toolUse,
  // Writing the answer: types away, a hand at a time, while lines of text
  // appear beside it.
  responding: {
    extra: `
      <g fill="${DOT}">
        <g class="l1">${px(19, -1, 4, 1)}</g>
        <g class="l2">${px(19, 1, 3, 1)}</g>
        <g class="l3">${px(19, 3, 4, 1)}</g>
      </g>`,
    css: `
      .arm-l { animation: tap 0.3s steps(1) infinite; }
      .arm-r { animation: tap 0.3s steps(1) -0.15s infinite; }
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 2.6s steps(1) infinite; }
      .l1 { animation: line1 2.4s steps(1) infinite; }
      .l2 { animation: line2 2.4s steps(1) infinite; }
      .l3 { animation: line3 2.4s steps(1) infinite; }
      @keyframes tap { 0%, 49.9% { transform: translate(0, -1px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes line1 { 0%, 14.9% { opacity: 0; } 15%, 100% { opacity: 1; } }
      @keyframes line2 { 0%, 39.9% { opacity: 0; } 40%, 100% { opacity: 1; } }
      @keyframes line3 { 0%, 64.9% { opacity: 0; } 65%, 100% { opacity: 1; } }
      ${BLINK}`,
  },
}

// A round globe six pixels across and four down, x 18 to 23, from y 0 to 3.
const GLOBE = px(19, 0, 4, 1) + px(18, 1, 6, 2) + px(19, 3, 4, 1)

// Land on one turn of the globe, as [x within its six columns, y].
const LAND: [number, number][] = [[1, 0], [0, 1], [1, 1], [4, 1], [4, 2], [5, 2], [1, 2], [3, 3]]

// A sheet of paper beside Clawd, x 18 to 23, its top at y 0.
const PAPER = `<g fill="${WING}">${px(18, 0, 6, 4)}</g>`

const toolScenes: Record<string, Scene> = {
  // Reading or searching: a written page, and a lens that moves over it a
  // cell at a time while Clawd watches.
  look: {
    extra: `
      ${PAPER}
      <g fill="${DOT}">${px(18, 1, 6, 1)}${px(18, 3, 4, 1)}</g>
      <g class="scan">
        <g fill="${SKY}">${px(18, 0, 2, 2)}</g>
        <g fill="#FFFFFF">${px(18, 0)}</g>
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .scan { animation: scan 2s steps(1) infinite; }
      @keyframes scan {
        0%, 24.9% { transform: translate(0, 0); } 25%, 49.9% { transform: translate(2px, 0); }
        50%, 74.9% { transform: translate(4px, 2px); } 75%, 100% { transform: translate(0, 2px); }
      }
      ${BLINK}`,
  },
  // Editing or writing a file: line after line of ink on a page, a pencil beside it.
  write: {
    extra: `
      ${PAPER}
      <g fill="${EYE}">
        <g class="i1">${px(18, 1)}</g><g class="i2">${px(19, 1)}</g><g class="i3">${px(20, 1)}</g><g class="i4">${px(21, 1)}</g>
        <g class="i5">${px(18, 3)}</g><g class="i6">${px(19, 3)}</g><g class="i7">${px(20, 3)}</g>
      </g>
      <g class="pencil">
        <g fill="#E8A0A0">${px(25, -1)}</g>
        <g fill="${SPARK}">${px(25, 0, 1, 4)}</g>
        <g fill="${EYE}">${px(25, 4)}</g>
      </g>`,
    css: `
      svg { --cycle: 3s; }
      .eyes { transform: translate(1px, 0); }
      ${[10, 20, 30, 40, 55, 65, 75].map((from, i) => appear(`i${i + 1}`, from)).join('\n      ')}`,
  },
  // Running a command: Clawd types at a monitor where green drops of code
  // fall, each column at its own pace.
  shell: {
    extra: `
      <defs><clipPath id="screen">${px(19, 0, 8, 2)}</clipPath></defs>
      <g fill="${STEEL}">${px(18, -1, 10, 1)}${px(18, 0, 1, 2)}${px(27, 0, 1, 2)}${px(18, 2, 10, 1)}${px(22, 3, 2, 1)}${px(20, 4, 6, 1)}</g>
      <g fill="#0B140D">${px(19, 0, 8, 2)}</g>
      <g clip-path="url(#screen)" fill="#3FD46A">
        ${[20, 21, 22, 23, 24, 25].map(x => `<g class="rain c${x}">${px(x, -1)}</g>`).join('')}
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .arm-l { animation: tap 0.3s steps(1) infinite; }
      .arm-r { animation: tap 0.3s steps(1) -0.15s infinite; }
      .rain { animation: rain 1.2s steps(3) infinite; }
      .c20 { animation-duration: 1.1s; animation-delay: -0.3s; }
      .c21 { animation-duration: 1.5s; animation-delay: -0.9s; }
      .c22 { animation-duration: 0.9s; animation-delay: -0.1s; }
      .c23 { animation-duration: 1.3s; animation-delay: -0.6s; }
      .c24 { animation-duration: 1.2s; animation-delay: -0.4s; }
      .c25 { animation-duration: 1s; animation-delay: -0.8s; }
      @keyframes tap { 0%, 49.9% { transform: translate(0, -1px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes rain { from { transform: translate(0, 0); } to { transform: translate(0, 3px); } }`,
  },
  // On the web: a desk globe turns on its stand.
  web: {
    extra: `
      <defs><clipPath id="globe">${GLOBE}</clipPath></defs>
      <g fill="${SKY}">${GLOBE}</g>
      <g clip-path="url(#globe)"><g class="spin" fill="${LEAF}">
        ${[0, 6].map(dx => LAND.map(([x, y]) => px(18 + dx + x, y)).join('')).join('')}
      </g></g>
      <g fill="${STEEL}">${px(24, 1, 1, 2)}${px(20, 4, 2, 1)}${px(19, 5, 4, 1)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 3s steps(1) infinite; }
      .arm-r { transform: translate(0, -1px); }
      .spin { animation: spin 2.4s steps(6) infinite; }
      @keyframes spin { from { transform: translate(0, 0); } to { transform: translate(-6px, 0); } }
      ${BLINK}`,
  },
  // Launching a subagent: a small Clawd runs off while the big one waves. The
  // small one's eyes sit a row down its body, so the body frames them; its
  // legs go apart and together at each step.
  agent: {
    extra: `
      <g class="mini">
        <g fill="${BODY}">${px(18, 1, 5, 3)}</g>
        <g fill="${EYE}">${px(19, 2)}${px(21, 2)}</g>
        <g class="mini-apart" fill="${BODY}">${px(18, 4)}${px(22, 4)}</g>
        <g class="mini-together" fill="${BODY}">${px(19, 4)}${px(21, 4)}</g>
      </g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .arm-r { animation: wave 0.4s steps(1) infinite; }
      .mini { animation: run 2s steps(1) infinite; }
      .mini-apart { animation: stride 0.4s steps(1) infinite; }
      .mini-together { animation: stride 0.4s steps(1) -0.2s infinite; }
      @keyframes wave { 0%, 49.9% { transform: translate(0, -1px); } 50%, 100% { transform: translate(0, 0); } }
      @keyframes stride { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      @keyframes run {
        0%, 19.9% { transform: translate(0, 0); opacity: 1; } 20%, 39.9% { transform: translate(2px, 0); }
        40%, 59.9% { transform: translate(4px, 0); } 60%, 79.9% { transform: translate(6px, 0); opacity: 1; }
        80%, 100% { transform: translate(6px, 0); opacity: 0; }
      }`,
  },
  // Any other tool: the hammer.
  other: toolUse,
}

// A class that shows from `from`% of the cycle until 95%, then clears with the rest.
function appear(name: string, from: number) {
  return `.${name} { animation: ${name} var(--cycle) steps(1) infinite; }
      @keyframes ${name} { 0%, ${from - 0.1}% { opacity: 0; } ${from}%, 94.9% { opacity: 1; } 95%, 100% { opacity: 0; } }`
}

const cacheScenes: Record<string, Scene> = {
  // Clawd stretches its arms up in a big yawn, then nods off: two minutes or
  // less of the cache are left.
  yawn: {
    eyes: `<g class="drowsy">${OPEN_EYES}</g><g class="shut">${CLOSED_EYES}</g>`,
    extra: `
      <g class="gape" fill="${EYE}">${px(8, 2, 2, 1)}</g>
      <g fill="${DOT}"><g class="z1">${char(17, -1, 'z')}</g></g>`,
    css: `
      .arm-l, .arm-r { animation: stretchup 4s steps(1) infinite; }
      .drowsy { animation: drowsy 4s steps(1) infinite; }
      .shut { animation: shut 4s steps(1) infinite; }
      .gape { animation: gape 4s steps(1) infinite; }
      .z1 { animation: doze 4s steps(1) infinite; }
      @keyframes stretchup { 0%, 14.9% { transform: translate(0, 0); } 15%, 44.9% { transform: translate(0, -1px); } 45%, 100% { transform: translate(0, 0); } }
      @keyframes drowsy { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
      @keyframes shut { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
      @keyframes gape { 0%, 19.9% { opacity: 0; } 20%, 39.9% { opacity: 1; } 40%, 100% { opacity: 0; } }
      @keyframes doze { 0%, 59.9% { opacity: 0; transform: translate(0, 0); } 60%, 79.9% { opacity: 1; transform: translate(0, 0); } 80%, 94.9% { opacity: 1; transform: translate(2px, -2px); } 95%, 100% { opacity: 0; } }`,
  },
  // Clawd keeps an anxious eye on the scene, a drop of sweat running down its
  // side: ten minutes or less of the cache are left.
  worry: {
    extra: `<g class="sweat" fill="${SKY}">${px(16, -2)}</g>`,
    css: `
      .eyes { transform: translate(1px, 0); }
      .eyes rect { animation: blink 2.4s steps(1) infinite; }
      .sweat { animation: sweat 1.6s steps(1) infinite; }
      @keyframes sweat {
        0%, 14.9% { opacity: 0; transform: translate(0, 0); } 15%, 39.9% { opacity: 1; transform: translate(0, 1px); }
        40%, 64.9% { opacity: 1; transform: translate(0, 2px); } 65%, 89.9% { opacity: 1; transform: translate(0, 3px); } 90%, 100% { opacity: 0; }
      }
      ${BLINK}`,
  },
}

// One of the things Clawd does to pass the time between turns, its css under
// its own class; the same names as the large size's, in the same order.
type Pastime = { name: string; eyes?: string; extra: string; css: string }

// Keyframes that jump a thing from point to point, each held an equal share
// of the cycle; the points are offsets from where it is drawn.
const hops = (name: string, points: [number, number][]) =>
  `@keyframes ${name} { ${points
    .map(([x, y], i) => `${((i / points.length) * 100).toFixed(2)}% { transform: translate(${x}px, ${y}px); }`)
    .join(' ')} 100% { transform: translate(${points[0]?.[0] ?? 0}px, ${points[0]?.[1] ?? 0}px); } }`

// Where a juggled ball goes, from the left hand: up and over the head to the
// right hand, then back low.
const JUGGLE: [number, number][] = [[0, 0], [1, -2], [3, -4], [6, -5], [9, -5], [12, -5], [14, -4], [15, -2], [16, 0], [13, -2], [8, -3], [3, -2]]

export const PASTIMES: readonly Pastime[] = [
  // Looks around, this way and that. (The large size taps a foot too, which a
  // pixel this tall can't show.)
  {
    name: 'gaze',
    eyes: `<g class="gaze-look">${OPEN_EYES}</g>`,
    extra: '',
    css: `
      .gaze .eyes rect { animation: blink 3s steps(1) infinite; }
      .gaze .gaze-look { animation: gaze-look 4.5s steps(1) infinite; }
      @keyframes gaze-look {
        0%, 24.9% { transform: translate(-1px, 0); } 25%, 37.9% { transform: translate(0, 0); }
        38%, 64.9% { transform: translate(1px, 0); } 65%, 79.9% { transform: translate(1px, -1px); } 80%, 100% { transform: translate(0, 0); }
      }`,
  },
  // Whistles a tune, notes floating off.
  {
    name: 'whistle',
    eyes: `${OPEN_EYES}<g fill="${EYE}">${px(8, 2)}</g>`,
    extra: `
      <g class="whistle-n1" fill="${SPARK}">${char(18, -1, '♪')}</g>
      <g class="whistle-n2" fill="${SKY}">${char(18, -1, '♫')}</g>`,
    css: `
      .whistle-n1 { animation: whistle-float 2.4s steps(1) infinite; }
      .whistle-n2 { animation: whistle-float 2.4s steps(1) -1.2s infinite; }
      @keyframes whistle-float {
        0%, 39.9% { opacity: 1; transform: translate(0, 0); } 40%, 79.9% { opacity: 1; transform: translate(2px, -2px); }
        80%, 100% { opacity: 0; transform: translate(2px, -2px); }
      }`,
  },
  // Juggles three balls over its head, the hands taking turns.
  {
    name: 'juggle',
    eyes: `<g class="juggle-up">${OPEN_EYES}</g>`,
    extra: `
      <g class="juggle-b1" fill="${SHELL}">${px(0, 1)}</g>
      <g class="juggle-b2" fill="${SKY}">${px(0, 1)}</g>
      <g class="juggle-b3" fill="${LEAF}">${px(0, 1)}</g>`,
    css: `
      .juggle-up { transform: translate(0, -1px); }
      .juggle .arm-l { animation: juggle-pump 0.6s steps(1) infinite; }
      .juggle .arm-r { animation: juggle-pump 0.6s steps(1) -0.3s infinite; }
      .juggle-b1 { animation: juggle-ball 1.8s steps(1) infinite; }
      .juggle-b2 { animation: juggle-ball 1.8s steps(1) -0.6s infinite; }
      .juggle-b3 { animation: juggle-ball 1.8s steps(1) -1.2s infinite; }
      @keyframes juggle-pump { 0%, 49.9% { transform: translate(0, 0); } 50%, 100% { transform: translate(0, -1px); } }
      ${hops('juggle-ball', JUGGLE)}`,
  },
  // Plays with a yo-yo: down on its string and back up, spinning at the bottom.
  {
    name: 'yoyo',
    eyes: `<g class="yoyo-look">${OPEN_EYES}</g>`,
    extra: `
      <g class="yoyo-up">
        <g fill="${WING}">${px(17, 1)}</g>
        <g class="yoyo-toy" fill="${SHELL}">${px(17, 2, 2, 2)}</g>
      </g>
      <g class="yoyo-down">
        <g fill="${WING}">${px(17, 1, 1, 3)}</g>
        <g class="yoyo-toy" fill="${SHELL}">${px(17, 4, 2, 2)}</g>
      </g>`,
    css: `
      .yoyo .arm-r { transform: translate(0, -1px); }
      .yoyo-look { animation: yoyo-look 2s steps(1) infinite; }
      .yoyo-up { animation: yoyo-up 2s steps(1) infinite; }
      .yoyo-down { animation: yoyo-down 2s steps(1) infinite; }
      .yoyo-toy { animation: yoyo-spin 0.3s steps(1) infinite; }
      @keyframes yoyo-up { 0%, 29.9% { opacity: 1; } 30%, 69.9% { opacity: 0; } 70%, 100% { opacity: 1; } }
      @keyframes yoyo-down { 0%, 29.9% { opacity: 0; } 30%, 69.9% { opacity: 1; } 70%, 100% { opacity: 0; } }
      @keyframes yoyo-look { 0%, 29.9% { transform: translate(1px, 0); } 30%, 69.9% { transform: translate(1px, 0); } 70%, 100% { transform: translate(0, 0); } }
      @keyframes yoyo-spin { 0%, 49.9% { fill: ${SHELL}; } 50%, 100% { fill: #A8322A; } }`,
  },
  // Blows soap bubbles through a wand and watches them drift off.
  {
    name: 'bubbles',
    eyes: `<g class="bubbles-look">${OPEN_EYES}</g>`,
    extra: `
      <g fill="${HANDLE}">${px(17, 1)}${px(18, 0)}</g>
      <g fill="${STEEL}">${px(19, -1)}</g>
      <g fill="${SKY}">
        <g class="bubbles-b1">${char(20, -2, 'o')}</g>
        <g class="bubbles-b2">${char(20, -2, '°')}</g>
        <g class="bubbles-b3">${char(20, -2, 'o')}</g>
      </g>`,
    css: `
      .bubbles-look { animation: bubbles-look 3s steps(1) infinite; }
      .bubbles-b1 { animation: bubbles-rise 3s steps(1) infinite; }
      .bubbles-b2 { animation: bubbles-rise 3s steps(1) -1s infinite; }
      .bubbles-b3 { animation: bubbles-rise 3s steps(1) -2s infinite; }
      @keyframes bubbles-rise {
        0%, 12.4% { opacity: 0; transform: translate(0, 0); } 12.5%, 37.4% { opacity: 1; transform: translate(0, 0); }
        37.5%, 62.4% { opacity: 1; transform: translate(2px, -2px); } 62.5%, 87.4% { opacity: 1; transform: translate(4px, -2px); }
        87.5%, 100% { opacity: 0; transform: translate(4px, -2px); }
      }
      @keyframes bubbles-look { 0%, 100% { transform: translate(1px, 0); } }`,
  },
  // Reads a book held out to the right, now and then turning a page.
  {
    name: 'read',
    eyes: `<g class="read-eyes">${OPEN_EYES}</g>`,
    extra: `
      <g fill="${SHELL}">${px(18, 3, 4, 1)}</g>
      <g fill="${WING}">${px(18, 0, 4, 3)}</g>
      <g fill="${DOT}">${px(18, 1, 4, 1)}</g>
      <g fill="${WING}">
        <g class="read-p1">${px(21, -1, 1, 3)}</g>
        <g class="read-p2">${px(20, -1, 1, 3)}</g>
        <g class="read-p3">${px(19, -1, 1, 3)}</g>
      </g>`,
    css: `
      .read-eyes { transform: translate(1px, 0); }
      .read .eyes rect { animation: blink 3.5s steps(1) infinite; }
      .read-p1 { animation: read-p1 3s steps(1) infinite; }
      .read-p2 { animation: read-p2 3s steps(1) infinite; }
      .read-p3 { animation: read-p3 3s steps(1) infinite; }
      @keyframes read-p1 { 0%, 79.9% { opacity: 0; } 80%, 84.9% { opacity: 1; } 85%, 100% { opacity: 0; } }
      @keyframes read-p2 { 0%, 84.9% { opacity: 0; } 85%, 89.9% { opacity: 1; } 90%, 100% { opacity: 0; } }
      @keyframes read-p3 { 0%, 89.9% { opacity: 0; } 90%, 94.9% { opacity: 1; } 95%, 100% { opacity: 0; } }`,
  },
  // Dances: sways side to side, arms up by turns, notes twinkling above.
  {
    name: 'dance',
    extra: `
      <g class="dance-n1" fill="${SPARK}">${char(2, -3, '♪')}</g>
      <g class="dance-n2" fill="${LEAF}">${char(18, -2, '♫')}</g>`,
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
      @keyframes dance-step { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
      @keyframes dance-twinkle { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }`,
  },
  // Follows a ladybug that flies past high overhead: a red shell with black
  // spots, its black head forward.
  {
    name: 'ladybug',
    eyes: `<g class="ladybug-follow">${OPEN_EYES}</g>`,
    extra: `
      <g class="ladybug-flight">
        <g fill="${SHELL}">${px(0, -4, 5, 2)}</g>
        <g fill="${EYE}">${px(5, -4, 1, 2)}${px(1, -4)}${px(3, -4)}${px(2, -3)}</g>
      </g>`,
    css: `
      .ladybug .ladybug-follow { animation: ladybug-follow 4s steps(1) infinite; }
      .ladybug .ladybug-flight { animation: ladybug-fly 4s steps(1) infinite; }
      @keyframes ladybug-follow {
        0%, 24.9% { transform: translate(-1px, -1px); } 25%, 49.9% { transform: translate(0, -1px); }
        50%, 79.9% { transform: translate(1px, -1px); } 80%, 100% { transform: translate(0, 0); }
      }
      @keyframes ladybug-fly {
        0%, 9.9% { opacity: 0; transform: translate(0, 0); } 10%, 19.9% { opacity: 1; transform: translate(0, 0); }
        20%, 29.9% { transform: translate(4px, 0); } 30%, 39.9% { transform: translate(8px, 0); }
        40%, 49.9% { transform: translate(12px, 0); } 50%, 59.9% { transform: translate(16px, 0); }
        60%, 69.9% { transform: translate(20px, 0); } 70%, 79.9% { opacity: 1; transform: translate(24px, 0); }
        80%, 100% { opacity: 0; transform: translate(28px, 0); }
      }`,
  },
]

// Clawd at rest between pastimes: blinking now and then, glancing one way
// and the other.
export const REST: Pastime = {
  name: 'rest',
  eyes: `<g class="rest-look">${OPEN_EYES}</g>`,
  extra: '',
  css: `
    .rest .eyes rect { animation: rest-blink 5s steps(1) infinite; }
    .rest .rest-look { animation: rest-look 13s steps(1) infinite; }
    @keyframes rest-blink { 0%, 95.9% { opacity: 1; } 96%, 100% { opacity: 0; } }
    @keyframes rest-look {
      0%, 54.9% { transform: translate(0, 0); } 55%, 67.9% { transform: translate(1px, 0); }
      68%, 79.9% { transform: translate(0, 0); } 80%, 91.9% { transform: translate(-1px, 0); } 92%, 100% { transform: translate(0, 0); }
    }`,
}

// Clawd in a group of its own: its pose, its eyes and its props.
const pastimeBody = (p: Pastime, turn = '') =>
  `<g class="${turn} ${p.name}"><g class="clawd">${sprite(p.eyes ?? OPEN_EYES)}</g>${p.extra}</g>`

const pastimeNamed = (name: string) => PASTIMES.find(p => p.name === name) ?? REST

// The scene a pick names, in the small size.
export const smallScene = (pick: ScenePick): Scene => {
  if (pick.kind === 'round') {
    return {
      body: [pastimeBody(REST, `turn-${REST.name}`), ...PASTIMES.map(p => pastimeBody(p, `turn-${p.name}`))].join(''),
      extra: '',
      css: `${pick.turns}
    ${[REST, ...PASTIMES].map(p => p.css).join('')}
    ${BLINK}`,
    }
  }
  if (pick.kind === 'pastime') {
    const p = pastimeNamed(pick.key)
    return { body: pastimeBody(p), extra: '', css: `${p.css}${BLINK}` }
  }
  const table = pick.kind === 'tool' ? toolScenes : pick.kind === 'cache' ? cacheScenes : scenes
  return table[pick.key] ?? scenes.requesting ?? toolUse
}

// The small scene's image, the head at y 4 of the 10 rows of pixels.
export const smallSvg = (scene: Scene) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10" shape-rendering="crispEdges">
  <style>
    g { transform-box: view-box; }
    .props { animation: fadein 0.4s steps(2) 1 both; }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    ${scene.css}
  </style>
  <g transform="translate(0 4)">
    ${scene.body ?? `<g class="clawd">${sprite(scene.eyes ?? OPEN_EYES)}</g>`}
    <g class="props">${scene.extra}</g>
  </g>
</svg>`
