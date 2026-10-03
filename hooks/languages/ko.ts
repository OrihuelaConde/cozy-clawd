// The mod's texts in Korean.

import type { Texts } from './en'

export const ko: Texts = {
  name: '한국어',

  states: {
    working: '작업 중',
    workingOnAnswer: '답변 작업 중',
    thinking: '생각 중',
    writing: '작성 중',
    preparingTool: '도구 준비 중',
    usingTool: '도구 사용 중',
    reading: '읽는 중',
    editing: '편집 중',
    runningCommand: '명령 실행 중',
    browsing: '웹 탐색 중',
    launchingSubagent: '하위 에이전트 실행 중',
    waiting: '기다리는 중',
    waitingForAnswer: '답변을 기다리는 중',
    waitingForApproval: '승인을 기다리는 중',
    compacting: '대화 압축 중',
    compacted: '대화를 압축했어요!',
    worried: '걱정 중: 캐시가 곧 만료돼요',
    yawning: '하품 중: 캐시가 막 만료되려고 해요',
    sleeping: '자는 중: 캐시가 만료됐어요',
  },

  tools: {
    readingFile: '파일 읽는 중',
    searchingCode: '코드 검색 중',
    findingFiles: '파일 찾는 중',
    lookingAtFolder: '폴더 보는 중',
    editingFile: '파일 편집 중',
    editingNotebook: '노트북 편집 중',
    writingFile: '파일 작성 중',
    readingWebPage: '웹 페이지 읽는 중',
    searchingWeb: '웹 검색 중',
    waitingForPlan: '계획 승인을 기다리는 중',
    using: (tool: string) => `${tool} 사용 중`,
  },

  scenes: {
    shelf: '선반',
    mate: '마테',
    balcony: '발코니',
    window: '밤의 창가',
    adventure: '모험',
    gamer: '게이머',
    cyberpunk: '사이버펑크',
    steampunk: '스팀펑크',
  },

  figures: {
    none: '데이터 없음',
    expired: '만료됨',
    minutes: (n: number) => `${n}분`,
    line: (context: string, cache: string, fiveHour: string, week: string) =>
      `남은 컨텍스트 ${context}, 캐시 ${cache}, 5시간 한도 남은 양 ${fiveHour}, 주간 한도 남은 양 ${week}`,
  },

  paneCommand: '띠의 장면과 언어를 고르는 패널 열기',
  sceneCommand: '띠 오른쪽 장면 고르기',
  sceneHint: '[장면]',
  paneTitle: '장면',
  paneOpened: '장면 패널을 열었어요.',
  sceneIs: (name: string) => `장면: ${name}.`,
  available: (names: string) => `고를 수 있는 장면: ${names}.`,
  noScene: (name: string) => `"${name}" 장면은 없어요.`,
  alreadyScene: (name: string) => `이미 ${name} 장면이에요.`,
  waitToCompact: 'Clawd: 압축하려면 차례가 끝날 때까지 기다려 주세요.',
  compactAsk: '압축할까요?',
  yes: '예',
  no: '아니요',
  compact: '압축',
  scene: '장면',
  pickScene: '띠 오른쪽 장면을 고르세요.',
  inUse: '사용 중',
  use: '사용',
  language: '언어',
  auto: (name: string) => `자동(${name})`,
}
