import type { Question } from './game'

const STORAGE_KEY = 'atlas-sprint-progress-v1'

export type Progress = {
  xp: number
  streak: number
  lastActiveDate: string | null
  todayDate: string
  todayAnswered: number
  totalAnswered: number
  totalCorrect: number
  bestCombo: number
  correctByKind: Record<string, number>
  mastery: Record<string, number>
}

export type AnswerResult = {
  progress: Progress
  leveledUp: boolean
}

const todayKey = () => new Date().toISOString().slice(0, 10)

const yesterdayKey = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function createInitialProgress(): Progress {
  return {
    bestCombo: 0,
    correctByKind: {},
    lastActiveDate: null,
    mastery: {},
    streak: 0,
    todayAnswered: 0,
    todayDate: todayKey(),
    totalAnswered: 0,
    totalCorrect: 0,
    xp: 0,
  }
}

export function loadProgress(): Progress {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return createInitialProgress()
    }

    return normalizeProgress(JSON.parse(stored) as Partial<Progress>)
  } catch {
    return createInitialProgress()
  }
}

export function saveProgress(progress: Progress): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function getLevel(xp: number): number {
  return Math.floor(xp / 140) + 1
}

export function getLevelProgress(xp: number): number {
  return (xp % 140) / 140
}

export function recordAnswer(
  currentProgress: Progress,
  question: Question,
  isCorrect: boolean,
  combo: number,
): AnswerResult {
  const beforeLevel = getLevel(currentProgress.xp)
  const activeProgress = rollDateForward(currentProgress)
  const topicId = getTopicId(question)
  const xpGain = isCorrect ? 10 + Math.min(combo * 2, 18) : 2
  const nextProgress: Progress = {
    ...activeProgress,
    bestCombo: Math.max(activeProgress.bestCombo, combo),
    correctByKind: {
      ...activeProgress.correctByKind,
      [question.kind]:
        (activeProgress.correctByKind[question.kind] ?? 0) + (isCorrect ? 1 : 0),
    },
    mastery: {
      ...activeProgress.mastery,
      [topicId]: Math.max(
        0,
        (activeProgress.mastery[topicId] ?? 0) + (isCorrect ? 1 : -1),
      ),
    },
    todayAnswered: activeProgress.todayAnswered + 1,
    totalAnswered: activeProgress.totalAnswered + 1,
    totalCorrect: activeProgress.totalCorrect + (isCorrect ? 1 : 0),
    xp: activeProgress.xp + xpGain,
  }

  saveProgress(nextProgress)

  return {
    leveledUp: getLevel(nextProgress.xp) > beforeLevel,
    progress: nextProgress,
  }
}

export function getBadges(progress: Progress): string[] {
  const badges = ['Rookie Cartographer']

  if (progress.streak >= 3) {
    badges.push('3-Day Compass')
  }

  if (progress.todayAnswered >= 12) {
    badges.push('Daily Sprint Clear')
  }

  if ((progress.correctByKind.mapTap ?? 0) >= 5) {
    badges.push('Map Tapper')
  }

  if ((progress.correctByKind.flag ?? 0) >= 8) {
    badges.push('Flag Collector')
  }

  if (progress.bestCombo >= 8) {
    badges.push('Combo Pilot')
  }

  return badges
}

export function getAccuracy(progress: Progress): number {
  if (progress.totalAnswered === 0) {
    return 0
  }

  return Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
}

function normalizeProgress(progress: Partial<Progress>): Progress {
  const normalized = {
    bestCombo: progress.bestCombo ?? 0,
    correctByKind: progress.correctByKind ?? {},
    lastActiveDate: progress.lastActiveDate ?? null,
    mastery: progress.mastery ?? {},
    streak: progress.streak ?? 0,
    todayAnswered: progress.todayAnswered ?? 0,
    todayDate: progress.todayDate ?? todayKey(),
    totalAnswered: progress.totalAnswered ?? 0,
    totalCorrect: progress.totalCorrect ?? 0,
    xp: progress.xp ?? 0,
  }

  if (normalized.todayDate !== todayKey()) {
    return {
      ...normalized,
      todayAnswered: 0,
      todayDate: todayKey(),
    }
  }

  return normalized
}

function rollDateForward(progress: Progress): Progress {
  const today = todayKey()

  if (progress.todayDate === today) {
    if (progress.lastActiveDate === today) {
      return progress
    }

    return {
      ...progress,
      lastActiveDate: today,
      streak:
        progress.lastActiveDate === yesterdayKey()
          ? Math.max(progress.streak, 0) + 1
          : 1,
    }
  }

  return {
    ...progress,
    lastActiveDate: today,
    streak:
      progress.lastActiveDate === yesterdayKey()
        ? Math.max(progress.streak, 0) + 1
        : 1,
    todayAnswered: 0,
    todayDate: today,
  }
}

function getTopicId(question: Question): string {
  if (question.country) {
    return question.country.iso3
  }

  if (question.feature) {
    return question.feature.id
  }

  return question.kind
}
