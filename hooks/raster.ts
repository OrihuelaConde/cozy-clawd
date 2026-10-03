// The terminal draws no SVG, so there the band paints the scenes itself: a
// scene's image is read once into its groups and rects, with their classes and
// CSS animations, then painted at any moment of those animations into the
// cells of a Raster, in one of two layouts:
//
// - `halves`: a cell holds two square pixels, the upper and lower halves of a
//   block character, so a unit of the image's viewBox is a column across and
//   half a row down. Each pixel keeps its color.
// - `quadrants`: a cell holds four pixels, each twice as tall as wide, as
//   Claude Code draws Clawd on its welcome screen, so a unit is half a column
//   across and half a row down. A cell shows two colors: where its pixels
//   have more, each takes the nearer of the two it has most of.
//
// It reads the SVG and CSS the scenes are drawn with, and no more: `svg` (a
// nested one is a window over its content), `g`, `rect`, `text` of one
// character (painted as that character, in the cell that holds its x and
// y), and `clipPath` in `defs`; type, class and descendant selectors; fill,
// opacity, transform (translate and scale), clip-path (`url()` or
// `inset()`), custom properties through `var()`, and animations with their
// keyframes, `steps()` and the cubic timing functions. A scene drawn with
// anything more needs it here too.

// A scene's image as the terminal paints it: its size in cells, and its cells
// at `t` seconds after it was drawn, as a Raster's `cells` (RasterProps).
// `background` is the color translucent pixels are laid over.
export type Picture = {
  columns: number
  rows: number
  paint: (t: number, background: number) => string
}

// x' = a·x + e and y' = d·y + f: the scenes only move and stretch.
type Affine = { a: number; d: number; e: number; f: number }

// An axis-aligned box, from (x0, y0) to (x1, y1).
type Box = { x0: number; y0: number; x1: number; y1: number }

type Clip = { kind: 'none' } | { kind: 'url'; id: string } | { kind: 'inset'; sides: [number, number, number, number] }

// What a node shows at one moment. A fill of null is `none`.
type Values = { fill: number | null; opacity: number; transform: Affine; clip: Clip }

type Prop = 'fill' | 'opacity' | 'transform' | 'clip'

type Track = { offset: number; value: Values[Prop] }[]

type Animation = {
  duration: number
  delay: number
  count: number
  direction: string
  fillMode: string
  timing: (q: number) => number
  tracks: Partial<Record<Prop, Track>>
}

type Node = {
  tag: string
  classes: string[]
  parent: Node | null
  children: Node[]
  // What the cascade gives it, before any animation; a fill left undefined is inherited.
  fill: number | null | undefined
  opacity: number
  transform: Affine
  clip: Clip
  animations: Animation[]
  // A rect's geometry, in its own units.
  rect?: Box
  // A text's one character and where it stands, in its own units.
  char?: { x: number; y: number; code: number }
  // A nested svg: how its content maps into its parent, and the window it shows.
  viewport?: { map: Affine; window: Box | null }
}

type Raw = { tag: string; attrs: Record<string, string>; children: Raw[]; text: string }

type Decl = [string, string]

// One compound of a selector: a type, or any, with classes.
type Compound = { tag: string | null; classes: string[] }

type Rule = { selector: Compound[]; specificity: number; order: number; decls: Decl[] }

type Frame = { offsets: number[]; decls: Decl[] }

const IDENTITY: Affine = { a: 1, d: 1, e: 0, f: 0 }
const NO_CLIP: Clip = { kind: 'none' }

// A translucent pixel this faint over nothing is left out: laid over a
// background that may not be the terminal's own, it would show as a smudge.
const MIN_ALPHA = 0.1

// The terminal's own color, where nothing is painted.
const DEFAULT_COLOR = 0x01000000

const SPACE = 0x20
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const FULL_BLOCK = 0x2588

// The quadrant characters by the pixels they fill: bit 0 the top left, bit 1
// the top right, bit 2 the bottom left, bit 3 the bottom right.
const QUADRANTS = [SPACE, 0x2598, 0x259d, UPPER_HALF, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, LOWER_HALF, 0x2599, 0x259f, FULL_BLOCK]

// How a picture lays its pixels in cells (see the top of this file).
export type Layout = 'halves' | 'quadrants'

const distance = (a: number, b: number) => [16, 8, 0].reduce((sum, shift) => sum + (((a >> shift) & 0xff) - ((b >> shift) & 0xff)) ** 2, 0)

// `n` applied first, then `m`.
const compose = (m: Affine, n: Affine): Affine => ({ a: m.a * n.a, d: m.d * n.d, e: m.a * n.e + m.e, f: m.d * n.f + m.f })

