// The band and the panel in the terminal: the frames that move the pictures,
// the corner the engine's `[-]` takes, the theme's background, and the
// languages Claude Code measures short there.

import { expect, mock, test, type TestBody } from 'claude-code/testing'

import { LANGS, TEXTS } from './language'
import { columnsOf, compile, isMeasuredShort } from './raster'

const SITE = { scroll: { offset: 0, bodyRows: 10 }, view: {} }
const BAND = { ...SITE, hasSurvey: false, maxRows: 20, bodyColumns: 160 }
const PANEL_PROPS = { ...SITE, title: 'Escenas', isFocused: false, bodyColumns: 40, placement: 'dock' } as const
const ENGLISH = { LANG: 'en_US.UTF-8' }

type TestEngine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

const usage = () => ({
  value: {
    startedAt: 0,
    context: { window: 200_000, tokens: 60_000, percent: 30 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 20 }, { kind: 'seven_day', percentUsed: 40 }],
  },
})

const answering = async function* (_$: unknown, e: { turnId: string; index: number }) {
  return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
}

const answer = async ($: TestEngine) => {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'test', messageCount: 1 })) {
    // The test's answer streams nothing.
  }
}

const terminalBand = ($: TestEngine, props: Partial<typeof BAND> & { isWorking: boolean }) =>
  $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, ...props } })

// A clock of the test's own: it counts the timers the band sets and can
// refuse the next one, as a hook may.
const ownClock = (on: On) => {
  let now = 1_000_000
  let waits: { due: number; resolve: () => void }[] = []
  const clock = { timers: 0, refuseNext: false, advance: async (_ms: number) => {} }
  const wait = (ms: number) => new Promise(resolve => waits.push({ due: now + ms, resolve: () => resolve({ value: undefined }) }))
  on('clock.now', () => ({ value: now }))
  on('clock.sleep', (_$, e) => wait(e.ms) as never)
  on('clock.after', (_$, e) => {
    clock.timers++
    if (clock.refuseNext) {
      clock.refuseNext = false
      return { deny: 'refused by a hook' }
    }
    return wait(e.ms) as never
  })
  // Lets what a timer started run on before the next one.
  const settle = async () => {
    for (let i = 0; i < 100; i++) {
      await Promise.resolve()
    }
  }
  clock.advance = async (ms: number) => {
    const until = now + ms
    for (;;) {
      waits.sort((a, b) => a.due - b.due)
      const next = waits[0]
      if (next === undefined || next.due > until) {
        break
      }
      waits = waits.slice(1)
      now = next.due
      next.resolve()
      await settle()
    }
    now = until
    await settle()
  }
  return clock
}

test('a picture says when its animations next change what it shows', () => {
  const blinking = compile(`<svg viewBox="0 0 2 2">
    <style>
      .blink { animation: blink 1s steps(1) infinite; }
      @keyframes blink { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    </style>
    <g class="blink" fill="#00FF00"><rect x="0" y="0" width="2" height="2"/></g>
  </svg>`)
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01
  expect(near(blinking.nextChange(0), 0.5)).toBe(true)
  expect(near(blinking.nextChange(0.6), 1)).toBe(true)
  expect(near(blinking.nextChange(1.2), 1.5)).toBe(true)
  const still = compile(`<svg viewBox="0 0 2 2"><g fill="#00FF00"><rect x="0" y="0" width="2" height="2"/></g></svg>`)
  expect(still.nextChange(0)).toBe(Infinity)
})

test('the band sends a frame only when a picture changed, and sets its timer only for that', async ($, on) => {
  const clock = ownClock(on)
  mock.env(on, ENGLISH)
  on('session.usage', usage)
  on('turn.step', answering)
  const sent = new Map<string, string[]>()
  on('ui.blit', (_$, e) => {
    if ('cells' in e) {
      sent.set(e.key, [...(sent.get(e.key) ?? []), e.cells])
    }
    return { value: {} }
  })
  await answer($)
  const band = await terminalBand($, { isWorking: false })
  await clock.advance(1_000)
  clock.timers = 0
  await clock.advance(20_000)
  // Every frame sent differs from the one before it.
  for (const [key, frames] of sent) {
    expect([key, frames.every((cells, i) => i === 0 || cells !== frames[i - 1])]).toEqual([key, true])
  }
  // About a timer a frame: few that find nothing changed. A timer every 66 ms
  // would be some 300 in twenty seconds.
  const frames = [...sent.values()].reduce((n, f) => n + f.length, 0)
  expect(frames).toBeGreaterThan(0)
  expect(clock.timers).toBeLessThanOrEqual(frames + 10)
  await band.unmount()
})

