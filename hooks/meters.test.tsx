// The session's meters: how long the prompt cache lasts and where it counts
// from, the usage limits starting over, and what each scene draws for them.

import { expect, mock, test, type TestBody } from 'claude-code/testing'

import { compile } from './raster'
import { METER_SCENES } from './scenes/index'
import type { Meters } from './scenes/index'
import { countdown, COUNTDOWN_CSS, pixelText, sceneSvg } from './scenes/pixels'

const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }
const BAND = { ...SITE, hasSurvey: false, maxRows: 10, bodyColumns: 120 }
const SPANISH = { LANG: 'es_AR.UTF-8' }

type Band = { findAll: (q: { type: 'Svg' }) => Promise<{ props: { alt?: unknown } }[]> }
type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const clawdOf = async (band: Band) => (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => alt.startsWith('Clawd: '))
const metersOf = async (band: Band) => (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props.alt)).find(alt => !alt.startsWith('Clawd: '))

// A Claude subscription's usage limits, within them.
const PLAN: Limit[] = [
  { kind: 'five_hour', percentUsed: 20 },
  { kind: 'seven_day', percentUsed: 40 },
]

// The usage the engine reports after an answer: the context's fill, percent
// used, and the usage limits (none off a subscription).
const usageAt = (percent: number, rateLimits: Limit[] = PLAN) => () =>
  ({ value: { startedAt: 0, context: { window: 200_000, tokens: percent * 2_000, percent }, rateLimits } })

// The model beneath the plugins: it answers each request with nothing.
const answering = async function* (_$: unknown, e: { turnId: string; index: number }) {
  return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
}

const answer = async ($: Parameters<TestBody>[0]) => {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'test', messageCount: 1 })) {
    // The test's answer streams nothing.
  }
}

const desktopBand = ($: Parameters<TestBody>[0]) =>
  $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })

// How long the cache lasts after an answer, by what Claude Code reads: the
// variables, the setting, and whether the usage limits say a subscription.
const LENGTHS: { name: string; env?: Record<string, string>; settings?: Record<string, unknown>; limits: Limit[]; cache: RegExp }[] = [
  { name: 'on a subscription within its limits the cache lasts an hour', limits: PLAN, cache: /caché 60\smin/ },
  { name: 'with an API key the cache lasts five minutes', limits: [], cache: /caché 5\smin/ },
  { name: 'past a usage limit the cache lasts five minutes', limits: [{ kind: 'five_hour', percentUsed: 100 }, { kind: 'seven_day', percentUsed: 50 }], cache: /caché 5\smin/ },
  { name: 'FORCE_PROMPT_CACHING_5M makes it five minutes', env: { FORCE_PROMPT_CACHING_5M: '1' }, limits: PLAN, cache: /caché 5\smin/ },
  { name: 'ENABLE_PROMPT_CACHING_1H makes it an hour', env: { ENABLE_PROMPT_CACHING_1H: 'true' }, limits: [], cache: /caché 60\smin/ },
  { name: 'on Bedrock ENABLE_PROMPT_CACHING_1H_BEDROCK makes it an hour', env: { CLAUDE_CODE_USE_BEDROCK: '1', ENABLE_PROMPT_CACHING_1H_BEDROCK: '1' }, limits: [], cache: /caché 60\smin/ },
  { name: 'the promptCacheTtl setting names it', settings: { promptCacheTtl: '5m' }, limits: PLAN, cache: /caché 5\smin/ },
  { name: 'CLAUDE_CODE_PROMPT_CACHE_TTL names it, over the setting', env: { CLAUDE_CODE_PROMPT_CACHE_TTL: '1h' }, settings: { promptCacheTtl: '5m' }, limits: [], cache: /caché 60\smin/ },
  { name: 'with prompt caching off there is no cache to count', env: { DISABLE_PROMPT_CACHING: '1' }, limits: PLAN, cache: /caché sin datos/ },
]

for (const length of LENGTHS) {
  test(length.name, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    mock.env(on, { ...SPANISH, ...length.env })
    on('session.usage', usageAt(30, length.limits))
    on('settings.read', () => ({ value: (length.settings ?? {}) as never }))
    on('turn.step', answering)
    await answer($)
    const band = await desktopBand($)
    expect(await metersOf(band)).toMatch(length.cache)
    await band.unmount()
  })
}

test('a five-minute cache has Clawd fret and yawn in the same share of it as an hour\'s', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30, []))
  on('turn.step', answering)
  await answer($)
  const band = await desktopBand($)
  // A sixth of five minutes is fifty seconds; a thirtieth, ten.
  await clock.advance(249_000)
  expect(await clawdOf(band)).toBe('Clawd: Esperando')
  await clock.advance(2_000)
  expect(await clawdOf(band)).toBe('Clawd: Preocupado: la caché vence pronto')
  await clock.advance(40_000)
  expect(await clawdOf(band)).toBe('Clawd: Bostezando: la caché está por vencer')
  await clock.advance(10_000)
  expect(await clawdOf(band)).toBe('Clawd: Durmiendo: la caché venció')
  expect(await metersOf(band)).toMatch(/caché vencida/)
  await band.unmount()
})

test('after /clear the old conversation\'s cache no longer counts', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  on('turn.step', answering)
  on('classic.SessionStart', () => ({}))
  await answer($)
  await clock.advance(5 * 60_000)
  await $.classic.SessionStart({ source: 'clear' } as never)
  const band = await desktopBand($)
  expect(await metersOf(band)).toMatch(/caché sin datos/)
  await band.unmount()
})

