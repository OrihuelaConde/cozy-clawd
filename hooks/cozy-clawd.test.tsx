import { expect, mock, test, type TestBody } from 'claude-code/testing'

// What a site's props carry beside its own: where it scrolls, and whose conversation it shows.
const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }

const BAND = { ...SITE, hasSurvey: false, maxRows: 10, bodyColumns: 120 }

const PANE_PROPS = { ...SITE, title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const

// The locale of someone who reads Spanish, and of someone who reads English.
const SPANISH = { LANG: 'es_AR.UTF-8' }
const ENGLISH = { LANG: 'en_US.UTF-8' }

test('the pane shows every scene on the desktop, the one in use marked', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(8)
  expect(await pane.find({ type: 'Text', text: 'en uso' })).toBeDefined()
  expect(await pane.find({ key: 'usar-estante' })).toBeUndefined()
  for (const name of ['mateada', 'balcon', 'ventana', 'aventura', 'gamer', 'cyberpunk', 'steampunk']) {
    expect(await pane.find({ key: `usar-${name}` })).toBeDefined()
  }
  await pane.unmount()
})

test('the pane on the terminal says what Clawd does and offers pickers', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.find({ type: 'Text', text: 'Esperando' })).toBeDefined()
  expect((await pane.find({ key: 'escena' }))?.type).toBe('Select')
  expect((await pane.find({ key: 'idioma' }))?.type).toBe('Select')
  await pane.unmount()
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

test('the compact button shows at 25% free, asks before compacting, and No backs out', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 160_000, percent: 80 }, rateLimits: [] } }))
  on('classic.SessionStart', () => ({}))
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

test('/clawd-escena names the scenes and turns down one that does not exist', async ($, on) => {
  mock.env(on, SPANISH)

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/Escena: estante\. Hay: estante, mateada, balcon, ventana, aventura, gamer, cyberpunk, steampunk/)

  const unknown = await $.command.run(typed('Playa'))
  expect(unknown.text).toMatch(/No hay una escena "playa"/)

  const same = await $.command.run(typed('estante'))
  expect(same.text).toMatch(/ya es estante/)
})

test('Usar in the pane switches the band to that scene', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  await pane.press({ key: 'usar-mateada' })
  expect(await pane.find({ key: 'usar-mateada' })).toBeUndefined()
  expect(await pane.find({ key: 'usar-estante' })).toBeDefined()
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  const figures = (await band.findAll({ type: 'Svg' })).find(svg => String(svg.props.alt).startsWith('Contexto libre'))
  // The mateada's checked tablecloth.
  expect(figures?.props.source).toContain('#B5483E')
  await band.unmount()
})

test('a new session starts with the scene picked last', async ($, on) => {
  mock.store(on, { escena: 'mateada' })
  mock.env(on, SPANISH)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [] } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/Escena: mateada\. Hay: estante, mateada, balcon, ventana, aventura, gamer, cyberpunk, steampunk/)
})

// `/clawd-escena` as typed in the composer, with what follows it.
const typed = (args: string) =>
  ({ command: 'clawd-escena', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

// What Clawd is doing, as the band's Clawd image says it.
const clawdOf = async (band: { findAll: (q: { type: 'Svg' }) => Promise<{ props: { alt?: unknown } }[]> }) =>
  (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => alt.startsWith('Clawd: '))

// Picks a scene the way the person does: Usar in the pane.
const useScene = async ($: Parameters<TestBody>[0], name: string) => {
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  await pane.press({ key: `usar-${name}` })
  await pane.unmount()
}

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

const usageAt = (percent: number) => () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: percent * 2_000, percent }, rateLimits: [] } })

test('as the prompt cache runs out Clawd frets at ten minutes, yawns at two and sleeps once it expires', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  on('session.usage', usageAt(80))
  on('turn.step', answering)
  // The scene no longer calls for anything of its own, low as the context is.
  await useScene($, 'balcon')
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await clock.advance(50 * 60_000 + 1_000)
  expect(await clawdOf(band)).toBe('Clawd: Preocupado')
  await clock.advance(8 * 60_000)
  expect(await clawdOf(band)).toBe('Clawd: Bostezando')
  await clock.advance(2 * 60_000)
  expect(await clawdOf(band)).toBe('Clawd: Durmiendo')
  await band.unmount()
})

test('after a compaction Clawd celebrates a moment, then sleeps', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(10))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Resumen', toolUses: [] }] }))

  // The event as the engine raises it for /compact; the test has no transcript to build it from.
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hola', toolUses: [] }] } as never)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  // So quick a compaction still shows for its while before the celebration.
  expect(await clawdOf(band)).toBe('Clawd: Compactando la conversación')
  await clock.advance(1_500)
  expect(await clawdOf(band)).toBe('Clawd: ¡Conversación compactada!')
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
  for (const name of ['reposo', 'mira', 'silba', 'malabares', 'yoyo', 'pompas', 'lee', 'baila', 'vaquita']) {
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
  expect(listed.text).toMatch(/^Scene: estante\. Available: estante, mateada/)
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

test('on Windows with no locale variables, the registry\'s display language counts', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { OS: 'Windows_NT' })
  const asked: string[][] = []
  // reg.exe's answer, as Windows prints the person's language list.
  on('process.run', (_$, e) => {
    asked.push([...e.argv])
    const stdout = '\r\nHKEY_CURRENT_USER\\Control Panel\\International\\User Profile\r\n    Languages    REG_MULTI_SZ    es-AR\\0en-US\r\n\r\n'
    return { value: { exitCode: 0, stdout, stderr: '' } as never }
  })

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  expect(asked[0]).toEqual(['reg.exe', 'query', 'HKCU\\Control Panel\\International\\User Profile', '/v', 'Languages'])
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

test('a language picked in the pane switches the band', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, SPANISH)
  // The pick declares the commands again, their menu lines in the new language.
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.find({ type: 'Text', text: 'Automático (Español)' })).toBeDefined()
  await pane.press({ key: 'idioma-en' })
  expect(await pane.find({ key: 'idioma-en' })).toBeUndefined()
  expect(await pane.find({ key: 'idioma-auto' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'in use' })).toBeDefined()
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Waiting')
  await band.unmount()
})

test('a new session speaks the language picked last', async ($, on) => {
  mock.store(on, { idioma: 'en' })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(0))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  expect((await $.command.run(typed(''))).text).toMatch(/^Scene: estante/)
})
