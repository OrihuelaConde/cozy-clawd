// What the tools share: the Node.js they need, the mod's modules imported as
// the engine resolves them, and Clawd's scenes cut out of the hooks module.
// Import it before anything else: it stops at once on a Node.js too old for
// the mod's `.ts` files.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Node.js runs the mod's `.ts` files as they are, and takes resolve hooks
// in this thread, from 22.18 on.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`The tools need Node.js 22.18 or later, to run the mod's .ts files directly. This is Node.js ${process.versions.node}.`)
  process.exit(1)
}

// The mod's modules import each other without an extension, as the engine
// resolves them; Node needs the `.ts` spelled out.
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isBare = specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)
    const isFromTs = context.parentURL !== undefined && new URL(context.parentURL).pathname.endsWith('.ts')
    return nextResolve(isBare && isFromTs ? `${specifier}.ts` : specifier, context)
  },
})

// The repository's root, where the tools run from, and the folder they write
// their pages to.
export const root = process.cwd()
export const outDir = join(root, '.preview')

// One of the mod's modules, by its path from the root, as it is now.
export const importMod = (...path) => import(`${pathToFileURL(join(root, ...path)).href}?t=${Date.now()}`)

// Clawd's scenes live in the hooks module, between the palette and the mode
// timing; that slice has no engine imports, so Node runs it as plain
// TypeScript, with the texts of every language from hooks/language.ts. It is
// cut out again on every run, so it's never older than the hooks module.
export const clawdScenes = async () => {
  const code = readFileSync(join(root, 'hooks', 'register.tsx'), 'utf8')
  const start = code.indexOf('const BODY')
  const end = code.indexOf('// Each mode stays on screen')
  if (start < 0 || end < start) {
    throw new Error("hooks/register.tsx no longer has Clawd's scenes between `const BODY` and `// Each mode stays on screen`.")
  }
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, 'scenes.gen.ts')
  const language = JSON.stringify(pathToFileURL(join(root, 'hooks', 'language.ts')).href)
  writeFileSync(
    file,
    `import { wordsOf } from ${language}\ntype ClawdMode = string\n${code.slice(start, end)}\n` +
      'export { scenes, toolScenes, cacheScenes, REST, PASTIMES, pastimeScene, waitingScene, waitingTurns, roundScene, waitTurns, svgFor, SCALE, VIEW_W, VIEW_H }\n',
  )
  return import(`${pathToFileURL(file).href}?t=${Date.now()}`)
}