test('a resumed conversation\'s cache counts from its last answer, as long as the engine reckons it lasts', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30, []))
  on('classic.SessionStart', () => ({}))
  // Answered ten minutes ago and still warm: the cache lasts an hour.
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 600, prompt_cache_likely_expired: false } as never)
  const warm = await desktopBand($)
  expect(await metersOf(warm)).toMatch(/caché 50\smin/)
  await warm.unmount()
  // Answered seven minutes ago and expired: it lasted five.
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 420, prompt_cache_likely_expired: true } as never)
  const expired = await desktopBand($)
  expect(await metersOf(expired)).toMatch(/caché vencida/)
  await expired.unmount()
})

test('a request that got no response leaves the cache counting from the last answer', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(30))
  let isFailing = false
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: isFailing ? null : ('end_turn' as const), usage: null }
  })
  await answer($)
  await clock.advance(40 * 60_000)
  isFailing = true
  await answer($)
  const band = await desktopBand($)
  expect(await metersOf(band)).toMatch(/caché 20\smin/)
  await band.unmount()
})

test('a usage limit whose window starts over reads full again with no new answer', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  const resetsAt = new Date(1_000_000 + 30 * 60_000).toISOString()
  on('session.usage', usageAt(30, [{ kind: 'five_hour', percentUsed: 90, resetsAt }, { kind: 'seven_day', percentUsed: 40 }]))
  on('turn.step', answering)
  await answer($)
  const band = await desktopBand($)
  expect(await metersOf(band)).toMatch(/límite de 5\sh libre 10%/)
  await clock.advance(30 * 60_000 + 1_000)
  expect(await metersOf(band)).toMatch(/límite de 5\sh libre 100%/)
  expect(await metersOf(band)).toMatch(/semana libre 60%/)
  await band.unmount()
})

test('a meter with less than half a percent left reads 0%', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, SPANISH)
  on('session.usage', usageAt(99.6, [{ kind: 'five_hour', percentUsed: 99.6 }, { kind: 'seven_day', percentUsed: 0.4 }]))
  on('turn.step', answering)
  await answer($)
  const band = await desktopBand($)
  expect(await metersOf(band)).toMatch(/^Contexto libre 0%, caché 60\smin, límite de 5\sh libre 0%, semana libre 100%$/)
  await band.unmount()
})

// The cells of a picture's frame `t` seconds in: code point, foreground,
// background, one after the other.
const cellsOf = (cells: string) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return Array.from({ length: bytes.length / 4 }, (_, i) => view.getUint32(i * 4, true))
}

const BACKGROUND = 0x1f1e1d

// The cache's minutes, counting down by themselves, read at `t` seconds as the
// pixel font writes `text`.
const readsAt = (left: number, t: number, text: string) =>
  expect(compile(sceneSvg(COUNTDOWN_CSS, countdown(left, 0))).paint(t, BACKGROUND)).toBe(compile(sceneSvg('', pixelText(text, 0))).paint(0, BACKGROUND))

test('the cache\'s minutes count a minute begun, and read 00 once it expires', () => {
  readsAt(3600, 0, '60m')
  readsAt(3600, 59.9, '60m')
  readsAt(3600, 60.1, '59m')
  readsAt(300, 0, '05m')
  readsAt(90, 29.9, '02m')
  readsAt(90, 30.1, '01m')
  readsAt(30, 29.9, '01m')
  readsAt(30, 30.1, '00m')
  readsAt(30, 80, '00m')
})

// A moment of the meters, the one the table changes the rest of.
const BASE: Meters = { contextLeft: 60, cacheLeft: 1800, fiveHour: 40, week: 40, cacheTtl: 3600, isCompacting: false }

// Moments of a second, in which what blinks has blinked.
const MOMENTS = [0, 0.2, 0.45, 0.65, 0.85, 1]

// What a scene draws of its things over a second, numbers aside: in the
// large size the rows above the numbers, in the small one (whose numbers are
// a line of text under it) all of it.
const figures = (name: string, size: 'large' | 'small', f: Partial<Meters>) => {
  const scene = METER_SCENES.find(s => s.name === name)!
  const meters = { ...BASE, ...f }
  if (size === 'small') {
    const picture = compile(scene.small!.svg(meters))
    return MOMENTS.map(t => picture.paint(t, BACKGROUND)).join(' ')
  }
  const picture = compile(scene.svg(meters))
  const aboveNumbers = 6
  return MOMENTS.map(t => cellsOf(picture.paint(t, BACKGROUND)).slice(0, aboveNumbers * picture.columns * 3).join(' ')).join(' | ')
}

for (const scene of METER_SCENES) {
  for (const size of ['large', 'small'] as const) {
    test(`the ${scene.name} scene in the ${size} size draws no reading full, and every step of a meter its own way`, () => {
      const isSame = (a: Partial<Meters>, b: Partial<Meters>) => figures(scene.name, size, a) === figures(scene.name, size, b)
      const same = (a: Partial<Meters>, b: Partial<Meters>) => expect([a, b, isSame(a, b)]).toEqual([a, b, true])
      const differ = (a: Partial<Meters>, b: Partial<Meters>) => expect([a, b, isSame(a, b)]).toEqual([a, b, false])
      // The context: low from 25% down, nothing at 0%, something from 1%.
      same({ contextLeft: null }, { contextLeft: 100 })
      differ({ contextLeft: 25 }, { contextLeft: 26 })
      differ({ contextLeft: 0 }, { contextLeft: 1 })
      differ({ contextLeft: 50 }, { contextLeft: 100 })
      // The usage limits, by the share used.
      for (const limit of ['fiveHour', 'week'] as const) {
        same({ [limit]: null }, { [limit]: 0 })
        differ({ [limit]: 100 }, { [limit]: 99 })
        differ({ [limit]: 50 }, { [limit]: 0 })
      }
    })
  }
}
