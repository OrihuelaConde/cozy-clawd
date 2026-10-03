// Renders the README's animated images from the mod's own drawing code: the
// band through a turn, the compact button at work, each of Clawd's scenes and
// each figure scene, as GIFs in docs/images/. Every SVG is drawn in a frame of
// its own and its CSS animations are paused and stepped, so a GIF holds the
// exact frames the band would show, ten a second.
//
// Needs Playwright with its Chromium, and ffmpeg on the PATH. Run from the
// repository root, after the preview (which writes .preview/scenes.gen.ts):
//
//   npm install --no-save playwright
//   node tools/preview.mjs
//   node tools/readme-images.mjs

import { mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isBare = specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)
    const isFromTs = context.parentURL !== undefined && new URL(context.parentURL).pathname.endsWith('.ts')
    return nextResolve(isBare && isFromTs ? `${specifier}.ts` : specifier, context)
  },
})

const root = process.cwd()
const { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, svgFor, SCALE, VIEW_W, VIEW_H } = await import(pathToFileURL(join(root, '.preview', 'scenes.gen.ts')).href)
const { FIGURE_SCENES, figureSceneNamed } = await import(pathToFileURL(join(root, 'hooks', 'scenes', 'index.ts')).href)

const outDir = join(root, 'docs', 'images')
const framesDir = join(root, '.preview', 'frames')
const FPS = 10
// Device pixels per CSS pixel: four, so every half-unit of Clawd's sprite
// lands on whole pixels, and the README can show the tiles at twice the band's
// size and still sharp on a high-density screen.
const DPR = 4

// The figure scene the README's band shows.
const BAND_SCENE = figureSceneNamed('balcony')

// A session in good shape, mid-way through the cache's hour.
const NORMAL = { contextLeft: 63, fiveHour: 42, week: 18, cacheLeft: 47 * 60 + 12, cacheTtl: 3600, isCompacting: false }
const LOW = { ...NORMAL, contextLeft: 18 }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// An SVG in a frame of its own, loaded as an SVG document (an SVG inlined in
// HTML lays out its nested viewports differently from an image).
const frame = (svg, width, height) => `<iframe width="${width}" height="${height}" data-svg="${esc(svg)}"></iframe>`

const clawdFrame = scene => frame(svgFor(scene), VIEW_W * SCALE, VIEW_H * 2 * SCALE)
const figuresFrame = (scene, f) => frame(scene.svg(f), scene.width * scene.scale, scene.height * scene.scale)

// The band as the desktop draws it: Clawd and what it is doing on the left,
// the compact button and the figure scene on the right.
const band = ({ clawd, label, figures, button = '' }) => `
  <div class="band">
    <div class="side">${clawdFrame(clawd)}<h3>${esc(label)}</h3></div>
    <div class="side">${button}${figuresFrame(BAND_SCENE, figures)}</div>
  </div>`

const compactButton = '<span class="button">Compact</span>'
const confirm = '<span class="ask">Compact?</span><span class="button primary">Yes</span><span class="button">No</span>'

const tile = inner => `<div class="tile">${inner}</div>`

const PAGE = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=block">
<style>
  html, body { margin: 0; background: #262624; }
  body { font-family: Inter, 'Liberation Sans', sans-serif; display: inline-block; }
  iframe { display: block; border: 0; background: transparent; }
  #stage { display: inline-block; }
  .band { width: 680px; box-sizing: border-box; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
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
  const out = join(outDir, `${name}.gif`)
  mkdirSync(join(out, '..'), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(framesDir, '%05d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop', '0', out,
  ])
  console.log(`Wrote ${out} (${n} frames)`)
}

// The band through a turn: thinking, three tools, the answer, then a pastime.
await gif('band', [
  { html: band({ clawd: scenes.thinking, label: 'Thinking…', figures: NORMAL }), seconds: 3.2 },
  { html: band({ clawd: toolScenes.look, label: 'Reading…', figures: NORMAL }), seconds: 2.4 },
  { html: band({ clawd: toolScenes.shell, label: 'Running a command…', figures: NORMAL }), seconds: 2.4 },
  { html: band({ clawd: toolScenes.write, label: 'Editing…', figures: NORMAL }), seconds: 2.4 },
  { html: band({ clawd: scenes.responding, label: 'Writing…', figures: NORMAL }), seconds: 2.4 },
  { html: band({ clawd: pastimeScene(PASTIMES.find(p => p.name === 'juggle')), label: 'Waiting', figures: NORMAL }), seconds: 3.6 },
])

// The compact button at work: low context, the confirmation, the compaction
// refilling the context figure (the button hides meanwhile), and Clawd's
// celebration.
await gif('compact', [
  { html: band({ clawd: pastimeScene(REST), label: 'Waiting', figures: LOW, button: compactButton }), seconds: 2.4 },
  { html: band({ clawd: pastimeScene(REST), label: 'Waiting', figures: LOW, button: confirm }), seconds: 1.6 },
  { html: band({ clawd: scenes.compacting, label: 'Compacting the conversation…', figures: { ...LOW, isCompacting: true } }), seconds: 3.6 },
  { html: band({ clawd: scenes.compacted, label: 'Conversation compacted!', figures: { ...NORMAL, contextLeft: 92 } }), seconds: 2.4 },
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

// Each figure scene with a session in good shape.
for (const scene of FIGURE_SCENES) {
  await gif(join('scenes', scene.name), [{ html: tile(figuresFrame(scene, NORMAL)), seconds: 4.8 }])
}

await browser.close()
rmSync(framesDir, { recursive: true, force: true })
