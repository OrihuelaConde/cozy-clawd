import { expect, mock, test, type TestBody } from 'claude-code/testing'

import { columnsOf, compile } from './raster'
import { METER_SCENES } from './scenes/index'

// What a site's props carry beside its own: where it scrolls, and whose conversation it shows.
const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }

const BAND = { ...SITE, hasSurvey: false, maxRows: 10, bodyColumns: 120 }

const PANEL_PROPS = { ...SITE, title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const

// The locale of someone who reads Spanish, and of someone who reads English.
const SPANISH = { LANG: 'es_AR.UTF-8' }
const ENGLISH = { LANG: 'en_US.UTF-8' }

test('the panel shows every scene on the desktop, the one in use marked', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await panel.findAll({ type: 'Svg' })).toHaveLength(8)
  expect(await panel.find({ type: 'Text', text: 'en uso' })).toBeDefined()
  expect(await panel.find({ key: 'use-balcony' })).toBeUndefined()
  for (const name of ['mate', 'teatime', 'window', 'adventure', 'gamer', 'cyberpunk', 'steampunk']) {
    expect(await panel.find({ key: `use-${name}` })).toBeDefined()
  }
  await panel.unmount()
})

test('the panel on the terminal says what Clawd does and offers pickers', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await panel.find({ type: 'Text', text: 'Esperando' })).toBeDefined()
  expect((await panel.find({ key: 'scene' }))?.type).toBe('Select')
  expect((await panel.find({ key: 'language' }))?.type).toBe('Select')
  await panel.unmount()
})

test('the band shows Clawd on the desktop whether or not a turn runs', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })

  const busy = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await busy.find({ type: 'Svg' })).toBeDefined()
  await busy.unmount()

  const idle = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await idle.find({ type: 'Svg' })).toBeDefined()
  // With plenty of context free (here, no reading at all) there is no compact button.
  expect(await idle.find({ key: 'compact' })).toBeUndefined()
  await idle.unmount()
})

test('the band paints Clawd and the scene in the terminal, and moves them by the clock', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  on('turn.step', answering)
  // The terminal beneath the plugins, taking every frame the band sends.
  const blits: { key: string; cells: string }[] = []
  on('ui.blit', ($, e) => {
    if ('cells' in e) {
      blits.push({ key: e.key, cells: e.cells })
    }
    return { value: {} }
  })
  // A model request of the turn: Clawd works on the answer until the turn completes.
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: true } })
  const clawd = await band.find({ type: 'Raster', key: 'clawd' })
  const meters = await band.find({ type: 'Raster', key: 'meters' })
  const numbers = await band.find({ type: 'Raster', key: 'numbers' })
  // The small size: Clawd in quadrants, the meters in half blocks, its numbers as text under it.
  expect([clawd?.props.columns, clawd?.props.rows]).toEqual([15, 5])
  expect([meters?.props.columns, meters?.props.rows]).toEqual([40, 4])
  expect([numbers?.props.columns, numbers?.props.rows]).toEqual([40, 1])
  expect(textOf(String(numbers?.props.cells)).split(/ +/).filter(Boolean)).toEqual(['70%', '60m', '80%', '60%'])
  expect(await band.find({ type: 'Text', text: 'Trabajando en la respuesta…' })).toBeDefined()

  // Clawd stacks its blocks: a second on, its picture is not the one first drawn.
  await clock.advance(1_000)
  const moved = blits.filter(b => b.key === 'clawd')
  expect(moved.length).toBeGreaterThan(0)
  expect(moved[moved.length - 1]?.cells).not.toBe(clawd?.props.cells)
  await band.unmount()
})

test('collapsed and opened again, the terminal band moves on', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  on('turn.step', answering)
  // The terminal beneath the plugins: while the band is collapsed it takes no frame.
  let isCollapsed = false
  const taken: string[] = []
  on('ui.blit', ($, e) => {
    if (isCollapsed) {
      return { deny: 'not mounted' }
    }
    taken.push(e.key)
    return { value: {} }
  })
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: true } })
  await clock.advance(1_000)
  expect(taken).toContain('clawd')
  isCollapsed = true
  await clock.advance(10_000)
  // Opened again, the band shows the tree it kept; its pictures move on from there.
  isCollapsed = false
  taken.length = 0
  await clock.advance(2_000)
  expect(taken).toContain('clawd')
  await band.unmount()
})

// The decision the engine records for the operator's collector once a tool
// call is settled.
const decided = (source: string) => ({
  to: 'collector' as const,
  event: 'tool_decision',
  attributes: { decision: 'accept', source, tool_name: 'Bash', tool_use_id: 'toolu_1' },
  loggedAt: new Date(1_000_000).toISOString(),
})

