import confetti from 'canvas-confetti'
import {
  BadgeCheck,
  ChevronRight,
  Compass,
  Flag,
  Flame,
  Globe2,
  Heart,
  Landmark,
  Map,
  Mountain,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './App.css'
import { CountryOutline, WorldMap } from './components/WorldMap'
import { COUNTRIES_BY_ISO3 } from './data/countries'
import { PHYSICAL_FEATURES } from './data/physical'
import {
  DAILY_GOAL,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  createQuestion,
  explainQuestion,
  mulberry32,
  seedFromText,
  type GameMode,
  type Question,
  type RandomSource,
} from './game'
import {
  getAccuracy,
  getBadges,
  getLevel,
  getLevelProgress,
  loadProgress,
  recordAnswer,
  saveProgress,
  type Progress,
} from './progress'

const MODES: GameMode[] = [
  'mixed',
  'flags',
  'capitals',
  'map',
  'neighbors',
  'physical',
]

const MODE_ICONS: Record<GameMode, typeof Globe2> = {
  capitals: Landmark,
  flags: Flag,
  map: Map,
  mixed: Zap,
  neighbors: Compass,
  physical: Mountain,
}

type SessionState = {
  mode: GameMode
  question: Question
  rng: RandomSource
}

function createSession(mode: GameMode, salt = 'start'): SessionState {
  const rng = mulberry32(
    seedFromText(`${new Date().toISOString().slice(0, 10)}:${mode}:${salt}`),
  )

  return {
    mode,
    question: createQuestion(mode, rng),
    rng,
  }
}

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function formatWeakSpot(topicId: string): string {
  return (
    COUNTRIES_BY_ISO3.get(topicId)?.name ??
    PHYSICAL_FEATURES.find((feature) => feature.id === topicId)?.name ??
    topicId
  )
}

function getPreAnswerHint(question: Question): string {
  if (question.kind === 'mapTap') {
    return 'Tap the map when you are ready.'
  }

  if (question.kind === 'outline') {
    return 'Study the outline, then choose.'
  }

  if (question.kind === 'flag') {
    return 'Use the flag only. No reveal until you commit.'
  }

  return 'Choose an answer to lock it in.'
}

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [session, setSession] = useState<SessionState>(() => createSession('mixed'))
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [combo, setCombo] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [levelFlash, setLevelFlash] = useState(false)
  const [isStandalone] = useState(detectStandalone)

  const mode = session.mode
  const question = session.question
  const level = getLevel(progress.xp)
  const levelProgress = getLevelProgress(progress.xp)
  const accuracy = getAccuracy(progress)
  const badges = getBadges(progress)
  const dailyProgress = Math.min(progress.todayAnswered, DAILY_GOAL)
  const canContinue = isCorrect !== null
  const selectedIsWrong = isCorrect === false

  const weakSpots = useMemo(() => {
    return Object.entries(progress.mastery)
      .filter(([, score]) => score <= 0)
      .slice(0, 4)
  }, [progress.mastery])

  const handleAnswer = (answer: string) => {
    if (isCorrect !== null) {
      return
    }

    const correct = answer === question.answer
    const nextCombo = correct ? combo + 1 : 0
    const answerResult = recordAnswer(progress, question, correct, nextCombo)

    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setCombo(nextCombo)
    setProgress(answerResult.progress)

    if (!correct) {
      setHearts((currentHearts) => Math.max(0, currentHearts - 1))
      return
    }

    confetti({
      colors: ['#14b8a6', '#f97316', '#2563eb', '#facc15'],
      particleCount: nextCombo >= 5 ? 90 : 42,
      spread: nextCombo >= 5 ? 72 : 48,
      startVelocity: 28,
      ticks: 120,
    })

    if (answerResult.leveledUp) {
      setLevelFlash(true)
      window.setTimeout(() => setLevelFlash(false), 1200)
    }
  }

  const handleNext = () => {
    setSelectedAnswer(null)
    setIsCorrect(null)
    setSession((currentSession) => ({
      ...currentSession,
      question: createQuestion(currentSession.mode, currentSession.rng),
    }))

    if (hearts === 0) {
      setHearts(3)
    }
  }

  const handleModeChange = (nextMode: GameMode) => {
    setSession(createSession(nextMode, progress.totalAnswered.toString()))
    setSelectedAnswer(null)
    setIsCorrect(null)
  }

  const resetProgress = () => {
    const fresh: Progress = {
      bestCombo: 0,
      correctByKind: {},
      lastActiveDate: null,
      mastery: {},
      streak: 0,
      todayAnswered: 0,
      todayDate: new Date().toISOString().slice(0, 10),
      totalAnswered: 0,
      totalCorrect: 0,
      xp: 0,
    }
    saveProgress(fresh)
    setProgress(fresh)
    setCombo(0)
    setHearts(3)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Globe2 aria-hidden="true" size={26} />
          </div>
          <div>
            <p className="kicker">Installable geography trainer</p>
            <h1>Atlas Sprint</h1>
          </div>
        </div>

        <div className="hero-grid">
          <div className="status-strip" aria-label="Player status">
            <Metric label="Level" value={level.toString()} icon={Trophy} />
            <Metric label="Streak" value={`${progress.streak}d`} icon={Flame} />
            <Metric label="XP" value={progress.xp.toString()} icon={Sparkles} />
          </div>

          <div className="level-meter" aria-label="Level progress">
            <span style={{ width: `${Math.round(levelProgress * 100)}%` }} />
          </div>

          <div className="quest-track" aria-label="Daily sprint progress">
            {Array.from({ length: DAILY_GOAL }, (_, index) => (
              <span
                className={index < dailyProgress ? 'is-done' : ''}
                key={`quest-dot-${index}`}
              />
            ))}
          </div>
        </div>
      </section>

      <nav className="mode-rail" aria-label="Training modes">
        {MODES.map((modeOption) => {
          const Icon = MODE_ICONS[modeOption]
          const isActive = modeOption === mode

          return (
            <button
              aria-pressed={isActive}
              className={isActive ? 'mode-button is-active' : 'mode-button'}
              key={modeOption}
              onClick={() => handleModeChange(modeOption)}
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              <span>{MODE_LABELS[modeOption]}</span>
            </button>
          )
        })}
      </nav>

      <div className="workspace">
        <section className="challenge-panel" aria-live="polite">
          <div className="challenge-topline">
            <div>
              <p className="kicker">{MODE_DESCRIPTIONS[mode]}</p>
              <h2>{question.prompt}</h2>
            </div>
            <div className="hearts" aria-label={`${hearts} hearts remaining`}>
              {Array.from({ length: 3 }, (_, index) => (
                <Heart
                  aria-hidden="true"
                  className={index < hearts ? 'is-filled' : ''}
                  fill="currentColor"
                  key={`heart-${index}`}
                  size={18}
                />
              ))}
            </div>
          </div>

          <QuestionStage
            onMapPick={handleAnswer}
            question={question}
            reveal={canContinue}
            selectedAnswer={selectedAnswer}
          />

          {question.kind !== 'mapTap' ? (
            <div className="answer-grid">
              {question.options.map((option) => {
                const isPicked = selectedAnswer === option
                const isAnswer = question.answer === option
                const className = [
                  'answer-button',
                  canContinue && isAnswer ? 'is-answer' : '',
                  canContinue && isPicked && !isAnswer ? 'is-wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    className={className}
                    disabled={canContinue}
                    key={option}
                    onClick={() => handleAnswer(option)}
                    type="button"
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className={canContinue ? 'feedback is-visible' : 'feedback'}>
            <div>
              <p className="feedback__label">
                {isCorrect ? 'Correct' : selectedIsWrong ? 'Close, lock this in' : 'Choose one'}
              </p>
              <p>{canContinue ? explainQuestion(question) : getPreAnswerHint(question)}</p>
            </div>
            <button
              className="next-button"
              disabled={!canContinue}
              onClick={handleNext}
              type="button"
            >
              <span>Next</span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        </section>

        <aside className="side-panel">
          <section className={levelFlash ? 'mini-panel is-flashing' : 'mini-panel'}>
            <div className="panel-heading">
              <BadgeCheck aria-hidden="true" size={19} />
              <h3>Today</h3>
            </div>
            <div className="today-grid">
              <Metric label="Goal" value={`${dailyProgress}/${DAILY_GOAL}`} icon={Zap} />
              <Metric label="Combo" value={combo.toString()} icon={Flame} />
              <Metric label="Accuracy" value={`${accuracy}%`} icon={Compass} />
            </div>
          </section>

          <section className="mini-panel">
            <div className="panel-heading">
              <Trophy aria-hidden="true" size={19} />
              <h3>Badges</h3>
            </div>
            <div className="badge-list">
              {badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          </section>

          <section className="mini-panel">
            <div className="panel-heading">
              <Compass aria-hidden="true" size={19} />
              <h3>Weak Spots</h3>
            </div>
            {weakSpots.length ? (
              <ul className="weak-list">
                {weakSpots.map(([topicId]) => (
                  <li key={topicId}>{formatWeakSpot(topicId)}</li>
                ))}
              </ul>
            ) : (
              <p className="quiet-copy">Misses will collect here so the app can bring them back.</p>
            )}
          </section>

          <section className="install-panel">
            <div className="panel-heading">
              <Share2 aria-hidden="true" size={19} />
              <h3>{isStandalone ? 'Installed' : 'iPhone Install'}</h3>
            </div>
            <p>
              {isStandalone
                ? 'Running as a home-screen app.'
                : 'In Safari: Share, then Add to Home Screen.'}
            </p>
            <button className="ghost-button" onClick={resetProgress} type="button">
              <RotateCcw aria-hidden="true" size={17} />
              <span>Reset progress</span>
            </button>
          </section>
        </aside>
      </div>
    </main>
  )
}

type MetricProps = {
  icon: typeof Globe2
  label: string
  value: string
}

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="metric">
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type QuestionStageProps = {
  onMapPick: (answer: string) => void
  question: Question
  reveal: boolean
  selectedAnswer: string | null
}

function QuestionStage({
  onMapPick,
  question,
  reveal,
  selectedAnswer,
}: QuestionStageProps) {
  if (question.kind === 'mapTap') {
    return (
      <div className="map-stage">
        <WorldMap
          answerNumeric={question.answer}
          disabled={reveal}
          onPick={onMapPick}
          pickedNumeric={selectedAnswer}
          reveal={reveal}
        />
      </div>
    )
  }

  if (question.kind === 'flag' && question.country) {
    return (
      <div className="flag-stage">
        <span aria-label={`Flag of ${question.country.name}`}>{question.country.flag}</span>
      </div>
    )
  }

  if (question.kind === 'outline' && question.country) {
    return (
      <div className="outline-stage">
        <CountryOutline country={question.country} />
      </div>
    )
  }

  if (question.kind === 'physicalCategory' && question.feature) {
    return (
      <div className="clue-stage">
        <p>{question.eyebrow}</p>
        <strong>{question.feature.clue}</strong>
      </div>
    )
  }

  return (
    <div className="clue-stage">
      <p>{question.eyebrow}</p>
      {question.feature ? <strong>{question.feature.clue}</strong> : null}
    </div>
  )
}

export default App