const mapBox = (m: Affine, b: Box): Box => {
  const xs = [m.a * b.x0 + m.e, m.a * b.x1 + m.e]
  const ys = [m.d * b.y0 + m.f, m.d * b.y1 + m.f]
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

const union = (a: Box | null, b: Box | null): Box | null =>
  a === null ? b : b === null ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }

const numbers = (text: string) =>
  text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(n => parseFloat(n))

// A transform list (`translate(1px, 0) scale(1 2)`) as one affine map; a
// function other than translate and scale is left out.
const transformOf = (text: string): Affine => {
  let m = IDENTITY
  for (const [, fn, args] of text.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)) {
    const [x = 0, y] = numbers(args ?? '')
    const step: Affine | null =
      fn === 'translate'
        ? { a: 1, d: 1, e: x, f: y ?? 0 }
        : fn === 'translateX'
          ? { a: 1, d: 1, e: x, f: 0 }
          : fn === 'translateY'
            ? { a: 1, d: 1, e: 0, f: x }
            : fn === 'scale'
              ? { a: x, d: y ?? x, e: 0, f: 0 }
              : fn === 'scaleX'
                ? { a: x, d: 1, e: 0, f: 0 }
                : fn === 'scaleY'
                  ? { a: 1, d: x, e: 0, f: 0 }
                  : null
    if (step !== null) {
      m = compose(m, step)
    }
  }
  return m
}

const NAMED_COLORS: Record<string, number> = { black: 0x000000, white: 0xffffff }

// A fill: a color, null for none, undefined for what this reader does not know.
const colorOf = (text: string): number | null | undefined => {
  const v = text.trim().toLowerCase()
  if (v === 'none' || v === 'transparent') {
    return null
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)?.[1]
  if (hex !== undefined) {
    return parseInt(hex.length === 3 ? [...hex].map(c => c + c).join('') : hex, 16)
  }
  return NAMED_COLORS[v]
}

const clipOf = (text: string): Clip => {
  const url = /url\(\s*#([^)\s]+)\s*\)/.exec(text)?.[1]
  if (url !== undefined) {
    return { kind: 'url', id: url }
  }
  const inset = /inset\(([^)]*)\)/.exec(text)?.[1]
  if (inset !== undefined) {
    const [top = 0, right = top, bottom = top, left = right] = numbers(inset)
    return { kind: 'inset', sides: [top, right, bottom, left] }
  }
  return NO_CLIP
}

const seconds = (text: string) => (text.endsWith('ms') ? parseFloat(text) / 1000 : parseFloat(text) || 0)

// The timing functions, as maps of an interval's progress.
const CUBIC: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const at = (p1: number, p2: number, s: number) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3
  return (q: number) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < q) {
        lo = mid
      } else {
        hi = mid
      }
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

const stepsOf = (n: number, position: string) => (q: number) => {
  const jumps = position === 'jump-none' ? n - 1 : position === 'jump-both' ? n + 1 : n
  let step = Math.floor(q * n)
  if (position === 'start' || position === 'jump-start' || position === 'jump-both') {
    step += 1
  }
  return Math.min(Math.max(step, 0), jumps) / Math.max(jumps, 1)
}

const timingOf = (text: string): ((q: number) => number) => {
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*([\w-]+)\s*)?\)$/.exec(text)
  if (steps !== null) {
    return stepsOf(Number(steps[1]), steps[2] ?? 'end')
  }
  if (text === 'step-start' || text === 'step-end') {
    return stepsOf(1, text === 'step-start' ? 'start' : 'end')
  }
  if (text === 'linear') {
    return q => q
  }
  const cubic = /^cubic-bezier\(([^)]*)\)$/.exec(text)?.[1]
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = cubic !== undefined ? numbers(cubic) : (CUBIC[text] ?? CUBIC.ease ?? [])
  return bezier(x1, y1, x2, y2)
}

// Commas between animations, not those inside a function's parentheses.
const layers = (text: string) => {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    depth += c === '(' ? 1 : c === ')' ? -1 : 0
    if (c === ',' && depth === 0) {
      out.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(text.slice(start).trim())
  return out.filter(Boolean)
}

const TIMINGS = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\(.*\)|cubic-bezier\(.*\))$/
const DIRECTIONS = new Set(['normal', 'reverse', 'alternate', 'alternate-reverse'])
const FILL_MODES = new Set(['none', 'forwards', 'backwards', 'both'])

// The animation properties of a node, one list each, as the longhands are.
type AnimationLists = { names: string[]; durations: string[]; delays: string[]; timings: string[]; counts: string[]; directions: string[]; fillModes: string[] }

const NO_ANIMATIONS: AnimationLists = { names: [], durations: ['0s'], delays: ['0s'], timings: ['ease'], counts: ['1'], directions: ['normal'], fillModes: ['none'] }

