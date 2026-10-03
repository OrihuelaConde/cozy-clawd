// Renders every scene of Clawd and a few states of each meter scene as plain
// images, the way the desktop app draws a non-interactive Svg, on the app's
// dark background; beside each, the same scene as the terminal paints it in
// both sizes (hooks/raster.ts, run live in the page), each cell 9 by 18
// pixels as in a terminal. Writes .preview/index.html; serve that folder to
// look at it (tools/serve.mjs).
//
// Run from the repository root: node tools/preview.mjs

import { clawdScenes, importMod, outDir, root } from './load.mjs'

import { readFileSync, writeFileSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { join } from 'node:path'

const { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, waitingScene, waitingTurns, roundScene, waitTurns, svgFor, SCALE, VIEW_W, VIEW_H } = await clawdScenes()
const { METER_SCENES, metersAlt, numbersLine } = await importMod('hooks', 'scenes', 'index.ts')
const { smallScene, smallSvg } = await importMod('hooks', 'small.ts')

const uri = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// A scene in the terminal: a canvas the page paints with the band's own
// renderer, in half blocks or, for Clawd's small scenes, quadrants, and
// under a small meter scene its numbers as a line of text.
const rasterJs = nodeModule.stripTypeScriptTypes(readFileSync(join(root, 'hooks', 'raster.ts'), 'utf8'))
const terminal = (svg, layout = 'halves', numbers = '') =>
  `<canvas class="terminal" data-svg="${Buffer.from(svg).toString('base64')}" data-layout="${layout}" data-numbers="${esc(numbers)}"></canvas>`

// Each of Clawd's scenes, by the name the preview gives it, with what the
// small size draws for it.
const clawdRows = [
  ...Object.entries(scenes).map(([mode, scene]) => [mode, scene, { kind: 'mode', key: mode }]),
  ...Object.entries(toolScenes).map(([kind, scene]) => [`tool:${kind}`, scene, { kind: 'tool', key: kind }]),
  ...Object.entries(cacheScenes).map(([step, scene]) => [`cache:${step}`, scene, { kind: 'cache', key: step }]),
  ['rest', pastimeScene(REST), { kind: 'pastime', key: REST.name }],
  ...PASTIMES.map(p => [`pastime:${p.name}`, pastimeScene(p), { kind: 'pastime', key: p.name }]),
  ['rest, a pastime now and then', waitingScene(0), { kind: 'round', turns: waitingTurns(0) }],
  ['waiting on the person, a pastime after another', roundScene(waitTurns(0, 0)), { kind: 'round', turns: waitTurns(0, 0) }],
]
  .map(([name, scene, pick]) => `
  <div class="row">
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE}" height="${VIEW_H * 2 * SCALE}">
    <b>${scene.label.es} / ${scene.label.en}…</b><small>${name}</small>
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE * 3}" height="${VIEW_H * 2 * SCALE * 3}">
    ${terminal(smallSvg(smallScene(pick)), 'quadrants')}
    ${terminal(svgFor(scene))}
  </div>`)
  .join('')

const meterCases = [
  ['Normal', { contextLeft: 63, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600 }],
  ['Low, cache expired', { contextLeft: 20, fiveHour: 95, week: 80, cacheLeft: 0, cacheTtl: 3600 }],
  ['No readings yet', { contextLeft: null, fiveHour: null, week: null, cacheLeft: null, cacheTtl: 3600 }],
  ['Cache about to expire', { contextLeft: 100, fiveHour: 0, week: 0, cacheLeft: 125, cacheTtl: 3600 }],
  ['Five-minute cache, an API key', { contextLeft: 63, fiveHour: null, week: null, cacheLeft: 200, cacheTtl: 300 }],
  ['Compacting', { contextLeft: 20, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600, isCompacting: true }],
]
const meterSections = METER_SCENES.map(scene => {
  const w = scene.width * scene.scale
  const h = scene.height * scene.scale
  const rows = meterCases
    .map(([name, f]) => `
  <div class="row">
    <img src="${uri(scene.svg(f))}" width="${w}" height="${h}" title="${esc(metersAlt(f, 'en'))}">
    <small>${name}</small>
    <img src="${uri(scene.svg(f))}" width="${w * 2.5}" height="${h * 2.5}">
    ${scene.small === undefined ? '' : terminal(scene.small.svg(f), 'halves', numbersLine(f, scene.small.centers, 40, 0))}
    ${terminal(scene.svg(f))}
  </div>`)
    .join('')
  return `\n<h2>Meters: ${scene.label.en} (${scene.name})</h2>${rows}`
}).join('')

writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>cozy-clawd preview</title>
<style>
  body { background: #262624; color: #b0aea5; font: 14px system-ui; padding: 16px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 8px 0; padding: 8px; background: #1f1e1d; border-radius: 8px; }
  b { font-size: 17px; }
  img { image-rendering: pixelated; }
</style>
<p>Each scene at band size and enlarged as the desktop app draws it, then as a terminal paints it: the small size, then the large one.</p>
<h2>Scenes</h2>${clawdRows}
${meterSections}
<script type="module">
${rasterJs}
// Each canvas plays its scene as the terminal would, a frame every 66 ms,
// translucent pixels laid over the dark theme's background: a block
// character as its quarters in its two colors, anything else as the
// character over its background.
const CELL_W = 9
const CELL_H = 18
const BACKGROUND = 0x1f1e1d
const INK = 0xb0aea5
const OWN = 0x01000000
const QUARTERS = {
  0x20: 0, 0x2580: 0b1100, 0x2584: 0b0011, 0x2588: 0b1111, 0x258c: 0b1010, 0x2590: 0b0101,
  0x2596: 0b0010, 0x2597: 0b0001, 0x2598: 0b1000, 0x2599: 0b1011, 0x259a: 0b1001, 0x259b: 0b1110,
  0x259c: 0b1101, 0x259d: 0b0100, 0x259e: 0b0110, 0x259f: 0b0111,
}
const css = color => '#' + (color === OWN ? BACKGROUND : color).toString(16).padStart(6, '0')
const players = [...document.querySelectorAll('canvas.terminal')].map(canvas => {
  const svg = new TextDecoder().decode(Uint8Array.from(atob(canvas.dataset.svg), c => c.charCodeAt(0)))
  const picture = compile(svg, canvas.dataset.layout)
  const numbers = canvas.dataset.numbers
  canvas.width = picture.columns * CELL_W
  canvas.height = (picture.rows + (numbers ? 1 : 0)) * CELL_H
  return { ctx: canvas.getContext('2d'), picture, numbers }
})
const start = performance.now()
const paint = () => {
  const t = (performance.now() - start) / 1000
  for (const { ctx, picture, numbers } of players) {
    const bytes = Uint8Array.from(atob(picture.paint(t, BACKGROUND)), c => c.charCodeAt(0))
    const view = new DataView(bytes.buffer)
    ctx.font = '15px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < picture.columns * picture.rows; i++) {
      const [glyph, fg, bg] = [0, 4, 8].map(k => view.getUint32(i * 12 + k, true))
      const x = (i % picture.columns) * CELL_W
      const y = Math.floor(i / picture.columns) * CELL_H
      const mask = QUARTERS[glyph]
      if (mask === undefined) {
        ctx.fillStyle = css(bg)
        ctx.fillRect(x, y, CELL_W, CELL_H)
        ctx.fillStyle = css(fg)
        ctx.fillText(String.fromCodePoint(glyph), x + CELL_W / 2, y + CELL_H / 2 + 1)
        continue
      }
      // Whole pixels each, so no seam shows between the quarters.
      const half = Math.round(CELL_W / 2)
      for (const [dx, dy, bit] of [[0, 0, 0b1000], [1, 0, 0b0100], [0, 1, 0b0010], [1, 1, 0b0001]]) {
        ctx.fillStyle = css(mask & bit ? fg : bg)
        ctx.fillRect(x + dx * half, y + (dy * CELL_H) / 2, dx === 0 ? half : CELL_W - half, CELL_H / 2)
      }
    }
    if (numbers) {
      ctx.fillStyle = css(BACKGROUND)
      ctx.fillRect(0, picture.rows * CELL_H, picture.columns * CELL_W, CELL_H)
      ctx.fillStyle = css(INK)
      ;[...numbers].forEach((char, i) => ctx.fillText(char, i * CELL_W + CELL_W / 2, picture.rows * CELL_H + CELL_H / 2 + 1))
    }
  }
}
paint()
setInterval(paint, 66)
</script>`)

console.log(`Wrote ${join(outDir, 'index.html')}`)
