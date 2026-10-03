// What Clawd shows as the session moves on: subagents, permission asks,
// forms, compactions, and what the band keeps across a new session.

import { expect, mock, test, type TestBody } from 'claude-code/testing'

const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }
const BAND = { ...SITE, hasSurvey: false, maxRows: 10, bodyColumns: 120 }
const PANEL_PROPS = { ...SITE, title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const
const SPANISH = { LANG: 'es_AR.UTF-8' }

type Band = { findAll: (q: { type: 'Svg' }) => Promise<{ props: { alt?: unknown } }[]> }

// What Clawd is doing, as the band's Clawd image says it.
const clawdOf = async (band: Band) => (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => alt.startsWith('Clawd: '))

// What the band's scene of meters says it shows.
const metersOf = async (band: Band) => (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => !alt.startsWith('Clawd: '))

// The context's fill after an answer, percent used, on a Claude subscription.
const usageAt = (percent: number) => () => ({
  value: {
    startedAt: 0,
    context: { window: 200_000, tokens: percent * 2_000, percent },
    rateLimits: [{ kind: 'five_hour', percentUsed: 20 }, { kind: 'seven_day', percentUsed: 40 }],
  },
})

// One model request of the main turn, or of a subagent's.
const answer = async ($: Parameters<TestBody>[0], agentId?: string) => {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'test', messageCount: 1, ...(agentId ? { agentId } : {}) })) {
    // The test's answer streams nothing.
  }
}

test('a subagent finishing in the middle of the turn leaves the main turn on screen', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  // The main turn's request launches a subagent.
  on('turn.step', async function* (_$, e) {
    yield { kind: 'tool' as const, index: 0, id: 'toolu_1', name: 'Agent' }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use' as const, usage: null }
  })
  on('turn.complete', () => ({ text: '' }))
  await answer($)
  await clock.advance(5_000)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await clawdOf(band)).toBe('Clawd: Lanzando un subagente')
  // The subagent's own turn ends; the main one goes on.
  await $.turn.complete({ turnId: 'sub', agentId: 'agent-1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' } as never)
  await clock.advance(5_000)
  expect(await clawdOf(band)).toBe('Clawd: Lanzando un subagente')
  await band.unmount()
})

test('a tool a settings hook allows runs with no wait on the person', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  // Beneath the plugins: the settings' hook allows the call, so no dialog shows.
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'allow' as const } }))
  on('telemetry.log', () => ({ value: undefined }))
  on('tool.call', async () => {
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} } as never)
    await $.telemetry.log({ to: 'collector', event: 'tool_decision', attributes: { decision: 'accept', source: 'hook', tool_name: 'Bash' }, loggedAt: new Date(1_000_000).toISOString() })
    return { result: 'ok' } as never
  })
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await clock.advance(5_000)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await clawdOf(band)).toBe('Clawd: Ejecutando un comando')
  await band.unmount()
})

test('once the person answers a connector\'s form, Clawd stops waiting', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('classic.Elicitation', () => ({}))
  on('classic.ElicitationResult', () => ({}))
  await $.classic.Elicitation({ mcp_server_name: 'test', message: 'Fill in' } as never)
  await clock.advance(5_000)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando tu respuesta')
  await $.classic.ElicitationResult({ mcp_server_name: 'test', action: 'accept', content: {} } as never)
  await clock.advance(5_000)
  expect(await clawdOf(band)).toBe('Clawd: Usando una herramienta')
  await band.unmount()
})

test('a usage read that fails after a compaction still ends it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  let usageFails = false
  on('session.usage', () => {
    if (usageFails) {
      throw new Error('no usage')
    }
    return usageAt(90)()
  })
  on('session.compact', () => {
    usageFails = true
    return { messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }
  })
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [] }] } as never)
  await clock.advance(60_000)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await band.unmount()
})

test('a subagent left working in the background after the turn shows nothing', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'bg-1' } as never)
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await panel.find({ type: 'Text', text: 'Esperando' })).toBeDefined()
  await panel.unmount()
})

test('the compact question goes away once the conversation is compacted another way', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  let used = 80
  on('session.usage', () => usageAt(used)())
  on('session.compact', () => {
    used = 5
    return { messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }
  })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'resume' } as never)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  await band.press({ key: 'compact' })
  expect(await band.find({ key: 'compact-yes' })).toBeDefined()
  // The person types /compact instead.
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [] }] } as never)
  await clock.advance(10_000)
  expect(await metersOf(band)).toMatch(/^Contexto libre 95%/)
  expect(await band.find({ key: 'compact-yes' })).toBeUndefined()
  await band.unmount()
})

test('two quick presses of Yes compact once', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(80))
  let compactions = 0
  on('session.compact', async () => {
    compactions++
    await clock.sleep(3_000)
    return { messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }
  })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'resume' } as never)
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  await band.press({ key: 'compact' })
  const first = band.press({ key: 'compact-yes' })
  const second = band.press({ key: 'compact-yes' })
  await clock.advance(10_000)
  await Promise.allSettled([first, second])
  expect(compactions).toBe(1)
  await band.unmount()
})

test('a scene the store can\'t read leaves the size picked last', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('store.get', (_$, e) => {
    if (e.key === 'scene') {
      throw new Error('unreadable')
    }
    return { value: e.key === 'size' ? 'large' : undefined } as never
  })
  on('session.usage', usageAt(0))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const band = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160, maxRows: 20, isWorking: false } })
  expect((await band.find({ type: 'Raster', key: 'clawd' }))?.props.rows).toBe(8)
  await band.unmount()
})