// The `animation` shorthand: every longhand set again, as CSS does.
const shorthand = (text: string): AnimationLists => {
  const lists: AnimationLists = { names: [], durations: [], delays: [], timings: [], counts: [], directions: [], fillModes: [] }
  for (const layer of layers(text)) {
    const tokens = layer.match(/[\w.-]+\([^)]*\)|[^\s]+/g) ?? []
    let duration = '0s'
    let delay = '0s'
    let times = 0
    let timing = 'ease'
    let count = '1'
    let direction = 'normal'
    let fillMode = 'none'
    let name = 'none'
    for (const token of tokens) {
      if (/^-?[\d.]+m?s$/.test(token)) {
        if (times++ === 0) {
          duration = token
        } else {
          delay = token
        }
      } else if (TIMINGS.test(token)) {
        timing = token
      } else if (token === 'infinite' || /^[\d.]+$/.test(token)) {
        count = token
      } else if (DIRECTIONS.has(token)) {
        direction = token
      } else if (FILL_MODES.has(token) && token !== 'none') {
        fillMode = token
      } else if (token !== 'running' && token !== 'paused') {
        name = token
      }
    }
    lists.names.push(name)
    lists.durations.push(duration)
    lists.delays.push(delay)
    lists.timings.push(timing)
    lists.counts.push(count)
    lists.directions.push(direction)
    lists.fillModes.push(fillMode)
  }
  return lists
}

const LONGHANDS: Record<string, keyof AnimationLists> = {
  'animation-name': 'names',
  'animation-duration': 'durations',
  'animation-delay': 'delays',
  'animation-timing-function': 'timings',
  'animation-iteration-count': 'counts',
  'animation-direction': 'directions',
  'animation-fill-mode': 'fillModes',
}

const parseDecls = (text: string): Decl[] =>
  text.split(';').flatMap((d): Decl[] => {
    const i = d.indexOf(':')
    return i < 0 ? [] : [[d.slice(0, i).trim(), d.slice(i + 1).trim()]]
  })

// A selector of compounds joined by spaces; null for one this reader cannot match.
const selectorOf = (text: string): Compound[] | null => {
  const compounds = text.trim().split(/\s+/).map(part => /^([a-zA-Z*][\w-]*)?((?:\.[\w-]+)*)$/.exec(part))
  if (compounds.some(c => c === null || c[0] === '')) {
    return null
  }
  return compounds.map(c => ({ tag: c?.[1] ?? null, classes: (c?.[2] ?? '').split('.').filter(Boolean) }))
}

const offsetsOf = (text: string) =>
  text.split(',').map(s => {
    const v = s.trim()
    return v === 'from' ? 0 : v === 'to' ? 1 : parseFloat(v) / 100
  })

const parseCss = (text: string) => {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const keyframes = new Map<string, Frame[]>()
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) {
      break
    }
    const head = css.slice(i, open).trim()
    if (head.startsWith('@keyframes')) {
      const frames: Frame[] = []
      let j = open + 1
      for (;;) {
        const close = css.indexOf('}', j)
        const inner = css.indexOf('{', j)
        if (close < 0) {
          j = css.length
          break
        }
        if (inner < 0 || close < inner) {
          j = close + 1
          break
        }
        const end = css.indexOf('}', inner)
        frames.push({ offsets: offsetsOf(css.slice(j, inner)), decls: parseDecls(css.slice(inner + 1, end < 0 ? css.length : end)) })
        j = end < 0 ? css.length : end + 1
      }
      keyframes.set(head.slice('@keyframes'.length).trim(), frames)
      i = j
    } else {
      const close = css.indexOf('}', open)
      const end = close < 0 ? css.length : close
      const decls = parseDecls(css.slice(open + 1, end))
      for (const part of head.split(',')) {
        const selector = selectorOf(part)
        if (selector !== null) {
          const specificity = selector.reduce((n, c) => n + c.classes.length * 100 + (c.tag !== null && c.tag !== '*' ? 1 : 0), 0)
          rules.push({ selector, specificity, order: rules.length, decls })
        }
      }
      i = end + 1
    }
  }
  rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order)
  return { rules, keyframes }
}

const parseXml = (text: string): Raw => {
  const root: Raw = { tag: '#document', attrs: {}, children: [], text: '' }
  const stack = [root]
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  for (const m of text.matchAll(tokens)) {
    const top = stack[stack.length - 1] ?? root
    if (m[5] !== undefined) {
      top.text += m[5]
    } else if (m[2] === undefined) {
      continue
    } else if (m[1] === '/') {
      if (stack.length > 1) {
        stack.pop()
      }
    } else {
      const attrs: Record<string, string> = {}
      for (const a of (m[3] ?? '').matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs[a[1] ?? ''] = a[2] ?? a[3] ?? ''
      }
      const node: Raw = { tag: m[2], attrs, children: [], text: '' }
      top.children.push(node)
      if (m[4] !== '/') {
        stack.push(node)
      }
    }
  }
  return root
}

