// The languages the mod speaks, and how it tells which one the person uses.
//
// Claude Code hands a plugin neither the app's language nor the app's own
// translated texts, so the mod carries its texts in each language, one file
// each under `languages/`, and goes by what it can see: the Language row of
// /config, then the locale variables. It speaks the languages the Claude
// desktop app shows.

import type { Lang } from '../types'
import { de } from './languages/de'
import { en, type Texts } from './languages/en'
import { es } from './languages/es'
import { fr } from './languages/fr'
import { hi } from './languages/hi'
import { id } from './languages/id'
import { it } from './languages/it'
import { ja } from './languages/ja'
import { ko } from './languages/ko'
import { pt } from './languages/pt'

export type { Lang, LangChoice } from '../types'
export type { Texts } from './languages/en'

// A text in every language the mod speaks.
export type Words = Record<Lang, string>

// The languages in the order the pane offers them.
export const LANGS: readonly Lang[] = ['es', 'en', 'fr', 'de', 'it', 'pt', 'id', 'hi', 'ja', 'ko']

// Every text the mod shows, by language.
export const TEXTS: Record<Lang, Texts> = { es, en, fr, de, it, pt, id, hi, ja, ko }

// One text in every language, picked from each language's texts.
export const wordsOf = (pick: (t: Texts) => string) => Object.fromEntries(LANGS.map(lang => [lang, pick(TEXTS[lang])])) as Words

// Each language by its own name, as the picker shows it.
export const LANG_NAMES: Words = wordsOf(t => t.name)

// The language the mod falls back on when nothing names one.
export const DEFAULT_LANG: Lang = 'en'

// How a setting names each language: by code, alone or with a region or an
// encoding (`es`, `es_AR.UTF-8`, `pt-BR`), or by name in English, in the
// language itself, or in Spanish. Indonesian also goes by `in`, its old code.
const NAMES: readonly [Lang, RegExp][] = [
  ['es', /^es([-_.@]|$)|^(spanish|espa[nñ]ol|castellano)/],
  ['en', /^en([-_.@]|$)|^(english|ingl[eé]s)/],
  ['fr', /^fr([-_.@]|$)|^(french|fran[cç]ais|franc[eé]s)/],
  ['de', /^de([-_.@]|$)|^(german|deutsch|alem[aá]n)/],
  ['it', /^it([-_.@]|$)|^(italian|italiano)/],
  ['pt', /^pt([-_.@]|$)|^(portuguese|portugu[eê]s)/],
  ['id', /^(id|in)([-_.@]|$)|^(indonesian|bahasa indonesia|indonesio)/],
  ['hi', /^hi([-_.@]|$)|^(hindi|हिन्दी|हिंदी)/],
  ['ja', /^ja([-_.@]|$)|^(japanese|日本語|japon[eé]s)/],
  ['ko', /^ko([-_.@]|$)|^(korean|한국어|coreano)/],
]

// The language a setting names, by code or by name; null for any other, and
// for a default (`Default (English)`, the row's value while the person has
// not set one).
export const langOf = (setting: unknown): Lang | null => {
  if (typeof setting !== 'string') {
    return null
  }
  const s = setting.trim().toLowerCase()

  return NAMES.find(([, name]) => name.test(s))?.[0] ?? null
}