test('asked to allow a tool, Clawd waits until the person allows it, and then the tool runs', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('classic.PermissionRequest', () => ({}))
  on('telemetry.log', () => ({ value: undefined }))
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} } as never)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando tu aprobación')
  await clock.advance(5_000)
  // A rule's decision, for another call, leaves the person's ask open.
  await $.telemetry.log(decided('config'))
  expect(await clawdOf(band)).toBe('Clawd: Esperando tu aprobación')
  await $.telemetry.log(decided('user_temporary'))
  expect(await clawdOf(band)).toBe('Clawd: Ejecutando un comando')
  await band.unmount()
})

test('allowed before the wait reaches the band, the tool runs without it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('classic.PermissionRequest', () => ({}))
  on('classic.Elicitation', () => ({}))
  on('telemetry.log', () => ({ value: undefined }))
  // A form shows first, so the ask waits its turn to show.
  await $.classic.Elicitation({ mcp_server_name: 'test', message: 'Fill in' } as never)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} } as never)
  await $.telemetry.log(decided('user_permanent'))
  await clock.advance(5_000)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await clawdOf(band)).toBe('Clawd: Ejecutando un comando')
  await band.unmount()
})

test('the large size draws in the terminal the scenes the desktop shows', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on, { size: 'large' })
  mock.env(on, SPANISH)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: false } })
  const clawd = await band.find({ type: 'Raster', key: 'clawd' })
  const meters = await band.find({ type: 'Raster', key: 'meters' })
  expect([clawd?.props.columns, clawd?.props.rows]).toEqual([25, 8])
  expect([meters?.props.columns, meters?.props.rows]).toEqual([64, 9])
  expect(await band.find({ type: 'Raster', key: 'numbers' })).toBeUndefined()
  await band.unmount()
})

test('every scene has a small drawing, its numbers under it', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  for (const name of ['balcony', 'mate', 'teatime', 'window', 'adventure', 'gamer', 'cyberpunk', 'steampunk']) {
    const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
    await panel.select({ key: 'scene', value: name })
    await panel.unmount()
    const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: false } })
    const meters = await band.find({ type: 'Raster', key: 'meters' })
    expect([name, meters?.props.columns, meters?.props.rows]).toEqual([name, 40, 4])
    expect(await band.find({ type: 'Raster', key: 'numbers' })).toBeDefined()
    await band.unmount()
  }
})

test('a small scene draws every moment of its meters', () => {
  const moments = [
    { contextLeft: null, cacheLeft: null, fiveHour: null, week: null, cacheTtl: 3600, isCompacting: false },
    { contextLeft: 94, cacheLeft: 2280, fiveHour: 3, week: 15, cacheTtl: 3600, isCompacting: false },
    { contextLeft: 20, cacheLeft: 0, fiveHour: 80, week: 90, cacheTtl: 3600, isCompacting: false },
    { contextLeft: 10, cacheLeft: 600, fiveHour: 100, week: 100, cacheTtl: 3600, isCompacting: true },
  ]
  for (const scene of METER_SCENES) {
    for (const f of moments) {
      const picture = compile(scene.small?.svg(f) ?? '', 'halves')
      expect([scene.name, picture.columns, picture.rows]).toEqual([scene.name, 40, 4])
      // Something is drawn, and only the characters a cell of pixels takes.
      const codes = cellsOf(picture.paint(1, 0x1f1e1d)).filter((_, i) => i % 3 === 0)
      expect(codes.some(code => code !== 0x20)).toBe(true)
      expect(codes.every(code => code === 0x20 || code === 0x2580 || code === 0x2584 || code === 0x2588)).toBe(true)
    }
  }
})

test('the size picker in the terminal panel switches the band', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect((await panel.find({ key: 'size' }))?.props.value).toBe('small')
  await panel.select({ key: 'size', value: 'large' })
  expect((await panel.find({ key: 'size' }))?.props.value).toBe('large')
  await panel.unmount()

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: false } })
  expect((await band.find({ type: 'Raster', key: 'clawd' }))?.props.rows).toBe(8)
  await band.unmount()
})

