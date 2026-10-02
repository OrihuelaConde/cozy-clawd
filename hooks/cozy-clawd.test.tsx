import { expect, mock, test } from 'claude-code/testing'

const BAND = { hasSurvey: false, maxRows: 10, bodyColumns: 120 }

const PANE_PROPS = { title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const

test('the pane shows every scene on the desktop, the one in use marked', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const pane = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANE_PROPS })
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(2)
  expect(await pane.find({ type: 'Text', text: 'en uso' })).toBeDefined()
  expect(await pane.find({ key: 'usar-estante' })).toBeUndefined()
  expect(await pane.find({ key: 'usar-mateada' })).toBeDefined()
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
  expect(listed.text).toMatch(/Escena: estante\. Hay: estante/)

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
  expect(listed.text).toMatch(/Escena: mateada\. Hay: estante, mateada/)
})
