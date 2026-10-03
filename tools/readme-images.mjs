// Renders the documentation's animated images from the mod's own drawing
// code: the band through a turn, the compact button at work, the band as a
// terminal paints it in both sizes, each of Clawd's scenes and each meter
// scene, as GIFs in docs/images/. Every SVG is drawn in a frame of its own and
// its CSS animations are paused and stepped, so a GIF holds the exact frames
// the band would show, ten a second. The terminal's band is painted with the
// band's own renderer (hooks/raster.ts), a cell 9 by 18 pixels.
//
// Needs Playwright 1.56.1 with its Chromium, and ffmpeg on the PATH. The
// labels and buttons are set in the machine's own sans-serif and monospace
// fonts. Run from the repository root:
//
//   npm install --no-save playwright@1.56.1
//   npx playwright install chromium
//   node tools/readme-images.mjs

import { clawdScenes, importMod, root } from './load.mjs'

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// What the script needs besides Node.js, checked before it renders anything.
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('The script needs ffmpeg on the PATH, to encode the GIFs: https://ffmpeg.org/download.html')
  process.exit(1)
}
const { chromium } = await import('playwright').catch(() => {
  console.error('The script needs Playwright: run `npm install --no-save playwright@1.56.1` and `npx playwright install chromium`.')
  process.exit(1)
})

const { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, svgFor, SCALE, VIEW_W, VIEW_H } = await clawdScenes()
const { METER_SCENES, meterSceneNamed, numbersLine } = await importMod('hooks', 'scenes', 'index.ts')
const { INK } = await importMod('hooks', 'scenes', 'pixels.ts')
const { compile, columnsOf } = await importMod('hooks', 'raster.ts')
const { smallScene, smallSvg } = await importMod('hooks', 'small.ts')

const outDir = join(root, 'docs', 'images')
const framesDir = join(root, '.preview', 'frames')
const FPS = 10
// Device pixels per CSS pixel: four, so every half-unit of Clawd's sprite
// lands on whole pixels, and the README can show the tiles at twice the band's
// size and still sharp on a high-density screen.
const DPR = 4

// The meter scene the README's band shows.
const BAND_SCENE = meterSceneNamed('balcony')

// A session in good shape, mid-way through the cache's hour.
const NORMAL = { contextLeft: 63, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600, isCompacting: false }
const LOW = { ...NORMAL, contextLeft: 18 }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// An SVG in a frame of its own, loaded as an SVG document (an SVG inlined in
// HTML lays out its nested viewports differently from an image).
const frame = (svg, width, height) => `<iframe width="${width}" height="${height}" data-svg="${esc(svg)}"></iframe>`

const clawdFrame = scene => frame(svgFor(scene), VIEW_W * SCALE, VIEW_H * 2 * SCALE)
const metersFrame = (scene, f) => frame(scene.svg(f), scene.width * scene.scale, scene.height * scene.scale)

// The band as the desktop draws it: Clawd and what it is doing on the left,
// the compact button and the meter scene on the right.
const band = ({ clawd, label, meters, button = '', width }) => `
  <div class="band" style="width: ${width}px">
    <div class="side">${clawdFrame(clawd)}<h3>${esc(label)}</h3></div>
    <div class="side">${button}${metersFrame(BAND_SCENE, meters)}</div>
  </div>`

const compactButton = '<span class="button">Compact</span>'
const confirm = '<span class="ask">Compact?</span><span class="button primary">Yes</span><span class="button">No</span>'

const tile = inner => `<div class="tile">${inner}</div>`

const PAGE = `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; background: #262624; }
  body { font-family: Inter, system-ui, 'Segoe UI', 'Liberation Sans', sans-serif; display: inline-block; }
  iframe { display: block; border: 0; background: transparent; }
  #stage { display: inline-block; }
  .band { box-sizing: border-box; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .side { display: flex; align-items: center; gap: 8px; }
  h3 { margin: 0; font-size: 16px; font-weight: 600; color: #9c9a92; }
  .ask { font-size: 13px; color: #9c9a92; }
  .button { font-size: 13px; font-weight: 500; color: #e8e6dc; background: #30302e; border: 1px solid #4a4945; border-radius: 6px; padding: 3px 10px; }
  .button.primary { color: #262624; background: #e8e6dc; border-color: #e8e6dc; }
  .tile { padding: 8px 12px; }
</style>
<div id="stage"></div>`

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: DPR })
await page.setContent(PAGE)
await page.evaluate(() => document.fonts.ready)