// While Clawd waits on the person it takes up one pastime after another, a
// pastime from the start. Notes while whistling and dancing, bubbles: each a
// character in its cell, so the terminal's frames show which pastimes came up.
test('waiting on the person, Clawd takes up its pastimes one after another', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('classic.Elicitation', () => ({}))
  const painted: string[] = []
  on('ui.blit', ($, e) => {
    if (e.key === 'clawd' && 'cells' in e) {
      painted.push(textOf(e.cells))
    }
    return { value: {} }
  })
  await $.classic.Elicitation({ mcp_server_name: 'test', message: 'Fill in' } as never)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: true } })
  const first = textOf(String((await band.find({ type: 'Raster', key: 'clawd' }))?.props.cells))
  // Sixteen pastimes of nine seconds, three of rest before each.
  for (let s = 0; s < 16 * 12; s++) {
    await clock.advance(1_000)
  }
  const seen = [first, ...painted].join('')
  for (const char of '♪♫o°') {
    expect(seen).toContain(char)
  }
  await band.unmount()
})

test('in Hindi the terminal band speaks English, and the desktop band Hindi', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { LANG: 'hi_IN.UTF-8' })
  const terminal = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: false } })
  expect(await terminal.find({ type: 'Text', text: 'Waiting' })).toBeDefined()
  await terminal.unmount()
  const desktop = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(desktop)).toBe('Clawd: इंतज़ार कर रहा है')
  await desktop.unmount()
})

test('a narrow terminal shows Clawd with the meters in words, a narrower one words alone', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)

  const narrow = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 60, isWorking: false } })
  expect(await narrow.find({ type: 'Raster', key: 'clawd' })).toBeDefined()
  expect(await narrow.find({ type: 'Raster', key: 'meters' })).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /^Contexto libre sin datos/ })).toBeDefined()
  await narrow.unmount()

  const narrower = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 25, isWorking: false } })
  expect(await narrower.find({ type: 'Raster' })).toBeUndefined()
  expect(await narrower.find({ type: 'Text', text: 'Clawd: Esperando' })).toBeDefined()
  await narrower.unmount()
})

test('a picture paints its image two pixels to a cell, each animation where the clock has it', () => {
  const picture = compile(`<svg viewBox="0 0 2 2">
    <style>
      .blink { animation: blink 1s steps(1) infinite; }
      @keyframes blink { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    </style>
    <g fill="#FF0000"><rect x="0" y="0" width="1" height="1"/></g>
    <g class="blink" fill="#00FF00"><rect x="1" y="0" width="1" height="2"/></g>
  </svg>`)
  const OWN = 0x01000000
  expect([picture.columns, picture.rows]).toEqual([2, 1])
  // The red pixel is the upper half of its cell; the green column fills the other.
  expect(cellsOf(picture.paint(0, 0))).toEqual([0x2580, 0xff0000, OWN, 0x2588, 0x00ff00, 0x00ff00])
  // Half a second on, the green column has blinked off.
  expect(cellsOf(picture.paint(0.6, 0))).toEqual([0x2580, 0xff0000, OWN, 0x20, OWN, OWN])
})

// The characters of a Raster's cells, in order.
const textOf = (cells: string) => String.fromCodePoint(...cellsOf(cells).filter((_, i) => i % 3 === 0))

// A Raster's cells as the words they pack: code point, foreground, background.
const cellsOf = (cells: string) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return Array.from({ length: bytes.length / 4 }, (_, i) => view.getUint32(i * 4, true))
}

test('the compact button shows at 25% free, not at 26%, asks before compacting, and No backs out', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  let used = 74
  on('session.usage', () => usageAt(used)())
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'resume' })

  const roomy = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await roomy.find({ key: 'compact' })).toBeUndefined()
  await roomy.unmount()

  used = 75
  await $.classic.SessionStart({ source: 'resume' })
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  await band.press({ key: 'compact' })
  expect(await band.find({ key: 'compact-yes' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Compactar\?/ })).toBeDefined()

  await band.press({ key: 'compact-no' })
  expect(await band.find({ key: 'compact-yes' })).toBeUndefined()
  expect(await band.find({ key: 'compact' })).toBeDefined()
  await band.unmount()
})

test('Sí in the band compacts, and the band shows the compaction its own call raised', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(80))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }))
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'resume' })

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  await band.press({ key: 'compact' })
  await band.press({ key: 'compact-yes' })
  expect(await clawdOf(band)).toBe('Clawd: Compactando la conversación')
  expect(await band.find({ key: 'compact' })).toBeUndefined()
  await clock.advance(1_500)
  expect(await clawdOf(band)).toBe('Clawd: ¡Conversación compactada!')
  await band.unmount()
})

test('/cozy-clawd-scene names the scenes and turns down one that does not exist', async ($, on) => {
  mock.env(on, SPANISH)

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/Escena: balcony\. Hay: balcony, mate, teatime, window, adventure, gamer, cyberpunk, steampunk/)

  const unknown = await $.command.run(typed('Beach'))
  expect(unknown.text).toMatch(/No hay una escena "beach"/)

  const same = await $.command.run(typed('balcony'))
  expect(same.text).toMatch(/ya es balcony/)
})