const matchesCompound = (c: Compound, node: Node) =>
  (c.tag === null || c.tag === '*' || c.tag === node.tag) && c.classes.every(k => node.classes.includes(k))

const matches = (selector: Compound[], node: Node) => {
  let k = selector.length - 1
  const last = selector[k]
  if (last === undefined || !matchesCompound(last, node)) {
    return false
  }
  let n = node.parent
  for (k--; k >= 0; k--) {
    const c = selector[k]
    while (n !== null && c !== undefined && !matchesCompound(c, n)) {
      n = n.parent
    }
    if (n === null) {
      return false
    }
    n = n.parent
  }
  return true
}

const boxOf = (attrs: Record<string, string>, x: string, y: string, w: string, h: string): Box => {
  const x0 = parseFloat(attrs[x] ?? '0') || 0
  const y0 = parseFloat(attrs[y] ?? '0') || 0
  return { x0, y0, x1: x0 + (parseFloat(attrs[w] ?? '0') || 0), y1: y0 + (parseFloat(attrs[h] ?? '0') || 0) }
}

const valueOf = (prop: Prop, text: string): Values[Prop] | undefined =>
  prop === 'fill' ? colorOf(text) : prop === 'opacity' ? Math.min(1, Math.max(0, parseFloat(text))) : prop === 'transform' ? (text === 'none' ? IDENTITY : transformOf(text)) : clipOf(text)

const PROPS: Record<string, Prop> = { fill: 'fill', opacity: 'opacity', transform: 'transform', 'clip-path': 'clip' }

// The tracks of a set of keyframes, one per property, each in order of offset.
const tracksOf = (frames: Frame[]) => {
  const tracks: Partial<Record<Prop, Track>> = {}
  for (const frame of frames) {
    for (const [name, text] of frame.decls) {
      const prop = PROPS[name]
      const value = prop === undefined ? undefined : valueOf(prop, text)
      if (prop === undefined || value === undefined || Number.isNaN(value)) {
        continue
      }
      const track = (tracks[prop] ??= [])
      for (const offset of frame.offsets) {
        const same = track.findIndex(k => k.offset === offset)
        if (same >= 0) {
          track.splice(same, 1)
        }
        track.push({ offset, value })
      }
    }
  }
  for (const track of Object.values(tracks)) {
    track.sort((a, b) => a.offset - b.offset)
  }
  return tracks
}

const lerp = (a: number, b: number, q: number) => a + (b - a) * q

const lerpColor = (a: number, b: number, q: number) =>
  [16, 8, 0].reduce((c, shift) => c | (Math.round(lerp((a >> shift) & 0xff, (b >> shift) & 0xff, q)) << shift), 0)

const interpolate = (prop: Prop, a: Values[Prop], b: Values[Prop], q: number): Values[Prop] => {
  if (prop === 'opacity' && typeof a === 'number' && typeof b === 'number') {
    return lerp(a, b, q)
  }
  if (prop === 'fill' && typeof a === 'number' && typeof b === 'number') {
    return lerpColor(a, b, q)
  }
  if (prop === 'transform' && typeof a === 'object' && a !== null && 'a' in a && typeof b === 'object' && b !== null && 'a' in b) {
    return { a: lerp(a.a, b.a, q), d: lerp(a.d, b.d, q), e: lerp(a.e, b.e, q), f: lerp(a.f, b.f, q) }
  }
  if (prop === 'clip' && typeof a === 'object' && a !== null && 'kind' in a && typeof b === 'object' && b !== null && 'kind' in b) {
    if (a.kind === 'inset' && b.kind === 'inset') {
      return { kind: 'inset', sides: [0, 1, 2, 3].map(i => lerp(a.sides[i] ?? 0, b.sides[i] ?? 0, q)) as [number, number, number, number] }
    }
    // An inset of nothing stands in for no clip, so a clip can grow from none.
    const none: Clip = { kind: 'inset', sides: [0, 0, 0, 0] }
    if (a.kind === 'inset' && b.kind === 'none') {
      return interpolate(prop, a, none, q)
    }
    if (a.kind === 'none' && b.kind === 'inset') {
      return interpolate(prop, none, b, q)
    }
  }
  return q < 0.5 ? a : b
}

