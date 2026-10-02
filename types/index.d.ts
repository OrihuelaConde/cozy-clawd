export type ClawdMode =
  | 'idle'
  | 'waiting'
  | 'requesting'
  | 'thinking'
  | 'tool-input'
  | 'tool-use'
  | 'responding'
  | 'compacting'
  | 'compacted'

// The figures the band shows on its right, read after each model request.
export type Stats = {
  // Percent of the context window still free, when the engine has a reading.
  contextLeft: number | null
  // Percent used of the five-hour and seven-day usage limits.
  fiveHour: number | null
  week: number | null
  // When the last main request was answered: the prompt cache counts from it.
  cacheAt: number | null
}

// The languages the mod speaks.
export type Lang = 'es' | 'en'

// The language the person picked in the /cozy-clawd pane, or `auto` to
// follow the one Claude Code shows them.
export type LangChoice = 'auto' | Lang

declare module 'claude-code' {
  interface PluginState {
    'cozy-clawd': {
      mode: ClawdMode
      tool: string | null
      stats: Stats
      // The compact button asked "are you sure?" and waits for the answer.
      isConfirming: boolean
      // Bumped when the cache expires: a write that redraws the band.
      redraws: number
      // The name of the scene the band draws on its right.
      escena: string
      // The language the band, the pane and the commands speak.
      idioma: LangChoice
    }
  }
}