test('the panel\'s Use button switches the band to that scene', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  await panel.press({ key: 'use-mate' })
  expect(await panel.find({ key: 'use-mate' })).toBeUndefined()
  expect(await panel.find({ key: 'use-balcony' })).toBeDefined()
  await panel.unmount()

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  const meters = (await band.findAll({ type: 'Svg' })).find(svg => String(svg.props.alt).startsWith('Contexto libre'))
  // The mate scene's tablecloth, checked sky blue and white: no other scene
  // has its sky blue.
  expect(meters?.props.source).toContain('#74ACDF')
  await band.unmount()
})

test('a new session starts with the scene picked last', async ($, on) => {
  mock.store(on, { scene: 'mate' })
  mock.env(on, SPANISH)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [] } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/Escena: mate\. Hay: balcony, mate, teatime, window, adventure, gamer, cyberpunk, steampunk/)
})

// `/cozy-clawd-scene` as typed in the composer, with what follows it.
const typed = (args: string) =>
  ({ command: 'cozy-clawd-scene', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

// What Clawd is doing, as the band's Clawd image says it.
const clawdOf = async (band: { findAll: (q: { type: 'Svg' }) => Promise<{ props: { alt?: unknown } }[]> }) =>
  (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => alt.startsWith('Clawd: '))

// What the band's scene of meters says it shows.
const metersOf = async (band: { findAll: (q: { type: 'Svg' }) => Promise<{ props: { alt?: unknown } }[]> }) =>
  (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => !alt.startsWith('Clawd: '))

// The model beneath the plugins: it answers each request with nothing.
const answering = async function* (_$: unknown, e: { turnId: string; index: number }) {
  return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
}

// One model request answered: the prompt cache starts over from now.
const answer = async ($: Parameters<TestBody>[0]) => {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'test', messageCount: 1 })) {
    // The test's answer streams nothing.
  }
}

// The usage limits of a Claude subscription, a fifth of the five hours and
// two fifths of the week used: on one, Claude Code keeps the prompt cache an
// hour.
const PLAN = [
  { kind: 'five_hour', percentUsed: 20 },
  { kind: 'seven_day', percentUsed: 40 },
]

// The context's fill as the engine reports it after an answer, percent used,
// on a subscription unless the limits say otherwise.
const usageAt = (percent: number, rateLimits: { kind: string; percentUsed: number }[] = PLAN) => () =>
  ({ value: { startedAt: 0, context: { window: 200_000, tokens: percent * 2_000, percent }, rateLimits } })

test('as the prompt cache runs out Clawd frets at ten minutes, yawns at two and sleeps once it expires', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  on('session.usage', usageAt(80))
  on('turn.step', answering)
  // The balcony, the default scene, no longer calls for anything of its own,
  // low as the context is.
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await clock.advance(50 * 60_000 + 1_000)
  expect(await clawdOf(band)).toBe('Clawd: Preocupado: la caché vence pronto')
  await clock.advance(8 * 60_000)
  expect(await clawdOf(band)).toBe('Clawd: Bostezando: la caché está por vencer')
  await clock.advance(2 * 60_000)
  expect(await clawdOf(band)).toBe('Clawd: Durmiendo: la caché venció')
  await band.unmount()
})

test('after a compaction Clawd celebrates a moment, then sleeps', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  // As the engine reports it: just compacted, the context has no reading until
  // the next answer, only the local estimate of what it holds.
  let isCompacted = false
  on('session.usage', (_$, e) =>
    isCompacted
      ? ({ value: { startedAt: 0, context: { window: 200_000, ...(e.breakdown ? { breakdown: { totalTokens: 20_000 } } : {}) }, rateLimits: PLAN } } as never)
      : usageAt(90)(),
  )
  on('session.compact', () => {
    isCompacted = true
    return { messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }
  })

  // The event as the engine raises it for /compact; the test has no transcript to build it from.
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [] }] } as never)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  // So quick a compaction still shows for its while before the celebration.
  expect(await clawdOf(band)).toBe('Clawd: Compactando la conversación')
  await clock.advance(1_500)
  expect(await clawdOf(band)).toBe('Clawd: ¡Conversación compactada!')
  // The context shows as the estimate has it, not as no reading.
  expect(await metersOf(band)).toMatch(/^Contexto libre 90%/)
  await clock.advance(2_300)
  expect(await clawdOf(band)).toBe('Clawd: ¡Conversación compactada!')
  await clock.advance(100)
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await band.unmount()
})

