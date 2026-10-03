// The mod's texts in Hindi.

import type { Texts } from './en'

export const hi: Texts = {
  name: 'हिन्दी',

  states: {
    working: 'काम कर रहा है',
    workingOnAnswer: 'जवाब पर काम कर रहा है',
    thinking: 'सोच रहा है',
    writing: 'लिख रहा है',
    preparingTool: 'टूल तैयार कर रहा है',
    usingTool: 'टूल इस्तेमाल कर रहा है',
    reading: 'पढ़ रहा है',
    editing: 'संपादित कर रहा है',
    runningCommand: 'कमांड चला रहा है',
    browsing: 'वेब ब्राउज़ कर रहा है',
    launchingSubagent: 'सबएजेंट शुरू कर रहा है',
    waiting: 'इंतज़ार कर रहा है',
    waitingForAnswer: 'आपके जवाब का इंतज़ार',
    waitingForApproval: 'आपकी मंज़ूरी का इंतज़ार',
    compacting: 'बातचीत को संक्षिप्त कर रहा है',
    compacted: 'बातचीत संक्षिप्त हो गई!',
    worried: 'चिंतित: कैश जल्द ही खत्म होगा',
    yawning: 'उबासी ले रहा है: कैश बस खत्म होने वाला है',
    sleeping: 'सो रहा है: कैश खत्म हो गया',
  },

  tools: {
    readingFile: 'फ़ाइल पढ़ रहा है',
    searchingCode: 'कोड में खोज रहा है',
    findingFiles: 'फ़ाइलें ढूँढ रहा है',
    lookingAtFolder: 'फ़ोल्डर देख रहा है',
    editingFile: 'फ़ाइल संपादित कर रहा है',
    editingNotebook: 'नोटबुक संपादित कर रहा है',
    writingFile: 'फ़ाइल लिख रहा है',
    readingWebPage: 'वेब पेज पढ़ रहा है',
    searchingWeb: 'वेब पर खोज रहा है',
    waitingForPlan: 'आपके प्लान मंज़ूर करने का इंतज़ार',
    using: (tool: string) => `${tool} इस्तेमाल कर रहा है`,
  },

  scenes: {
    shelf: 'शेल्फ़',
    mate: 'माते',
    balcony: 'बालकनी',
    window: 'रात की खिड़की',
    adventure: 'रोमांच',
    gamer: 'गेमर',
    cyberpunk: 'साइबरपंक',
    steampunk: 'स्टीमपंक',
  },

  figures: {
    none: 'कोई डेटा नहीं',
    expired: 'खत्म',
    minutes: (n: number) => `${n}\u00a0मिनट`,
    line: (context: string, cache: string, fiveHour: string, week: string) =>
      `खाली कॉन्टेक्स्ट ${context}, कैश ${cache}, 5\u00a0घंटे की सीमा में बाकी ${fiveHour}, हफ़्ते में बाकी ${week}`,
  },

  paneCommand: 'पट्टी का दृश्य और भाषा चुनने के लिए पैनल खोलें',
  sceneCommand: 'पट्टी के दाईं ओर का दृश्य चुनें',
  sceneHint: '[दृश्य]',
  paneTitle: 'दृश्य',
  paneOpened: 'दृश्य पैनल खुल गया।',
  sceneIs: (name: string) => `दृश्य: ${name}।`,
  available: (names: string) => `उपलब्ध: ${names}।`,
  noScene: (name: string) => `"${name}" नाम का कोई दृश्य नहीं है।`,
  alreadyScene: (name: string) => `दृश्य पहले से ${name} है।`,
  waitToCompact: 'Clawd: संक्षिप्त करने से पहले बारी खत्म होने दें।',
  compactAsk: 'संक्षिप्त करें?',
  yes: 'हाँ',
  no: 'नहीं',
  compact: 'संक्षिप्त करें',
  scene: 'दृश्य',
  pickScene: 'पट्टी के दाईं ओर का दृश्य चुनें।',
  inUse: 'इस्तेमाल में',
  use: 'इस्तेमाल करें',
  language: 'भाषा',
  auto: (name: string) => `स्वचालित (${name})`,
}
