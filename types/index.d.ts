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

// The meters the band shows on its right, read after each model request.
export type Stats = {
  // Percent of the context window still free, when the engine has a reading.
  contextLeft: number | null
  // Percent used of the five-hour and seven-day usage limits.
  fiveHour: number | null
  week: number | null
  // When each of those windows starts over, in milliseconds since the epoch.
  fiveHourResetsAt: number | null
  weekResetsAt: number | null
  // When the last main request was answered: the prompt cache counts from it.
  cacheAt: number | null
  // How long the prompt cache keeps the conversation, in seconds.
  cacheTtl: number
}

// The languages the mod speaks: those the Claude desktop app shows.
export type Lang = 'es' | 'en' | 'fr' | 'de' | 'it' | 'pt' | 'id' | 'hi' | 'ja' | 'ko'

// The language the person picked in the /cozy-clawd panel, or `auto` to
// follow the one Claude Code shows them.
export type LangChoice = 'auto' | Lang

// How big the band draws its scenes in the terminal: the small ones, half
// the size, or the large ones the desktop app shows.
export type Size = 'small' | 'large'

declare module 'claude-code' {
  interface PluginState {
    'cozy-clawd': {
      mode: ClawdMode
      tool: string | null
      stats: Stats
      // The compact button asked "are you sure?" and waits for the answer.
      isConfirming: boolean
      // Bumped as the cache runs out and as a usage limit starts over: a
      // write that redraws the band.
      redraws: number
      // The name of the scene the band draws on its right.
      sceneName: string
      // The language the band, the panel and the commands speak.
      langChoice: LangChoice
      // How big the band draws its scenes in the terminal.
      sizeName: Size
    }
  }
}
