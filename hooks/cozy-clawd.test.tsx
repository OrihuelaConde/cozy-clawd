import { expect, mock, test, type TestBody } from 'claude-code/testing'

// What a site's props carry beside its own: where it scrolls, and whose conversation it shows.
const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }

const BAND = { ...SITE, hasSurvey: false, maxRows: 10, bodyColumns: 120 }

const PANE_PROPS = { ...SITE, title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const

test('the pane shows every scene on the desktop, the one in use marked', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(3)
  expect(await pane.find({ type: 'Text', text: 'en uso' })).toBeDefined()
  expect(await pane.find({ key: 'usar-estante' })).toBeUndefined()
  for (const name of ['mateada', 'balcon']) {
    expect(await pane.find({ key: `usar-${name}` })).toBeDefined()
  }
  await pane.unmount()
})

test('the pane on the terminal says what Clawd does and offers a picker', async $ => {
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.find({ type: 'Text', text: /Durmiendo/ })).toBeDefined()
  expect((await pane.find({ key: 'escena' }))?.type).toBe('Select')
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

test('/clawd-escena names the scenes and turns down one that does not exist', async $ => {
  const typed = (args: string) =>
    ({ command: 'clawd-escena', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

  const listed = await $.command.run(typed(''))
  expect(listed.text).toMatch(/Escena: estante\. Hay: estante, mateada, balcon/)

  const unknown = await $.command.run(typed('Playa'))
  expect(unknown.text).toMatch(/No hay una escena "playa"/)

  const same = await $.command.run(typed('estante'))
  expect(same.text).toMatch(/ya es estante/)
})

test('Usar in the pane switches the band to that scene', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
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
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [] } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  const listed = await $.command.run({ command: 'clawd-escena', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(listed.text).toMatch(/Escena: mateada\. Hay: estante, mateada, balcon/)
})

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

for (const [name, cue] of [['mateada', 'El mate se enfrió']] as const) {
  test(`idle in the ${name} once the cache has expired, Clawd: ${cue}`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    on('session.usage', usageAt(30))
    on('turn.step', answering)
    await useScene($, name)
    await answer($)

    const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
    expect(await clawdOf(band)).toBe('Clawd: Durmiendo')
    await clock.advance(61 * 60_000)
    expect(await clawdOf(band)).toBe(`Clawd: ${cue}`)
    await band.unmount()
  })
}

test('idle on the balcony at a quarter of the context, Clawd watches the watering can', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.usage', usageAt(80))
  on('turn.step', answering)
  await useScene($, 'balcon')
  await answer($)

  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: La regadera se está secando')
  await band.unmount()
})

test('after a compaction Clawd celebrates a moment, then sleeps', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
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
  expect(await clawdOf(band)).toBe('Clawd: Durmiendo')
  await band.unmount()
})