test('a picture the band no longer draws gets no more frames', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  mock.env(on, ENGLISH)
  on('session.usage', usage)
  on('turn.step', answering)
  let mounted = new Set(['clawd', 'meters', 'numbers'])
  const refused: string[] = []
  on('ui.blit', (_$, e) => {
    if (!mounted.has(e.key)) {
      refused.push(e.key)
      return { deny: 'not mounted' }
    }
    return { value: {} }
  })
  await answer($)
  const band = await terminalBand($, { isWorking: false })
  expect(await band.find({ type: 'Raster', key: 'numbers' })).toBeDefined()
  await clock.advance(500)
  // The person picks the large size, whose scenes have their numbers in them.
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  await panel.select({ key: 'size', value: 'large' })
  await panel.unmount()
  await clock.advance(100)
  expect(await band.find({ type: 'Raster', key: 'numbers' })).toBeUndefined()
  mounted = new Set(['clawd', 'meters'])
  await clock.advance(20_000)
  expect(refused).toEqual([])
  await band.unmount()
})

test('a frame timer the engine refuses starts again when the band draws again', async ($, on) => {
  const clock = ownClock(on)
  mock.env(on, ENGLISH)
  on('session.usage', usage)
  on('turn.step', answering)
  const taken: string[] = []
  on('ui.blit', (_$, e) => {
    taken.push(e.key)
    return { value: {} }
  })
  await answer($)
  const band = await terminalBand($, { isWorking: true })
  await clock.advance(1_000)
  clock.refuseNext = true
  await clock.advance(2_000)
  // Anything new draws the band anew.
  await band.redraw({ ...BAND, isWorking: true })
  taken.length = 0
  await clock.advance(2_000)
  expect(taken).toContain('clawd')
  await band.unmount()
})

test('a frame the terminal never answers holds up nothing for long', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, ENGLISH)
  on('session.usage', usage)
  on('turn.step', answering)
  let isHanging = false
  const taken: string[] = []
  // The terminal never answers one frame of Clawd's.
  on('ui.blit', (_$, e) => {
    if (isHanging && e.key === 'clawd') {
      isHanging = false
      return new Promise(() => {})
    }
    taken.push(e.key)
    return { value: {} }
  })
  await answer($)
  const band = await terminalBand($, { isWorking: true })
  await clock.advance(1_000)
  isHanging = true
  await clock.advance(1_000)
  taken.length = 0
  await clock.advance(10_000)
  expect(taken).toContain('clawd')
  await band.unmount()
})

// The terminal's cells packed as words: code point, foreground, background.
const colorsOf = (cells: string) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return Array.from({ length: bytes.length / 4 }, (_, i) => view.getUint32(i * 4, true)).filter((_, i) => i % 3 !== 0)
}

// The mate scene's sky blue.
const SKY_BLUE = 0x74acdf

test('a frame of the old scene, still on its way when the person picks another, is not the last one sent', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, { size: 'large' })
  mock.env(on, ENGLISH)
  on('session.usage', usage)
  on('turn.step', answering)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  // The terminal is slow to take a frame of the scene.
  let isSlow = false
  const frames: { at: number; cells: string }[] = []
  on('ui.blit', async (_$, e) => {
    if (e.key === 'meters' && 'cells' in e) {
      if (isSlow) {
        isSlow = false
        await clock.sleep(500)
      }
      frames.push({ at: clock.now(), cells: e.cells })
    }
    return { value: {} }
  })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  // No answer yet: the mug of tea steams, and the mate scene holds still.
  const band = await terminalBand($, { isWorking: false })
  await clock.advance(1_000)
  isSlow = true
  while (isSlow) {
    await clock.advance(33)
  }
  // A frame of the balcony scene is on its way: the person picks the mate scene.
  const panel = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  await panel.select({ key: 'scene', value: 'mate' })
  await panel.unmount()
  await clock.advance(5_000)
  expect(colorsOf(frames.at(-1)?.cells ?? '').includes(SKY_BLUE)).toBe(true)
  expect(colorsOf(String((await band.find({ type: 'Raster', key: 'meters' }))?.props.cells)).includes(SKY_BLUE)).toBe(true)
  await band.unmount()
})

// The widths the band takes at: the pictures, the gaps between them, the
// label beside Clawd, and the columns left clear for `[-]`.
test('the band leaves the top right corner clear for the engine\'s [-], at every width', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, ENGLISH)
  for (const bodyColumns of [160, 90, 70, 40, 20]) {
    const band = await terminalBand($, { isWorking: false, bodyColumns })
    const root = await band.find({ type: 'Box' })
    expect([bodyColumns, root?.props.paddingRight]).toEqual([bodyColumns, 4])
    await band.unmount()
  }
})