// Renders segments one after another into one GIF: each segment is a stage's
// HTML and how long it shows, its animations starting over as the band's do
// when it redraws.
async function gif(name, segments) {
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })
  let n = 0
  for (const { html, seconds } of segments) {
    await page.evaluate(async html => {
      const stage = document.getElementById('stage')
      stage.innerHTML = html
      await Promise.all([...stage.querySelectorAll('iframe')].map(f => {
        const isLoaded = new Promise(ok => f.addEventListener('load', ok, { once: true }))
        f.src = URL.createObjectURL(new Blob([f.dataset.svg], { type: 'image/svg+xml' }))
        return isLoaded
      }))
      await document.fonts.ready
    }, html)
    const stage = page.locator('#stage')
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
      await page.evaluate(ms => {
        for (const f of document.querySelectorAll('iframe')) {
          for (const a of f.contentDocument.getAnimations()) {
            a.pause()
            a.currentTime = ms
          }
        }
        return new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)))
      }, (i * 1000) / FPS)
      await stage.screenshot({ path: join(framesDir, `${String(n++).padStart(5, '0')}.png`) })
    }
  }
  encode(name, n)
}

// Encodes the frames in framesDir as docs/images/<name>.gif.
function encode(name, n) {
  const out = join(outDir, `${name}.gif`)
  mkdirSync(join(out, '..'), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(framesDir, '%05d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop', '0', out,
  ])
  console.log(`Wrote ${out} (${n} frames)`)
}

// The band as a terminal paints it, in its two sizes, one above the other:
// Clawd and the meters as Rasters of block characters, the step in bold
// beside Clawd, and, in the small size, the meters' numbers as a line of text
// under their drawing. Each band is as wide as a terminal of
// TERMINAL_COLUMNS, laid out as the band lays itself out (register.tsx).
const TERMINAL_COLUMNS = 110
const CELL_W = 9
const CELL_H = 18
const TERMINAL_BG = 0x1f1e1d
const TERMINAL_FG = 0xe8e6dc
const OWN_COLOR = 0x01000000

// A Raster's cells, as `[glyph, fg, bg]` a cell.
const cellsOf = base64 => {
  const bytes = Buffer.from(base64, 'base64')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: view.byteLength / 12 }, (_, i) => [0, 4, 8].map(k => view.getUint32(i * 12 + k, true)))
}

// One size of the band at one moment, as rows of cells: `clawd` and `meters`
// are pictures, `t` and `elapsed` the seconds since Clawd's scene and the
// meters were drawn.
function terminalRows({ clawd, meters, numbers, label, t, elapsed }) {
  const numberRows = numbers === undefined ? 0 : 1
  const height = Math.max(clawd.rows, meters.rows + numberRows)
  const rows = Array.from({ length: height }, () => Array.from({ length: TERMINAL_COLUMNS }, () => [0x20, OWN_COLOR, OWN_COLOR]))
  const put = (cells, columns, top, left, isBold = false) => {
    cells.forEach((cell, i) => {
      rows[top + Math.floor(i / columns)][left + (i % columns)] = isBold ? [...cell, 1] : cell
    })
  }
  put(cellsOf(clawd.paint(t, TERMINAL_BG)), clawd.columns, Math.floor((height - clawd.rows) / 2), 0)
  const room = TERMINAL_COLUMNS - clawd.columns - 1 - 2 - meters.columns
  const words = label.split(' ')
  const lines = [words.shift()]
  for (const word of words) {
    columnsOf(`${lines.at(-1)} ${word}`) <= room ? (lines[lines.length - 1] += ` ${word}`) : lines.push(word)
  }
  lines.forEach((line, k) => {
    const cells = [...line].map(char => [char.codePointAt(0), OWN_COLOR, OWN_COLOR])
    put(cells, cells.length, Math.floor((height - lines.length) / 2) + k, clawd.columns + 1, true)
  })
  const metersTop = Math.floor((height - meters.rows - numberRows) / 2)
  const metersLeft = TERMINAL_COLUMNS - meters.columns
  put(cellsOf(meters.paint(elapsed, TERMINAL_BG)), meters.columns, metersTop, metersLeft)
  if (numbers !== undefined) {
    const ink = parseInt(INK.slice(1), 16)
    const line = numbersLine(NORMAL, numbers, meters.columns, elapsed)
    put([...line].map(char => [char.codePointAt(0), ink, OWN_COLOR]), meters.columns, metersTop + meters.rows, metersLeft)
  }
  return rows
}