// Where an animation is at `t`, as its directed progress through the current
// iteration from 0 to 1; null while it has no effect.
const progressOf = (anim: Animation, t: number): number | null => {
  const local = t - anim.delay
  const active = anim.duration > 0 ? anim.duration * anim.count : 0
  let iteration: number
  let frac: number
  if (local < 0) {
    if (anim.fillMode !== 'backwards' && anim.fillMode !== 'both') {
      return null
    }
    iteration = 0
    frac = 0
  } else if (local >= active) {
    if (anim.fillMode !== 'forwards' && anim.fillMode !== 'both') {
      return null
    }
    const isWhole = anim.count % 1 === 0 || anim.duration <= 0
    iteration = isWhole ? Math.max(0, anim.count - 1) : Math.floor(anim.count)
    frac = isWhole ? 1 : anim.count % 1
  } else {
    iteration = Math.floor(local / anim.duration)
    frac = local / anim.duration - iteration
  }
  const isOdd = iteration % 2 === 1
  const isReverse =
    anim.direction === 'reverse' || (anim.direction === 'alternate' && isOdd) || (anim.direction === 'alternate-reverse' && !isOdd)
  return isReverse ? 1 - frac : frac
}

const sample = (prop: Prop, track: Track, p: number, underlying: Values[Prop], timing: (q: number) => number) => {
  const frames = [...track]
  if ((frames[0]?.offset ?? 1) > 0) {
    frames.unshift({ offset: 0, value: underlying })
  }
  if ((frames[frames.length - 1]?.offset ?? 0) < 1) {
    frames.push({ offset: 1, value: underlying })
  }
  let i = 0
  while (i < frames.length - 2 && (frames[i + 1]?.offset ?? 1) <= p) {
    i++
  }
  const from = frames[i]
  const to = frames[i + 1] ?? from
  if (from === undefined || to === undefined) {
    return underlying
  }
  const span = to.offset - from.offset
  const q = span > 0 ? Math.min(1, Math.max(0, (p - from.offset) / span)) : 1
  return interpolate(prop, from.value, to.value, timing(q))
}

const valuesAt = (node: Node, t: number, inherited: number | null): Values => {
  const values: Values = { fill: node.fill === undefined ? inherited : node.fill, opacity: node.opacity, transform: node.transform, clip: node.clip }
  for (const anim of node.animations) {
    const p = progressOf(anim, t)
    if (p === null) {
      continue
    }
    for (const [prop, track] of Object.entries(anim.tracks) as [Prop, Track][]) {
      const v = sample(prop, track, p, values[prop], anim.timing)
      if (prop === 'fill') {
        values.fill = v as Values['fill']
      } else if (prop === 'opacity') {
        values.opacity = v as number
      } else if (prop === 'transform') {
        values.transform = v as Affine
      } else {
        values.clip = v as Clip
      }
    }
  }
  return values
}

