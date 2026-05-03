import confetti from 'canvas-confetti'
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Compass,
  Flag,
  Flame,
  Globe2,
  Landmark,
  Map,
  Mountain,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
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

type SheetName = 'stats' | 'modes' | null

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

function detectReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    return 'Tap the country on the map.'
  }

  if (question.kind === 'outline') {
    return 'Study the outline, then choose.'
  }

  if (question.kind === 'flag') {
    return 'Use the flag only.'
  }

  return 'Choose an answer.'
}

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [session, setSession] = useState<SessionState>(() => createSession('mixed'))
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [combo, setCombo] = useState(0)
  const [levelFlash, setLevelFlash] = useState(false)
  const [activeSheet, setActiveSheet] = useState<SheetName>(null)
  const [isStandalone] = useState(detectStandalone)
  const [prefersReducedMotion] = useState(detectReducedMotion)
  const autoAdvanceRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const mode = session.mode
  const question = session.question
  const level = getLevel(progress.xp)
  const levelProgress = getLevelProgress(progress.xp)
  const accuracy = getAccuracy(progress)
  const badges = getBadges(progress)
  const dailyProgress = Math.min(progress.todayAnswered, DAILY_GOAL)
  const canContinue = isCorrect !== null
  const selectedIsWrong = isCorrect === false
  const ModeIcon = MODE_ICONS[mode]
  const shouldShowContinue = canContinue && prefersReducedMotion
  const dailyProgressPercent = Math.round((dailyProgress / DAILY_GOAL) * 100)

  const weakSpots = useMemo(() => {
    return Object.entries(progress.mastery)
      .filter(([, score]) => score <= 0)
      .slice(0, 4)
  }, [progress.mastery])

  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current !== null) {
      window.clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
  }

  const goToNextQuestion = () => {
    clearAutoAdvance()
    setSelectedAnswer(null)
    setIsCorrect(null)
    setSession((currentSession) => ({
      ...currentSession,
      question: createQuestion(currentSession.mode, currentSession.rng),
    }))
  }

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
    navigator.vibrate?.(correct ? 16 : [35, 25, 35])

    if (answerResult.leveledUp) {
      confetti({
        colors: ['#a7f3d0', '#ffb347', '#ff5a5f', '#f8fafc'],
        particleCount: 110,
        spread: 78,
        startVelocity: 24,
        ticks: 110,
      })
    }

    if (answerResult.leveledUp) {
      setLevelFlash(true)
      window.setTimeout(() => setLevelFlash(false), 1200)
    }

    if (!prefersReducedMotion) {
      autoAdvanceRef.current = window.setTimeout(
        goToNextQuestion,
        correct ? 860 : 1900,
      )
    }
  }

  const handleCardTap = () => {
    if (canContinue && !prefersReducedMotion) {
      goToNextQuestion()
    }
  }

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const touchStart = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null

    if (!touchStart) {
      return
    }

    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y
    const isVertical = Math.abs(deltaY) > Math.abs(deltaX)

    if (isVertical && deltaY > 56) {
      setActiveSheet('modes')
      return
    }

    if (canContinue && (deltaX < -52 || deltaY < -52)) {
      goToNextQuestion()
    }
  }

  const handleModeChange = (nextMode: GameMode) => {
    clearAutoAdvance()
    setSession(createSession(nextMode, progress.totalAnswered.toString()))
    setSelectedAnswer(null)
    setIsCorrect(null)
    setActiveSheet(null)
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
    clearAutoAdvance()
    saveProgress(fresh)
    setProgress(fresh)
    setCombo(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setSession(createSession(mode, 'reset'))
  }

  return (
    <main className="app-shell">
      <header className="play-hud">
        <button
          aria-label="Open stats"
          className={levelFlash ? 'avatar-button is-flashing' : 'avatar-button'}
          onClick={() => setActiveSheet('stats')}
          style={{ '--daily-progress': `${dailyProgressPercent}%` } as CSSProperties}
          type="button"
        >
          <span>LV</span>
          <strong>{level}</strong>
        </button>

        <div className="streak-chip" aria-label={`${progress.streak} day streak`}>
          <Flame aria-hidden="true" fill="currentColor" size={16} />
          <strong>{progress.streak}d</strong>
          {combo >= 2 ? <span className="combo-pop">x{combo}</span> : null}
        </div>

        <button
          aria-label="Change mode"
          className="mode-pill"
          onClick={() => setActiveSheet('modes')}
          type="button"
        >
          <ModeIcon aria-hidden="true" size={16} />
          <span>{MODE_LABELS[mode]}</span>
        </button>
      </header>

      <section
        aria-live="polite"
        className={[
          'play-card',
          canContinue && isCorrect ? 'is-correct' : '',
          canContinue && selectedIsWrong ? 'is-wrong' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        key={question.id}
        onClick={handleCardTap}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
      >
        <div className="stage-zone">
          <QuestionStage
            onMapPick={handleAnswer}
            question={question}
            reveal={canContinue}
            selectedAnswer={selectedAnswer}
          />
        </div>

        <div className="prompt-zone">
          <p>{MODE_LABELS[mode]}</p>
          <h1>{question.prompt}</h1>
        </div>

        {question.kind !== 'mapTap' ? (
          <div className="answer-stack">
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
                  <span>{option}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="map-instruction">{getPreAnswerHint(question)}</div>
        )}

        <div className={canContinue ? 'feedback-beat is-visible' : 'feedback-beat'}>
          <div>
            <p className="feedback-label">
              {isCorrect ? 'Correct' : selectedIsWrong ? 'Learn it' : getPreAnswerHint(question)}
            </p>
            {canContinue ? <p>{explainQuestion(question)}</p> : null}
          </div>
          {shouldShowContinue ? (
            <button className="continue-button" onClick={goToNextQuestion} type="button">
              Continue
            </button>
          ) : null}
        </div>
      </section>

      {activeSheet === 'modes' ? (
        <ModeSheet currentMode={mode} onClose={() => setActiveSheet(null)} onPick={handleModeChange} />
      ) : null}

      {activeSheet === 'stats' ? (
        <StatsSheet
          accuracy={accuracy}
          badges={badges}
          combo={combo}
          dailyProgress={dailyProgress}
          isStandalone={isStandalone}
          level={level}
          levelProgress={levelProgress}
          onClose={() => setActiveSheet(null)}
          onReset={resetProgress}
          progress={progress}
          weakSpots={weakSpots}
        />
      ) : null}
    </main>
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
      <div className="stage stage--map">
        <WorldMap
          answerNumeric={question.answer}
          disabled={reveal}
          focusCountry={question.country}
          onPick={onMapPick}
          pickedNumeric={selectedAnswer}
          reveal={reveal}
        />
      </div>
    )
  }

  if (question.kind === 'flag' && question.country) {
    return (
      <div className="stage stage--flag">
        <span aria-label={`Flag of ${question.country.name}`}>{question.country.flag}</span>
      </div>
    )
  }

  if (question.kind === 'outline' && question.country) {
    return (
      <div className="stage stage--outline">
        <CountryOutline country={question.country} />
      </div>
    )
  }

  if (question.country && question.kind !== 'capitalReverse') {
    return (
      <div className="stage stage--country">
        <span aria-hidden="true">{question.country.flag}</span>
        <p>{question.country.region}</p>
      </div>
    )
  }

  if (question.kind === 'physicalCategory' && question.feature) {
    return (
      <div className="stage stage--clue">
        <p>{question.eyebrow}</p>
        <strong>{question.feature.clue}</strong>
      </div>
    )
  }

  return (
    <div className="stage stage--clue">
      <p>{question.eyebrow}</p>
      {question.feature ? <strong>{question.feature.clue}</strong> : null}
    </div>
  )
}

type ModeSheetProps = {
  currentMode: GameMode
  onClose: () => void
  onPick: (mode: GameMode) => void
}

function ModeSheet({ currentMode, onClose, onPick }: ModeSheetProps) {
  return (
    <BottomSheet onClose={onClose} title="Pick a sprint">
      <div className="mode-list">
        {MODES.map((modeOption) => {
          const Icon = MODE_ICONS[modeOption]
          const isActive = modeOption === currentMode

          return (
            <button
              className={isActive ? 'sheet-row is-active' : 'sheet-row'}
              key={modeOption}
              onClick={() => onPick(modeOption)}
              type="button"
            >
              <Icon aria-hidden="true" size={19} />
              <span>
                <strong>{MODE_LABELS[modeOption]}</strong>
                <small>{MODE_DESCRIPTIONS[modeOption]}</small>
              </span>
              {isActive ? <CheckCircle2 aria-hidden="true" size={18} /> : null}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

type StatsSheetProps = {
  accuracy: number
  badges: string[]
  combo: number
  dailyProgress: number
  isStandalone: boolean
  level: number
  levelProgress: number
  onClose: () => void
  onReset: () => void
  progress: Progress
  weakSpots: [string, number][]
}

function StatsSheet({
  accuracy,
  badges,
  combo,
  dailyProgress,
  isStandalone,
  level,
  levelProgress,
  onClose,
  onReset,
  progress,
  weakSpots,
}: StatsSheetProps) {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  return (
    <BottomSheet onClose={onClose} title="Atlas Sprint">
      <div className="stats-hero">
        <div>
          <p>Level</p>
          <strong>{level}</strong>
        </div>
        <div className="stats-meter" aria-label="Level progress">
          <span style={{ width: `${Math.round(levelProgress * 100)}%` }} />
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Today" value={`${dailyProgress}/${DAILY_GOAL}`} icon={Zap} />
        <Stat label="Streak" value={`${progress.streak}d`} icon={Flame} />
        <Stat label="XP" value={progress.xp.toString()} icon={Sparkles} />
        <Stat label="Combo" value={combo.toString()} icon={Trophy} />
        <Stat label="Accuracy" value={`${accuracy}%`} icon={Compass} />
        <Stat label="Answered" value={progress.totalAnswered.toString()} icon={BarChart3} />
      </div>

      <section className="sheet-section">
        <h2>Badges</h2>
        <div className="badge-list">
          {badges.map((badge) => (
            <span key={badge}>
              <BadgeCheck aria-hidden="true" size={14} />
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="sheet-section">
        <h2>Weak spots</h2>
        {weakSpots.length ? (
          <ul className="weak-list">
            {weakSpots.map(([topicId]) => (
              <li key={topicId}>{formatWeakSpot(topicId)}</li>
            ))}
          </ul>
        ) : (
          <p className="quiet-copy">Misses will collect here and come back more often.</p>
        )}
      </section>

      <section className="sheet-section">
        <h2>{isStandalone ? 'Installed' : 'iPhone install'}</h2>
        <p className="quiet-copy">
          {isStandalone
            ? 'Running as a home-screen app.'
            : 'In Safari: Share, then Add to Home Screen.'}
        </p>
      </section>

      <button
        className={isConfirmingReset ? 'reset-button is-confirming' : 'reset-button'}
        onClick={() => {
          if (isConfirmingReset) {
            onReset()
            return
          }

          setIsConfirmingReset(true)
        }}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={17} />
        {isConfirmingReset ? 'Tap again to reset' : 'Reset progress'}
      </button>
    </BottomSheet>
  )
}

type StatProps = {
  icon: typeof Globe2
  label: string
  value: string
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="stat-tile">
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type BottomSheetProps = {
  children: React.ReactNode
  onClose: () => void
  title: string
}

function BottomSheet({ children, onClose, title }: BottomSheetProps) {
  const sheetTouchStartRef = useRef<number | null>(null)

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label={title}
        className="bottom-sheet"
        onClick={(event) => event.stopPropagation()}
        onTouchEnd={(event) => {
          const startY = sheetTouchStartRef.current
          sheetTouchStartRef.current = null

          if (startY === null) {
            return
          }

          const deltaY = event.changedTouches[0].clientY - startY

          if (deltaY > 64) {
            onClose()
          }
        }}
        onTouchStart={(event) => {
          sheetTouchStartRef.current = event.touches[0].clientY
        }}
      >
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h1>{title}</h1>
          <button aria-label="Close" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export default App
