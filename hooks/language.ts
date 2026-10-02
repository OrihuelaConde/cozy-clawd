// The languages the mod speaks, and how it tells which one the person uses.
//
// Claude Code hands a plugin neither the app's language nor the app's own
// translated texts, so the mod carries its texts in each language and goes by
// what it can see: the Language row of /config, then the locale variables.

import type { Lang } from '../types'

export type { Lang, LangChoice } from '../types'

// A text in every language the mod speaks.
export type Words = Record<Lang, string>

export const LANGS: readonly Lang[] = ['es', 'en']

// Each language by its own name, as the picker shows it.
export const LANG_NAMES: Words = { es: 'Español', en: 'English' }

// The language the mod falls back on when nothing names one.
export const DEFAULT_LANG: Lang = 'en'

// The language a setting names, by code (`es`, `es_AR.UTF-8`, `en-US`) or by
// name (`Spanish`, `español`); null for any other, and for a default
// (`Default (English)`, the row's value while the person has not set one).
export const langOf = (setting: unknown): Lang | null => {
  if (typeof setting !== 'string') {
    return null
  }
  const s = setting.trim().toLowerCase()
  if (/^es([-_.@]|$)|^(spanish|espa[nñ]ol|castellano)/.test(s)) {
    return 'es'
  }
  if (/^en([-_.@]|$)|^(english|ingl[eé]s)/.test(s)) {
    return 'en'
  }

  return null
}
