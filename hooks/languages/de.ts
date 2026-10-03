// The mod's texts in German.

import type { Texts } from './en'

export const de: Texts = {
  name: 'Deutsch',

  states: {
    working: 'Arbeitet',
    workingOnAnswer: 'Arbeitet an der Antwort',
    thinking: 'Denkt nach',
    writing: 'Schreibt',
    preparingTool: 'Bereitet ein Werkzeug vor',
    usingTool: 'Benutzt ein Werkzeug',
    reading: 'Liest',
    editing: 'Bearbeitet',
    runningCommand: 'Führt einen Befehl aus',
    browsing: 'Surft im Web',
    launchingSubagent: 'Startet einen Subagenten',
    waiting: 'Wartet',
    waitingForAnswer: 'Wartet auf deine Antwort',
    waitingForApproval: 'Wartet auf deine Freigabe',
    compacting: 'Komprimiert die Unterhaltung',
    compacted: 'Unterhaltung komprimiert!',
    worried: 'Besorgt: Der Cache läuft bald ab',
    yawning: 'Gähnt: Der Cache läuft gleich ab',
    sleeping: 'Schläft: Der Cache ist abgelaufen',
  },

  tools: {
    readingFile: 'Liest eine Datei',
    searchingCode: 'Durchsucht den Code',
    findingFiles: 'Sucht Dateien',
    lookingAtFolder: 'Sieht sich einen Ordner an',
    editingFile: 'Bearbeitet eine Datei',
    editingNotebook: 'Bearbeitet ein Notebook',
    writingFile: 'Schreibt eine Datei',
    readingWebPage: 'Liest eine Webseite',
    searchingWeb: 'Sucht im Web',
    waitingForPlan: 'Wartet darauf, dass du den Plan freigibst',
    using: (tool: string) => `Benutzt ${tool}`,
  },

  scenes: {
    shelf: 'Regal',
    mate: 'Mate',
    balcony: 'Balkon',
    window: 'Fenster bei Nacht',
    adventure: 'Abenteuer',
    gamer: 'Gamer',
    cyberpunk: 'Cyberpunk',
    steampunk: 'Steampunk',
  },

  figures: {
    none: 'keine Daten',
    expired: 'abgelaufen',
    minutes: (n: number) => `${n}\u00a0Min.`,
    line: (context: string, cache: string, fiveHour: string, week: string) =>
      `Kontext frei ${context}, Cache ${cache}, 5-Stunden-Limit frei ${fiveHour}, Woche frei ${week}`,
  },

  paneCommand: 'Öffne den Bereich, um Szene und Sprache der Leiste zu wählen',
  sceneCommand: 'Wähle die Szene rechts in der Leiste',
  sceneHint: '[Szene]',
  paneTitle: 'Szenen',
  paneOpened: 'Szenenbereich geöffnet.',
  sceneIs: (name: string) => `Szene: ${name}.`,
  available: (names: string) => `Verfügbar: ${names}.`,
  noScene: (name: string) => `Es gibt keine Szene „${name}“.`,
  alreadyScene: (name: string) => `Die Szene ist bereits ${name}.`,
  waitToCompact: 'Clawd: Warte, bis die Antwort fertig ist, um zu komprimieren.',
  compactAsk: 'Komprimieren?',
  yes: 'Ja',
  no: 'Nein',
  compact: 'Komprimieren',
  scene: 'Szene',
  pickScene: 'Wähle die Szene rechts in der Leiste.',
  inUse: 'aktiv',
  use: 'Verwenden',
  language: 'Sprache',
  auto: (name: string) => `Automatisch (${name})`,
}