// Turns the parsed image into nodes with what the cascade gives each.
const build = (raw: Raw, parent: Node | null, sheet: ReturnType<typeof parseCss>, vars: Map<string, string>, ids: Map<string, Node>, trackCache: Map<string, Partial<Record<Prop, Track>>>): Node => {
  const node: Node = {
    tag: raw.tag,
    classes: (raw.attrs.class ?? '').split(/\s+/).filter(Boolean),
    parent,
    children: [],
    fill: undefined,
    opacity: 1,
    transform: IDENTITY,
    clip: NO_CLIP,
    animations: [],
  }
  // Presentation attributes first: any rule or style overrides them.
  const decls: Decl[] = []
  for (const attr of ['fill', 'opacity', 'transform', 'clip-path']) {
    const value = raw.attrs[attr]
    if (value !== undefined) {
      decls.push([attr, value])
    }
  }
  for (const rule of sheet.rules) {
    if (matches(rule.selector, node)) {
      decls.push(...rule.decls)
    }
  }
  decls.push(...parseDecls(raw.attrs.style ?? ''))

  const ownVars = new Map(vars)
  for (const [prop, value] of decls) {
    if (prop.startsWith('--')) {
      ownVars.set(prop, value)
    }
  }
  const resolve = (text: string) => text.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => ownVars.get(name) ?? fallback ?? '')

  let lists = NO_ANIMATIONS
  for (const [prop, raw] of decls) {
    const value = resolve(raw)
    const longhand = LONGHANDS[prop]
    if (prop === 'fill') {
      const color = colorOf(value)
      if (color !== undefined) {
        node.fill = color
      }
    } else if (prop === 'opacity') {
      const n = parseFloat(value)
      if (!Number.isNaN(n)) {
        node.opacity = Math.min(1, Math.max(0, n))
      }
    } else if (prop === 'transform') {
      node.transform = value === 'none' ? IDENTITY : transformOf(value)
    } else if (prop === 'clip-path') {
      node.clip = clipOf(value)
    } else if (prop === 'animation') {
      lists = shorthand(value)
    } else if (longhand !== undefined) {
      lists = { ...lists, [longhand]: layers(value) }
    }
  }
  lists.names.forEach((name, i) => {
    const frames = sheet.keyframes.get(name)
    if (frames === undefined) {
      return
    }
    const pick = (list: string[], fallback: string) => list[i % Math.max(1, list.length)] ?? fallback
    let tracks = trackCache.get(name)
    if (tracks === undefined) {
      tracks = tracksOf(frames)
      trackCache.set(name, tracks)
    }
    const count = pick(lists.counts, '1')
    node.animations.push({
      duration: seconds(pick(lists.durations, '0s')),
      delay: seconds(pick(lists.delays, '0s')),
      count: count === 'infinite' ? Infinity : parseFloat(count) || 0,
      direction: pick(lists.directions, 'normal'),
      fillMode: pick(lists.fillModes, 'none'),
      timing: timingOf(pick(lists.timings, 'ease')),
      tracks,
    })
  })

  if (raw.tag === 'rect') {
    node.rect = boxOf(raw.attrs, 'x', 'y', 'width', 'height')
  }
  const code = raw.tag === 'text' ? raw.text.trim().codePointAt(0) : undefined
  if (code !== undefined) {
    node.char = { x: parseFloat(raw.attrs.x ?? '0') || 0, y: parseFloat(raw.attrs.y ?? '0') || 0, code }
  }
  if (raw.tag === 'svg' && parent !== null) {
    const port = boxOf(raw.attrs, 'x', 'y', 'width', 'height')
    const view = numbers(raw.attrs.viewBox ?? '')
    const [vx = 0, vy = 0, vw = port.x1 - port.x0, vh = port.y1 - port.y0] = view
    const map = { a: vw > 0 ? (port.x1 - port.x0) / vw : 1, d: vh > 0 ? (port.y1 - port.y0) / vh : 1, e: 0, f: 0 }
    map.e = port.x0 - vx * map.a
    map.f = port.y0 - vy * map.d
    node.viewport = { map, window: raw.attrs.overflow === 'visible' ? null : port }
  }
  const id = raw.attrs.id
  if (id !== undefined) {
    ids.set(id, node)
  }
  node.children = raw.children.map(child => build(child, node, sheet, ownVars, ids, trackCache))
  return node
}

// Nothing of these is painted where it stands.
const UNPAINTED = new Set(['defs', 'clipPath', 'style', 'title', 'desc', 'mask', 'linearGradient', 'radialGradient'])

// A node's extent in its own coordinates at `t`: what an inset() clips.
const extentOf = (node: Node, t: number, fill: number | null): Box | null => {
  let box: Box | null = node.rect ?? null
  for (const child of node.children) {
    if (UNPAINTED.has(child.tag)) {
      continue
    }
    const v = valuesAt(child, t, fill)
    const inner = extentOf(child, t, v.fill)
    const map = child.viewport === undefined ? v.transform : compose(v.transform, child.viewport.map)
    box = union(box, inner === null ? null : mapBox(map, inner))
  }
  return box
}

// The pixels whose centers lie in any of `boxes` (in pixels), and in `within`.
const maskOf = (boxes: Box[], width: number, height: number, within: Uint8Array | null) => {
  const mask = new Uint8Array(width * height)
  for (const b of boxes) {
    for (let y = Math.max(0, Math.ceil(b.y0 - 0.5 - 1e-9)); y < Math.min(height, Math.ceil(b.y1 - 0.5 - 1e-9)); y++) {
      for (let x = Math.max(0, Math.ceil(b.x0 - 0.5 - 1e-9)); x < Math.min(width, Math.ceil(b.x1 - 0.5 - 1e-9)); x++) {
        mask[y * width + x] = within === null ? 1 : (within[y * width + x] ?? 0)
      }
    }
  }
  return mask
}

// The pixels painted so far, and the characters to lay over them, in pixels.
type Canvas = { width: number; height: number; rgba: Float64Array; ids: Map<string, Node>; chars: { x: number; y: number; code: number; color: number }[] }