test('with the Auto theme the pictures take the terminal\'s own background', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on, { size: 'large' })
  // A terminal with dark text on white, as it tells its programs.
  mock.env(on, { ...ENGLISH, COLORFGBG: '0;15' })
  let theme = 'dark'
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: theme }] as never }))
  on('config.set', (_$, e) => ({ value: e.value }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', usage)
  on('turn.step', answering)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await answer($)
  const scene = async (picked: string) => {
    const previous = theme
    theme = picked
    // As the person picks it in /config.
    await $.config.set({ key: 'theme', value: picked, previous, provider: { plugin: 'engine', tier: 'core' }, origin: { kind: 'composer' } } as never)
    const band = await terminalBand($, { isWorking: false })
    const cells = String((await band.find({ type: 'Raster', key: 'meters' }))?.props.cells)
    await band.unmount()
    return cells
  }
  const dark = await scene('dark')
  const light = await scene('light')
  const auto = await scene('auto')
  expect(light).not.toBe(dark)
  expect(auto).toBe(light)
})

// The languages whose texts Claude Code measures short in a terminal.
const SHORT = LANGS.filter(lang => isMeasuredShort(JSON.stringify(TEXTS[lang])))

test('in Hindi the terminal panel names the languages in English, the desktop panel in their own', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { LANG: 'hi_IN.UTF-8' })
  expect(SHORT).toEqual(['hi'])
  const terminal = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  const options = (await terminal.find({ key: 'language' }))?.props.options as { value: string; label: string }[]
  expect(options.find(o => o.value === 'hi')?.label).toBe('Hindi')
  expect(options.find(o => o.value === 'auto')?.label).toBe('Automatic (Hindi)')
  expect(options.every(o => !isMeasuredShort(o.label))).toBe(true)
  await terminal.unmount()
  const desktop = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'desktop', component: 'Pane', requestId: 'clawd', props: PANEL_PROPS })
  expect(await desktop.find({ type: 'Text', text: `स्वचालित (${TEXTS.hi.name})` })).toBeDefined()
  await desktop.unmount()
})

// `/cozy-clawd-scene` as typed in the composer.
const typed = (args: string) =>
  ({ command: 'cozy-clawd-scene', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

for (const [surfaces, speaks] of [[['terminal'], 'English'], [['desktop'], 'Hindi']] as const) {
  test(`in Hindi, a session drawn on the ${surfaces[0]} declares and answers its commands in ${speaks}`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    mock.env(on, { LANG: 'hi_IN.UTF-8' })
    on('session.surfaces', () => ({ value: surfaces }))
    const declared: string[] = []
    on('command.register', (_$, e) => {
      declared.push(e.description ?? '')
      return { value: { command: e.name } }
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    const t = speaks === 'English' ? TEXTS.en : TEXTS.hi
    expect(declared).toContain(t.panelCommand)
    expect((await $.command.run(typed(''))).text).toMatch(new RegExp(`^${t.sceneIs('balcony').replace(/[.]/g, '\\.')}`))
  })
}

// Clawd's label, ongoing: at the narrowest band that shows the scene, the
// label is whole on its line, or its line holds the longest word of the
// language's labels with the `…` after it.
for (const lang of LANGS.filter(l => !SHORT.includes(l))) {
  test(`in ${TEXTS[lang].name} no word of Clawd's label breaks, nor parts from its …`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    mock.store(on, { language: lang })
    mock.env(on, ENGLISH)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    const t = TEXTS[lang]
    const labels = [...Object.values(t.states), ...Object.values(t.tools).filter((v): v is string => typeof v === 'string')]
    const isSpaced = labels.some(label => label.includes(' '))
    const longest = Math.max(...labels.flatMap(label => (isSpaced ? label.split(' ') : [...label])).map(columnsOf))
    for (let bodyColumns = 60; bodyColumns <= 100; bodyColumns++) {
      const band = await terminalBand($, { isWorking: true, bodyColumns })
      const hasScene = (await band.find({ type: 'Raster', key: 'meters' })) !== undefined
      const labelBox = (await band.findAll({ type: 'Box' })).find(box => typeof box.props.width === 'number')
      await band.unmount()
      if (hasScene) {
        // Clawd sleeps with a turn under way: its label is ongoing.
        const width = Number(labelBox?.props.width)
        expect([bodyColumns, width === columnsOf(`${t.states.sleeping}…`) || width >= longest + 1]).toEqual([bodyColumns, true])
        break
      }
    }
  })
}