test('idle with the cache warm Clawd rests, and now and then takes up a pastime', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  on('turn.step', answering)
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  const clawd = (await band.findAll({ type: 'Svg' })).find(svg => String(svg.props.alt).startsWith('Clawd: '))
  // Clawd at rest and every pastime, the ladybug among them, are in the one image, each with its turns.
  for (const name of ['rest', 'gaze', 'whistle', 'juggle', 'yoyo', 'bubbles', 'read', 'dance', 'ladybug']) {
    expect(String(clawd?.props.source)).toContain(`@keyframes turn-${name}`)
  }
  await band.unmount()
})

test('where the locale is English, the band and the commands speak English', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, ENGLISH)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Waiting')
  expect((await band.findAll({ type: 'Svg' })).some(svg => String(svg.props.alt).startsWith('Context free'))).toBe(true)
  await band.unmount()

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/^Scene: balcony\. Available: balcony, mate/)
})

test('the Language row of /config wins over the locale', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, ENGLISH)
  // The rows as the engine lists them; the test has no /config to read them from.
  on('config.list', () => ({ value: [{ key: 'language', label: 'Language', kind: 'text', value: 'español' }] as never }))

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await band.unmount()
})

test('a locale in any language the desktop app shows picks it', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { LANG: 'ja_JP.UTF-8' })

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: 待機中')
  expect((await band.findAll({ type: 'Svg' })).some(svg => String(svg.props.alt).startsWith('空きコンテキスト'))).toBe(true)
  await band.unmount()

  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await panel.find({ type: 'Text', text: '自動（日本語）' })).toBeDefined()
  for (const lang of ['es', 'en', 'fr', 'de', 'it', 'pt', 'id', 'hi', 'ja', 'ko']) {
    expect(await panel.find({ key: `language-${lang}` })).toBeDefined()
  }
  await panel.unmount()
})

test('the Language row of /config can name a language in its own words', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, ENGLISH)
  on('config.list', () => ({ value: [{ key: 'language', label: 'Language', kind: 'text', value: 'Deutsch' }] as never }))

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Wartet')
  await band.unmount()
})

test('on Windows with no locale variables, the registry\'s display language counts', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { OS: 'Windows_NT', SystemRoot: 'D:\\WINDOWS' })
  const asked: string[][] = []
  const cwds: (string | undefined)[] = []
  // reg.exe's answer, as Windows prints the person's language list.
  on('process.run', (_$, e) => {
    asked.push([...e.argv])
    cwds.push(e.init?.cwd)
    const stdout = '\r\nHKEY_CURRENT_USER\\Control Panel\\International\\User Profile\r\n    Languages    REG_MULTI_SZ    es-AR\\0en-US\r\n\r\n'
    return { value: { exitCode: 0, stdout, stderr: '' } as never }
  })

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  // Windows' own reg.exe, by its full path, run from its own folder: never one
  // the project's folder holds.
  expect(asked[0]).toEqual(['D:\\WINDOWS\\System32\\reg.exe', 'query', 'HKCU\\Control Panel\\International\\User Profile', '/v', 'Languages'])
  expect(cwds[0]).toBe('D:\\WINDOWS\\System32')
  await band.unmount()
})

test('on macOS with no locale variables, the first of AppleLanguages counts', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  // What `defaults read -g AppleLanguages` prints.
  on('process.run', () => ({ value: { exitCode: 0, stdout: '(\n    "es-419",\n    "en-US"\n)\n', stderr: '' } as never }))

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await band.unmount()
})

test('a language picked in the panel switches the band', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  // The pick declares the commands again, their menu lines in the new language.
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await panel.find({ type: 'Text', text: 'Automático (Español)' })).toBeDefined()
  await panel.press({ key: 'language-en' })
  expect(await panel.find({ key: 'language-en' })).toBeUndefined()
  expect(await panel.find({ key: 'language-auto' })).toBeDefined()
  expect(await panel.find({ type: 'Text', text: 'in use' })).toBeDefined()
  await panel.unmount()

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Waiting')
  await band.unmount()
})

test('a new session speaks the language picked last', async ($, on) => {
  mock.store(on, { language: 'en' })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(0))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  expect((await $.command.run(typed(''))).text).toMatch(/^Scene: balcony/)
})

test('a text takes a column a character, two for a wide one, none for a mark', () => {
  expect(columnsOf('Esperando')).toBe(9)
  expect(columnsOf('¡Conversación compactada!')).toBe(25)
  expect(columnsOf('待機中')).toBe(6)
  expect(columnsOf('대기 중')).toBe(7)
  expect(columnsOf('Espera\u0301ndo')).toBe(9)
})