const paintNode = (canvas: Canvas, node: Node, t: number, m: Affine, alpha: number, fill: number | null, within: Uint8Array | null) => {
  if (UNPAINTED.has(node.tag)) {
    return
  }
  const v = valuesAt(node, t, fill)
  const a = alpha * v.opacity
  if (a <= 1e-4) {
    return
  }
  const own = compose(m, v.transform)
  let mask = within
  if (node.viewport?.window) {
    mask = maskOf([mapBox(own, node.viewport.window)], canvas.width, canvas.height, mask)
  }
  const inner = node.viewport === undefined ? own : compose(own, node.viewport.map)
  if (v.clip.kind === 'url') {
    const ref = canvas.ids.get(v.clip.id)
    const boxes = (ref?.children ?? []).flatMap(c => (c.rect === undefined ? [] : [mapBox(compose(inner, c.transform), c.rect)]))
    mask = maskOf(boxes, canvas.width, canvas.height, mask)
  } else if (v.clip.kind === 'inset') {
    const box = extentOf(node, t, v.fill)
    if (box === null) {
      return
    }
    const [top, right, bottom, left] = v.clip.sides
    mask = maskOf([mapBox(inner, { x0: box.x0 + left, y0: box.y0 + top, x1: box.x1 - right, y1: box.y1 - bottom })], canvas.width, canvas.height, mask)
  }
  if (node.rect !== undefined && v.fill !== null) {
    const b = mapBox(inner, node.rect)
    const r = (v.fill >> 16) & 0xff
    const g = (v.fill >> 8) & 0xff
    const bl = v.fill & 0xff
    for (let y = Math.max(0, Math.ceil(b.y0 - 0.5 - 1e-9)); y < Math.min(canvas.height, Math.ceil(b.y1 - 0.5 - 1e-9)); y++) {
      for (let x = Math.max(0, Math.ceil(b.x0 - 0.5 - 1e-9)); x < Math.min(canvas.width, Math.ceil(b.x1 - 0.5 - 1e-9)); x++) {
        const k = y * canvas.width + x
        if (mask !== null && !mask[k]) {
          continue
        }
        const p = k * 4
        const rgba = canvas.rgba
        rgba[p] = r * a + (rgba[p] ?? 0) * (1 - a)
        rgba[p + 1] = g * a + (rgba[p + 1] ?? 0) * (1 - a)
        rgba[p + 2] = bl * a + (rgba[p + 2] ?? 0) * (1 - a)
        rgba[p + 3] = a + (rgba[p + 3] ?? 0) * (1 - a)
      }
    }
  }
  // A character shows whole or not at all.
  if (node.char !== undefined && v.fill !== null && a >= 0.5) {
    const at = mapBox(inner, { x0: node.char.x, y0: node.char.y, x1: node.char.x, y1: node.char.y })
    canvas.chars.push({ x: at.x0, y: at.y0, code: node.char.code, color: v.fill })
  }
  for (const child of node.children) {
    paintNode(canvas, child, t, inner, a, v.fill, mask)
  }
}

const toBase64 = (bytes: Uint8Array) => {
  const own = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (typeof own === 'function') {
    return own.call(bytes)
  }
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return (globalThis as unknown as { btoa: (s: string) => string }).btoa(text)
}