const terminalPage = await browser.newPage({ deviceScaleFactor: 2 })
await terminalPage.setContent(`<!doctype html><meta charset="utf-8">
<style>html, body { margin: 0; background: #1f1e1d; } canvas { display: block; }</style>
<canvas id="terminal"></canvas>`)

// Paints rows of cells on the page's canvas, a cell CELL_W by CELL_H: a block
// character as its quarters in its two colors, anything else as the
// character over its background.
const paintTerminal = ({ rows, cellW, cellH, background, foreground, own }) => {
  const QUARTERS = {
    0x20: 0, 0x2580: 0b1100, 0x2584: 0b0011, 0x2588: 0b1111, 0x258c: 0b1010, 0x2590: 0b0101,
    0x2596: 0b0010, 0x2597: 0b0001, 0x2598: 0b1000, 0x2599: 0b1011, 0x259a: 0b1001, 0x259b: 0b1110,
    0x259c: 0b1101, 0x259d: 0b0100, 0x259e: 0b0110, 0x259f: 0b0111,
  }
  const css = c => '#' + c.toString(16).padStart(6, '0')
  const canvas = document.getElementById('terminal')
  canvas.width = rows[0].length * cellW * devicePixelRatio
  canvas.height = rows.length * cellH * devicePixelRatio
  canvas.style.width = `${rows[0].length * cellW}px`
  canvas.style.height = `${rows.length * cellH}px`
  const ctx = canvas.getContext('2d')
  ctx.scale(devicePixelRatio, devicePixelRatio)
  ctx.fillStyle = css(background)
  ctx.fillRect(0, 0, rows[0].length * cellW, rows.length * cellH)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  rows.forEach((row, y) => {
    row.forEach(([glyph, fg, bg, isBold], x) => {
      const front = css(fg === own ? foreground : fg)
      const back = css(bg === own ? background : bg)
      const mask = QUARTERS[glyph]
      if (mask === undefined) {
        ctx.fillStyle = back
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
        ctx.fillStyle = front
        ctx.font = `${isBold ? 'bold ' : ''}15px "JetBrains Mono", Consolas, Menlo, "DejaVu Sans Mono", monospace`
        ctx.fillText(String.fromCodePoint(glyph), x * cellW + cellW / 2, y * cellH + cellH / 2 + 1)
        return
      }
      ;[[0, 0, 0b1000], [1, 0, 0b0100], [0, 1, 0b0010], [1, 1, 0b0001]].forEach(([dx, dy, bit]) => {
        ctx.fillStyle = mask & bit ? front : back
        ctx.fillRect(x * cellW + (dx * cellW) / 2, y * cellH + (dy * cellH) / 2, cellW / 2, cellH / 2)
      })
    })
  })
}

// Renders steps of both sizes into one GIF, the small band above the large
// one, with a column of margin around them: each step is Clawd's scene in
// each size, what the band says, and how long it shows. Clawd's scene starts
// over at each step, as a new picture does; the meters keep running.
async function terminalGif(name, steps) {
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })
  const small = BAND_SCENE.small
  const smallMeters = compile(small.svg(NORMAL))
  const largeMeters = compile(BAND_SCENE.svg(NORMAL))
  const blank = () => Array.from({ length: TERMINAL_COLUMNS }, () => [0x20, OWN_COLOR, OWN_COLOR])
  let n = 0
  for (const step of steps) {
    const smallClawd = compile(smallSvg(smallScene(step.pick)), 'quadrants')
    const largeClawd = compile(svgFor(step.scene))
    for (let i = 0; i < Math.round(step.seconds * FPS); i++) {
      const t = i / FPS
      const elapsed = n / FPS
      const rows = [
        blank(),
        ...terminalRows({ clawd: smallClawd, meters: smallMeters, numbers: small.centers, label: step.label, t, elapsed }),
        blank(),
        blank(),
        ...terminalRows({ clawd: largeClawd, meters: largeMeters, label: step.label, t, elapsed }),
        blank(),
      ].map(row => [[0x20, OWN_COLOR, OWN_COLOR], ...row, [0x20, OWN_COLOR, OWN_COLOR]])
      await terminalPage.evaluate(paintTerminal, { rows, cellW: CELL_W, cellH: CELL_H, background: TERMINAL_BG, foreground: TERMINAL_FG, own: OWN_COLOR })
      await terminalPage.locator('#terminal').screenshot({ path: join(framesDir, `${String(n++).padStart(5, '0')}.png`) })
    }
  }
  encode(name, n)
}

