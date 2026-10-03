// Renders every scene of Clawd and a few states of each meter scene as plain
// images, the way the desktop app draws a non-interactive Svg, on the app's
// dark background; beside each, the same scene as the terminal paints it in
// block characters (hooks/raster.ts, run live in the page), each cell 9 by 18
// pixels as in a terminal. Writes .preview/index.html; serve that folder to
// look at it.
//
// Run from the repository root: node tools/preview.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// The hooks modules import each other without an extension, as the engine
// resolves them; Node needs the `.ts` spelled out.
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isBare = specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)
    const isFromTs = context.parentURL !== undefined && new URL(context.parentURL).pathname.endsWith('.ts')
    return nextResolve(isBare && isFromTs ? `${specifier}.ts` : specifier, context)
  },
})

const root = process.cwd()
const outDir = join(root, '.preview')
mkdirSync(outDir, { recursive: true })

// The scenes live in the hooks module, between the palette and the mode
// timing; that slice has no engine imports, so Node runs it as plain
// TypeScript, with the texts of every language from hooks/language.ts.
const code = readFileSync(join(root, 'hooks', 'register.tsx'), 'utf8')
const body = code.slice(code.indexOf('const BODY'), code.indexOf('// Each mode stays on screen'))
const scenesFile = join(outDir, 'scenes.gen.ts')
const languageUrl = pathToFileURL(join(root, 'hooks', 'language.ts')).href
writeFileSync(scenesFile, `import { wordsOf } from '${languageUrl}'\ntype ClawdMode = string\n${body}\nexport { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, waitingScene, roundScene, waitTurns, svgFor, SCALE, VIEW_W, VIEW_H }\n`)
const { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, waitingScene, roundScene, waitTurns, svgFor, SCALE, VIEW_W, VIEW_H } = await import(pathToFileURL(scenesFile).href + '?t=' + Date.now())
const { METER_SCENES, metersAlt } = await import(pathToFileURL(join(root, 'hooks', 'scenes', 'index.ts')).href + '?t=' + Date.now())

const uri = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')

// The scene in the terminal: a canvas the page paints with the band's own
// renderer, where this Node can turn it into JavaScript (22.13 or later).
const rasterJs = nodeModule.stripTypeScriptTypes?.(readFileSync(join(root, 'hooks', 'raster.ts'), 'utf8')) ?? ''
const terminal = svg => (rasterJs === '' ? '' : `<canvas class="terminal" data-svg="${Buffer.from(svg).toString('base64')}"></canvas>`)

const sceneRows = [
  ...Object.entries(scenes),
  ...Object.entries(toolScenes).map(([kind, scene]) => [`tool:${kind}`, scene]),
  ...Object.entries(cacheScenes).map(([step, scene]) => [`cache:${step}`, scene]),
  ['rest', pastimeScene(REST)],
  ...PASTIMES.map(p => [`pastime:${p.name}`, pastimeScene(p)]),
  ['rest, a pastime now and then', waitingScene(0)],
  ['waiting on the person, a pastime after another', roundScene(waitTurns(0, 0))],
]
  .map(([name, scene]) => `
  <div class="row">
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE}" height="${VIEW_H * 2 * SCALE}">
    <b>${scene.label.es} / ${scene.label.en}…</b><small>${name}</small>
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE * 3}" height="${VIEW_H * 2 * SCALE * 3}">
    ${terminal(svgFor(scene))}
  </div>`)
  .join('')

const shelfCases = [
  ['Normal', { contextLeft: 63, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600 }],
  ['Low, cache expired', { contextLeft: 20, fiveHour: 95, week: 80, cacheLeft: 0, cacheTtl: 3600 }],
  ['No readings yet', { contextLeft: null, fiveHour: null, week: null, cacheLeft: null, cacheTtl: 3600 }],
  ['Cache about to expire', { contextLeft: 100, fiveHour: 0, week: 0, cacheLeft: 125, cacheTtl: 3600 }],
  ['Compacting', { contextLeft: 20, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600, isCompacting: true }],
]
const meterSections = METER_SCENES.map(scene => {
  const w = scene.width * scene.scale
  const h = scene.height * scene.scale
  const rows = shelfCases
    .map(([name, f]) => `
  <div class="row">
    <img src="${uri(scene.svg(f))}" width="${w}" height="${h}" title="${metersAlt(f, 'en')}">
    <small>${name}</small>
    <img src="${uri(scene.svg(f))}" width="${w * 2.5}" height="${h * 2.5}">
    ${terminal(scene.svg(f))}
  </div>`)
    .join('')
  return `\n<h2>Meters: ${scene.label.en} (${scene.name})</h2>${rows}`
}).join('')

writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>cozy-clawd preview</title>
<style>
  body { background: #262624; color: #b0aea5; font: 14px system-ui; padding: 16px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .row { display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 8px; background: #1f1e1d; border-radius: 8px; }
  b { font-size: 17px; }
  img { image-rendering: pixelated; }
  .row { flex-wrap: wrap; }
</style>
<h2>Scenes</h2>${sceneRows}
${meterSections}
<script type="module">
${rasterJs}
// Each canvas plays its scene as the terminal would: a frame every 66 ms,
// translucent pixels laid over the dark theme's background.
const CELL_W = 9
const CELL_H = 18
const BACKGROUND = 0x1f1e1d
const css = color => '#' + color.toString(16).padStart(6, '0')
const players = [...document.querySelectorAll('canvas.terminal')].map(canvas => {
  const svg = new TextDecoder().decode(Uint8Array.from(atob(canvas.dataset.svg), c => c.charCodeAt(0)))
  const picture = compile(svg)
  canvas.width = picture.columns * CELL_W
  canvas.height = picture.rows * CELL_H
  return { ctx: canvas.getContext('2d'), picture }
})
const start = performance.now()
const paint = () => {
  const t = (performance.now() - start) / 1000
  for (const { ctx, picture } of players) {
    const bytes = Uint8Array.from(atob(picture.paint(t, BACKGROUND)), c => c.charCodeAt(0))
    const view = new DataView(bytes.buffer)
    for (let i = 0; i < picture.columns * picture.rows; i++) {
      const [glyph, fg, bg] = [0, 4, 8].map(k => view.getUint32(i * 12 + k, true))
      const own = c => (c === 0x01000000 ? BACKGROUND : c)
      const top = glyph === 0x20 ? BACKGROUND : glyph === 0x2584 ? own(bg) : own(fg)
      const bottom = glyph === 0x20 ? BACKGROUND : glyph === 0x2580 ? own(bg) : own(fg)
      const x = (i % picture.columns) * CELL_W
      const y = Math.floor(i / picture.columns) * CELL_H
      ctx.fillStyle = css(top)
      ctx.fillRect(x, y, CELL_W, CELL_H / 2)
      ctx.fillStyle = css(bottom)
      ctx.fillRect(x, y + CELL_H / 2, CELL_W, CELL_H / 2)
    }
  }
}
paint()
setInterval(paint, 66)
</script>`)

console.log(`Wrote ${join(outDir, 'index.html')}`)
