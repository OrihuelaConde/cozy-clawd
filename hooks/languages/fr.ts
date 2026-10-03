// The mod's texts in French. A no-break space ( ) goes before the colon,
// the question mark, and the exclamation mark, as French typography sets them.

import type { Texts } from './en'

export const fr: Texts = {
  name: 'Français',

  states: {
    working: 'Au travail',
    workingOnAnswer: 'Préparation de la réponse',
    thinking: 'Réflexion',
    writing: 'Rédaction',
    preparingTool: 'Préparation d’un outil',
    usingTool: 'Utilisation d’un outil',
    reading: 'Lecture',
    editing: 'Modification',
    runningCommand: 'Exécution d’une commande',
    browsing: 'Navigation',
    launchingSubagent: 'Lancement d’un sous-agent',
    waiting: 'En attente',
    waitingForAnswer: 'En attente de votre réponse',
    waitingForApproval: 'En attente de votre approbation',
    compacting: 'Compactage de la conversation',
    compacted: 'Conversation compactée !',
    worried: 'Inquiet : le cache expire bientôt',
    yawning: 'Somnolent : le cache est sur le point d’expirer',
    sleeping: 'Endormi : le cache a expiré',
  },

  tools: {
    readingFile: 'Lecture d’un fichier',
    searchingCode: 'Recherche dans le code',
    findingFiles: 'Recherche de fichiers',
    lookingAtFolder: 'Examen d’un dossier',
    editingFile: 'Modification d’un fichier',
    editingNotebook: 'Modification d’un notebook',
    writingFile: 'Écriture d’un fichier',
    readingWebPage: 'Lecture d’une page web',
    searchingWeb: 'Recherche sur le web',
    waitingForPlan: 'En attente de votre approbation du plan',
    using: (tool: string) => `Utilisation de ${tool}`,
  },

  scenes: {
    shelf: 'Étagère',
    mate: 'Maté',
    balcony: 'Balcon',
    window: 'Fenêtre de nuit',
    adventure: 'Aventure',
    gamer: 'Gamer',
    cyberpunk: 'Cyberpunk',
    steampunk: 'Steampunk',
  },

  figures: {
    none: 'aucune donnée',
    expired: 'expiré',
    minutes: (n: number) => `${n} min`,
    line: (context: string, cache: string, fiveHour: string, week: string) =>
      `Contexte libre ${context}, cache ${cache}, limite de 5 h disponible ${fiveHour}, semaine disponible ${week}`,
  },

  paneCommand: 'Ouvrir le panneau pour choisir la scène et la langue du bandeau',
  sceneCommand: 'Choisir la scène à droite du bandeau',
  sceneHint: '[scène]',
  paneTitle: 'Scènes',
  paneOpened: 'Panneau des scènes ouvert.',
  sceneIs: (name: string) => `Scène : ${name}.`,
  available: (names: string) => `Disponibles : ${names}.`,
  noScene: (name: string) => `Il n’y a pas de scène « ${name} ».`,
  alreadyScene: (name: string) => `La scène est déjà ${name}.`,
  waitToCompact: 'Clawd : attendez la fin du tour pour compacter.',
  compactAsk: 'Compacter ?',
  yes: 'Oui',
  no: 'Non',
  compact: 'Compacter',
  scene: 'Scène',
  pickScene: 'Choisissez la scène à droite du bandeau.',
  inUse: 'utilisée',
  use: 'Utiliser',
  language: 'Langue',
  auto: (name: string) => `Automatique (${name})`,
}