// The band through a turn: thinking, three tools, the answer, then a pastime.
const TURN = [
  { scene: scenes.thinking, pick: { kind: 'mode', key: 'thinking' }, label: 'Thinking…', seconds: 3.2 },
  { scene: toolScenes.look, pick: { kind: 'tool', key: 'look' }, label: 'Reading a file…', seconds: 2.4 },
  { scene: toolScenes.shell, pick: { kind: 'tool', key: 'shell' }, label: 'Running a command…', seconds: 2.4 },
  { scene: toolScenes.write, pick: { kind: 'tool', key: 'write' }, label: 'Editing a file…', seconds: 2.4 },
  { scene: scenes.responding, pick: { kind: 'mode', key: 'responding' }, label: 'Writing…', seconds: 2.4 },
  { scene: pastimeScene(PASTIMES.find(p => p.name === 'juggle')), pick: { kind: 'pastime', key: 'juggle' }, label: 'Waiting', seconds: 3.6 },
]
await gif('band', TURN.map(({ scene, label, seconds }) => ({ html: band({ clawd: scene, label, meters: NORMAL, width: 520 }), seconds })))

// The same turn in a terminal, in both sizes.
await terminalGif('terminal', TURN)

// The compact button at work: low context, the confirmation, the compaction
// refilling the context meter (the button hides meanwhile), and Clawd's
// celebration.
await gif('compact', [
  { html: band({ clawd: pastimeScene(REST), label: 'Waiting', meters: LOW, button: compactButton, width: 580 }), seconds: 2.4 },
  { html: band({ clawd: pastimeScene(REST), label: 'Waiting', meters: LOW, button: confirm, width: 580 }), seconds: 1.6 },
  { html: band({ clawd: scenes.compacting, label: 'Compacting the conversation…', meters: { ...LOW, isCompacting: true }, width: 580 }), seconds: 3.6 },
  { html: band({ clawd: scenes.compacted, label: 'Conversation compacted!', meters: { ...NORMAL, contextLeft: 92 }, width: 580 }), seconds: 2.4 },
])

// Clawd alone, one GIF per scene of the README's table.
const clawdGifs = [
  ['waiting', [pastimeScene(REST), ...PASTIMES.map(pastimeScene)].map(scene => ({ scene, seconds: 3.6 }))],
  ['worried', [{ scene: cacheScenes.worry, seconds: 4.8 }]],
  ['yawning', [{ scene: cacheScenes.yawn, seconds: 4.8 }]],
  ['sleeping', [{ scene: scenes.idle, seconds: 4.8 }]],
  ['requesting', [{ scene: scenes.requesting, seconds: 4.8 }]],
  ['thinking', [{ scene: scenes.thinking, seconds: 4.8 }]],
  ['responding', [{ scene: scenes.responding, seconds: 4.8 }]],
  ...Object.entries(toolScenes).map(([kind, scene]) => [`tool-${kind}`, [{ scene, seconds: 4.8 }]]),
  ['compacting', [{ scene: scenes.compacting, seconds: 4.8 }]],
  ['compacted', [{ scene: scenes.compacted, seconds: 4.8 }]],
]
for (const [name, steps] of clawdGifs) {
  await gif(join('clawd', name), steps.map(({ scene, seconds }) => ({ html: tile(clawdFrame(scene)), seconds })))
}

// Each meter scene with a session in good shape.
for (const scene of METER_SCENES) {
  await gif(join('scenes', scene.name), [{ html: tile(metersFrame(scene, NORMAL)), seconds: 4.8 }])
}

await browser.close()
rmSync(framesDir, { recursive: true, force: true })
