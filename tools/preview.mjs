// Renders every scene of the mod and a few states of the shelf as plain
// images, the way the desktop app draws a non-interactive Svg, on the app's
// dark background. Writes .preview/index.html; serve that folder to look at it.
//
// Run from the repository root: node tools/preview.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const outDir = join(root, '.preview')
mkdirSync(outDir, { recursive: true })

// The scenes live in the hooks module, between the palette and the mode
// timing; that slice has no engine imports, so Node runs it as plain TypeScript.
const code = readFileSync(join(root, 'hooks', 'register.tsx'), 'utf8')
const body = code.slice(code.indexOf('const BODY'), code.indexOf('// Each mode stays on screen'))
const scenesFile = join(outDir, 'scenes.gen.ts')
writeFileSync(scenesFile, `type ClawdMode = string\n${body}\nexport { scenes, toolScenes, svgFor, SCALE, VIEW_W, VIEW_H }\n`)
const { scenes, toolScenes, svgFor, SCALE, VIEW_W, VIEW_H } = await import(pathToFileURL(scenesFile).href + '?t=' + Date.now())
const { shelfSvg, shelfAlt, SHELF_W, SHELF_H, SHELF_SCALE } = await import(pathToFileURL(join(root, 'hooks', 'shelf.ts')).href + '?t=' + Date.now())

const uri = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')

const sceneRows = [...Object.entries(scenes), ...Object.entries(toolScenes).map(([kind, scene]) => [`tool:${kind}`, scene])]
  .map(([name, scene]) => `
  <div class="row">
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE}" height="${VIEW_H * 2 * SCALE}">
    <b>${scene.label}…</b><small>${name}</small>
    <img src="${uri(svgFor(scene))}" width="${VIEW_W * SCALE * 3}" height="${VIEW_H * 2 * SCALE * 3}">
  </div>`)
  .join('')

const shelfCases = [
  ['Normal', { contextLeft: 63, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600 }],
  ['Low, cache expired', { contextLeft: 20, fiveHour: 95, week: 80, cacheLeft: 0, cacheTtl: 3600 }],
  ['No readings yet', { contextLeft: null, fiveHour: null, week: null, cacheLeft: null, cacheTtl: 3600 }],
  ['Cache about to expire', { contextLeft: 100, fiveHour: 0, week: 0, cacheLeft: 125, cacheTtl: 3600 }],
]
const shelfRows = shelfCases
  .map(([name, f]) => `
  <div class="row">
    <img src="${uri(shelfSvg(f))}" width="${SHELF_W * SHELF_SCALE}" height="${SHELF_H * SHELF_SCALE}" title="${shelfAlt(f)}">
    <small>${name}</small>
    <img src="${uri(shelfSvg(f))}" width="${SHELF_W * SHELF_SCALE * 2.5}" height="${SHELF_H * SHELF_SCALE * 2.5}">
  </div>`)
  .join('')

writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>cozy-clawd preview</title>
<style>
  body { background: #262624; color: #b0aea5; font: 14px system-ui; padding: 16px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .row { display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 8px; background: #1f1e1d; border-radius: 8px; }
  b { font-size: 17px; }
  img { image-rendering: pixelated; }
</style>
<h2>Scenes</h2>${sceneRows}
<h2>Shelf</h2>${shelfRows}`)

console.log(`Wrote ${join(outDir, 'index.html')}`)