// The character and colors of a cell of quadrants, from its four pixels: the
// two colors most of them have, the others taking the nearer of those. Only
// the background can be the terminal's own color, which counts as
// `background` for nearness.
const quadrantCell = (pixels: number[], background: number): [number, number, number] => {
  const counts = new Map<number, number>()
  for (const c of pixels) {
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const [most = DEFAULT_COLOR, other = most] = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const [fg, bg] = most === DEFAULT_COLOR ? [other, most] : [most, other]
  if (fg === DEFAULT_COLOR) {
    return [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
  }
  const near = (c: number) => (c === DEFAULT_COLOR ? background : c)
  const mask = pixels.reduce((m, c, i) => (c === fg || (c !== bg && distance(near(c), near(fg)) < distance(near(c), near(bg))) ? m | (1 << i) : m), 0)
  return mask === 0b1111 ? [FULL_BLOCK, fg, fg] : [QUADRANTS[mask] ?? SPACE, fg, bg]
}

// Reads a scene's image into a picture the terminal can paint.
export const compile = (svg: string, layout: Layout = 'halves'): Picture => {
  const doc = parseXml(svg)
  const rootRaw = doc.children.find(c => c.tag === 'svg') ?? { tag: 'svg', attrs: {}, children: [], text: '' }
  const styles: string[] = []
  const collect = (raw: Raw) => {
    if (raw.tag === 'style') {
      styles.push(raw.text)
    }
    raw.children.forEach(collect)
  }
  collect(rootRaw)
  const sheet = parseCss(styles.join('\n'))
  const ids = new Map<string, Node>()
  const root = build(rootRaw, null, sheet, new Map(), ids, new Map())
  const [vx = 0, vy = 0, vw = 0, vh = 0] = numbers(rootRaw.attrs.viewBox ?? '')
  const width = Math.max(1, Math.round(vw))
  const height = Math.max(2, Math.round(vh))
  const across = layout === 'quadrants' ? 2 : 1
  const columns = Math.ceil(width / across)
  const rows = Math.ceil(height / 2)
  const origin: Affine = { a: 1, d: 1, e: -vx, f: -vy }

  const paint = (t: number, background: number) => {
    const canvas: Canvas = { width: columns * across, height: rows * 2, rgba: new Float64Array(columns * across * rows * 2 * 4), ids, chars: [] }
    paintNode(canvas, root, t, origin, 1, 0x000000, null)
    const base = [(background >> 16) & 0xff, (background >> 8) & 0xff, background & 0xff]
    const colorAt = (x: number, y: number) => {
      // The cells round the image up; what lies beyond its viewBox stays unpainted.
      if (x >= width || y >= height) {
        return DEFAULT_COLOR
      }
      const p = (y * canvas.width + x) * 4
      const a = canvas.rgba[p + 3] ?? 0
      if (a < MIN_ALPHA) {
        return DEFAULT_COLOR
      }
      return [0, 1, 2].reduce((c, i) => (c << 8) | Math.min(255, Math.round((canvas.rgba[p + i] ?? 0) + (base[i] ?? 0) * (1 - a))), 0)
    }
    const cells: [number, number, number][] = []
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if (layout === 'quadrants') {
          const [x, y] = [column * 2, row * 2]
          cells.push(quadrantCell([colorAt(x, y), colorAt(x + 1, y), colorAt(x, y + 1), colorAt(x + 1, y + 1)], background))
          continue
        }
        const top = colorAt(column, row * 2)
        const bottom = colorAt(column, row * 2 + 1)
        cells.push(
          top === DEFAULT_COLOR && bottom === DEFAULT_COLOR
            ? [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
            : top === bottom
              ? [FULL_BLOCK, top, top]
              : top === DEFAULT_COLOR
                ? [LOWER_HALF, bottom, DEFAULT_COLOR]
                : [UPPER_HALF, top, bottom],
        )
      }
    }
    // A character takes its cell, over the cell's color where it has one.
    for (const char of canvas.chars) {
      const [column, row] = [Math.floor(char.x / across), Math.floor(char.y / 2)]
      const under = cells[row * columns + column]
      if (column >= 0 && column < columns && row >= 0 && row < rows && under !== undefined) {
        cells[row * columns + column] = [char.code, char.color, under[0] === SPACE ? DEFAULT_COLOR : under[1]]
      }
    }
    const view = new DataView(new ArrayBuffer(columns * rows * 12))
    cells.forEach(([code, fg, bg], i) => {
      view.setUint32(i * 12, code, true)
      view.setUint32(i * 12 + 4, fg, true)
      view.setUint32(i * 12 + 8, bg, true)
    })
    return toBase64(new Uint8Array(view.buffer))
  }

  return { columns, rows, paint }
}

// A line of text as a Raster's cells, a column a character, in `color` over
// the terminal's own.
export const textCells = (line: string, color: number) => {
  const chars = [...line]
  const view = new DataView(new ArrayBuffer(chars.length * 12))
  chars.forEach((char, i) => {
    view.setUint32(i * 12, char.codePointAt(0) ?? SPACE, true)
    view.setUint32(i * 12 + 4, color, true)
    view.setUint32(i * 12 + 8, DEFAULT_COLOR, true)
  })
  return toBase64(new Uint8Array(view.buffer))
}

// The pictures read last, so a band drawn again with the same image reads it once.
const pictures = new Map<string, Picture>()
const KEPT_PICTURES = 24

export const pictureOf = (svg: string, layout: Layout = 'halves'): Picture => {
  const key = `${layout} ${svg}`
  const kept = pictures.get(key)
  if (kept !== undefined) {
    return kept
  }
  const picture = compile(svg, layout)
  pictures.set(key, picture)
  if (pictures.size > KEPT_PICTURES) {
    const oldest = pictures.keys().next().value
    if (oldest !== undefined) {
      pictures.delete(oldest)
    }
  }
  return picture
}

// How many columns a text takes in a terminal: two for a wide character
// (Chinese, Japanese and Korean script, fullwidth forms, most emoji), none for
// a mark that sits on the character before it, one for the rest.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1f300}-\u{1f64f}\u{1f900}-\u{1f9ff}\u{20000}-\u{3fffd}]/u
const ZERO_WIDTH = /[\p{Mn}\p{Me}​-‏]/u

export const columnsOf = (text: string) => {
  let columns = 0
  for (const char of text) {
    columns += ZERO_WIDTH.test(char) ? 0 : WIDE.test(char) ? 2 : 1
  }
  return columns
}

// Whether Claude Code counts the text shorter than a terminal draws it: it
// lays out a spacing mark (Devanagari's ि or ा) as taking no column, where a
// terminal gives it one.
export const isMeasuredShort = (text: string) => /\p{Mc}/u.test(text)
