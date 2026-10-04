// The mod's texts in English. Every language's file holds the same texts
// under the same keys; this one sets their shape.

export const en = {
  // The language by its own name, as the panel's picker shows it.
  name: 'English',

  // What Clawd is doing, as the band and the panel say it.
  states: {
    working: 'Working',
    workingOnAnswer: 'Working on the answer',
    thinking: 'Thinking',
    writing: 'Writing',
    preparingTool: 'Preparing a tool',
    usingTool: 'Using a tool',
    reading: 'Reading',
    editing: 'Editing',
    runningCommand: 'Running a command',
    browsing: 'Browsing',
    launchingSubagent: 'Launching a subagent',
    waiting: 'Waiting',
    waitingForAnswer: 'Waiting for your answer',
    waitingForApproval: 'Waiting for your approval',
    compacting: 'Compacting the conversation',
    compacted: 'Conversation compacted!',
    worried: 'Worried: the cache expires soon',
    yawning: 'Yawning: the cache is about to expire',
    sleeping: 'Sleeping: the cache expired',
  },

  // What Clawd is doing with each tool; `using` names a tool without a text
  // of its own.
  tools: {
    readingFile: 'Reading a file',
    searchingCode: 'Searching the code',
    findingFiles: 'Finding files',
    lookingAtFolder: 'Looking at a folder',
    editingFile: 'Editing a file',
    editingNotebook: 'Editing a notebook',
    writingFile: 'Writing a file',
    readingWebPage: 'Reading a web page',
    searchingWeb: 'Searching the web',
    waitingForPlan: 'Waiting for you to approve the plan',
    using: (tool: string) => `Using ${tool}`,
  },

  // The scenes of meters, by the names the picker shows.
  scenes: {
    teatime: 'Teatime',
    mate: 'Mate',
    balcony: 'Balcony',
    window: 'Night window',
    adventure: 'Adventure',
    gamer: 'Gamer',
    cyberpunk: 'Cyberpunk',
    steampunk: 'Steampunk',
  },

  // The meters in words, for a reader that can't see the scene. A no-break
  // space (\u00a0) keeps a number with its unit, wherever the words wrap.
  meters: {
    none: 'no data',
    expired: 'expired',
    minutes: (n: number) => `${n}\u00a0min`,
    line: (context: string, cache: string, fiveHour: string, week: string) =>
      `Context free ${context}, cache ${cache}, 5-hour limit free ${fiveHour}, week free ${week}`,
  },

  // The commands, the band's button, and the panel.
  panelCommand: "Open the panel to pick the band's scene and language",
  sceneCommand: "Pick the scene on the band's right",
  sceneHint: '[scene]',
  panelTitle: 'Scenes',
  panelOpened: 'Scenes panel opened.',
  sceneIs: (name: string) => `Scene: ${name}.`,
  available: (names: string) => `Available: ${names}.`,
  noScene: (name: string) => `There is no scene "${name}".`,
  alreadyScene: (name: string) => `The scene is already ${name}.`,
  waitToCompact: 'Clawd: wait for the turn to end before compacting.',
  compactAsk: 'Compact?',
  yes: 'Yes',
  no: 'No',
  compact: 'Compact',
  scene: 'Scene',
  pickScene: "Pick the scene on the band's right.",
  inUse: 'in use',
  use: 'Use',
  language: 'Language',
  // The band's size in the terminal, as the panel's picker names it.
  size: 'Size',
  sizes: { small: 'Small', large: 'Large' },
  auto: (name: string) => `Automatic (${name})`,
}

export type Texts = typeof en
