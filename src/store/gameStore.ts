import type { GameMode } from '@/modes/config'
import type { DuelResult } from '@/duel/types'
import { trackEvent } from '@/lib/analytics'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  buildTradingProfile,
  computeOverallScore,
  weightedChallengeScore,
} from '@/lib/profile'
import type {
  BlindMarketResult,
  ChallengeResult,
  ChallengeType,
  CrossArbitrageResult,
  MarketMakerResult,
  MarketShockResult,
  ShockAction,
  ShockDecision,
  TradingProfile,
} from '@/types/game'

export const CHALLENGE_ORDER: ChallengeType[] = [
  'blind-market',
  'market-maker',
  'black-swan',
  'cross-arbitrage',
]

export const challengeTitles: Record<ChallengeType, string> = {
  'blind-market': 'Слепой рынок',
  'market-maker': 'Маркет-мейкер',
  'black-swan': 'Рыночный шок',
  'cross-arbitrage': 'Кросс-арбитраж',
}

export const challengeNumbers: Record<ChallengeType, string> = {
  'blind-market': '01',
  'market-maker': '02',
  'black-swan': '03',
  'cross-arbitrage': '04',
}

export const challengeRoutes: Record<ChallengeType, string> = {
  'blind-market': '/challenge/blind-market',
  'market-maker': '/challenge/market-maker',
  'black-swan': '/challenge/black-swan',
  'cross-arbitrage': '/challenge/cross-arbitrage',
}

/** Очки испытания для личных рекордов: score 0–100 → 0–10 000. */
export function toPoints(score: number): number {
  return Math.round(score * 100)
}

export type ResultPayload =
  | { challengeType: 'blind-market'; result: BlindMarketResult }
  | { challengeType: 'market-maker'; result: MarketMakerResult }
  | { challengeType: 'black-swan'; result: MarketShockResult }
  | { challengeType: 'cross-arbitrage'; result: CrossArbitrageResult }

export interface SaveOutcome {
  points: number
  previousBest: number | null
  isPersonalBest: boolean
  /** Сколько очков не хватило до личного рекорда. */
  pointsToBest: number
  unlockedNext: ChallengeType | null
  seriesCompleted: boolean
}

export interface GameState {
  selectedMode: GameMode
  advancedUnlocked: boolean
  standardResults: ChallengeResult[]
  advancedResults: ChallengeResult[]
  advancedBests: Record<string, number>
  duelHistory: DuelResult[]
  setMode: (mode: GameMode) => void
  unlockAdvanced: () => void
  saveDuel: (result: DuelResult) => void
  completedChallenges: ChallengeType[]
  unlockedChallenges: ChallengeType[]
  challengeResults: ChallengeResult[]

  blindMarketResult?: BlindMarketResult
  marketMakerResult?: MarketMakerResult
  blackSwanResult?: MarketShockResult
  crossArbitrageResult?: CrossArbitrageResult

  tradingProfile?: TradingProfile

  /** Очки первого прохождения каждого испытания. */
  firstResults: Record<string, number>
  /** Лучшие очки за всё время — именно они идут в рейтинг. */
  personalBests: Record<string, number>
  /** Номер попытки: влияет на выбор сценария при реплее. */
  attempts: Record<string, number>

  playerName: string
  seriesCompletedAt?: string

  unlockChallenge: (challenge: ChallengeType) => void
  saveResult: (payload: ResultPayload, mode?: 'standard' | 'advanced') => SaveOutcome
  setPlayerName: (name: string) => void
  resetProgress: () => void
  restartSeries: () => void
  isUnlocked: (challenge: ChallengeType) => boolean
  overallScore: () => number
  bestOverallScore: () => number
}

const initialState = {
  selectedMode: 'standard' as GameMode,
  advancedUnlocked: false,
  standardResults: [] as ChallengeResult[],
  advancedResults: [] as ChallengeResult[],
  advancedBests: {} as Record<string, number>,
  duelHistory: [] as DuelResult[],
  completedChallenges: [] as ChallengeType[],
  unlockedChallenges: ['blind-market'] as ChallengeType[],
  challengeResults: [] as ChallengeResult[],
  blindMarketResult: undefined,
  marketMakerResult: undefined,
  blackSwanResult: undefined,
  crossArbitrageResult: undefined,
  tradingProfile: undefined,
  firstResults: {} as Record<string, number>,
  personalBests: {} as Record<string, number>,
  attempts: {} as Record<string, number>,
  playerName: '',
  seriesCompletedAt: undefined,
}

function resultSliceFor(payload: ResultPayload): Partial<GameState> {
  switch (payload.challengeType) {
    case 'blind-market':
      return { blindMarketResult: payload.result }
    case 'market-maker':
      return { marketMakerResult: payload.result }
    case 'black-swan':
      return { blackSwanResult: payload.result }
    case 'cross-arbitrage':
      return { crossArbitrageResult: payload.result }
  }
}

function partialize(state: GameState) {
  return {
    selectedMode: state.selectedMode,
    advancedUnlocked: state.advancedUnlocked,
    standardResults: state.standardResults,
    advancedResults: state.advancedResults,
    advancedBests: state.advancedBests,
    duelHistory: state.duelHistory,
    completedChallenges: state.completedChallenges,
    unlockedChallenges: state.unlockedChallenges,
    challengeResults: state.challengeResults,
    blindMarketResult: state.blindMarketResult,
    marketMakerResult: state.marketMakerResult,
    blackSwanResult: state.blackSwanResult,
    crossArbitrageResult: state.crossArbitrageResult,
    tradingProfile: state.tradingProfile,
    firstResults: state.firstResults,
    personalBests: state.personalBests,
    attempts: state.attempts,
    playerName: state.playerName,
    seriesCompletedAt: state.seriesCompletedAt,
  }
}

type PersistedState = ReturnType<typeof partialize>

/** Дополняет результат маркет-мейкера из версии без разложения PnL. */
function upgradeMarketMakerResult(result: MarketMakerResult): MarketMakerResult {
  const legacy = result as Partial<MarketMakerResult> & MarketMakerResult
  return {
    ...legacy,
    spreadPnl: legacy.spreadPnl ?? legacy.pnl,
    inventoryPnl: legacy.inventoryPnl ?? 0,
    hedgeCosts: legacy.hedgeCosts ?? 0,
    hedgedUnits: legacy.hedgedUnits ?? 0,
    secondsAboveSoftLimit: legacy.secondsAboveSoftLimit ?? 0,
    inventoryResponseSeconds: legacy.inventoryResponseSeconds ?? null,
    spreadNoise: legacy.spreadNoise ?? legacy.spreadFirstHalf,
    spreadDirectional: legacy.spreadDirectional ?? legacy.spreadSecondHalf,
    phases: legacy.phases ?? [],
  }
}

interface LegacyShockDecision {
  phaseIndex: number
  action: ShockAction
  exposureBefore: number
  exposureAfter: number
  timeMs: number
  timedOut: boolean
}

/** Переводит результат старого «Рыночного шока» (без свечей) в новую форму. */
function upgradeMarketShockResult(result: MarketShockResult): MarketShockResult {
  if ('pattern' in result) return result
  const legacy = result as unknown as {
    scenarioId: string
    seed: number
    pnl: number
    pnlPercent: number
    maxDrawdown: number
    maxExposure: number
    positionChanges: number
    decisions: LegacyShockDecision[]
    score: number
  }
  const decisions: ShockDecision[] = legacy.decisions.map((decision) => ({
    phase: decision.phaseIndex + 1,
    action: decision.action,
    positionBefore: decision.exposureBefore,
    positionAfter: decision.exposureAfter,
    price: 0,
    pnlBefore: 0,
    decisionTimeMs: decision.timeMs,
    timestamp: 0,
    timedOut: decision.timedOut,
  }))
  const sizes = decisions.flatMap((decision) => [
    Math.abs(decision.positionBefore),
    Math.abs(decision.positionAfter),
  ])
  return {
    scenarioId: legacy.scenarioId,
    seed: legacy.seed,
    pattern: 'trend-collapse',
    pnl: legacy.pnl,
    pnlPercent: legacy.pnlPercent,
    maxDrawdown: legacy.maxDrawdown,
    maxExposure: legacy.maxExposure,
    minExposure: sizes.length ? Math.min(...sizes) : legacy.maxExposure,
    positionChanges: legacy.positionChanges,
    averageDecisionMs: decisions.length
      ? decisions.reduce((sum, decision) => sum + decision.decisionTimeMs, 0) / decisions.length
      : 0,
    decisions,
    levels: [],
    maxDrawdownIndex: 0,
    maxPnlIndex: 0,
    maxPnlPercent: 0,
    score: legacy.score,
  }
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      unlockChallenge: (challenge) =>
        set((state) =>
          state.unlockedChallenges.includes(challenge)
            ? state
            : { unlockedChallenges: [...state.unlockedChallenges, challenge] },
        ),

      setMode: (mode) => {
        const state = get()
        if (mode === 'advanced' && !state.advancedUnlocked) return
        set({ selectedMode: mode })
        trackEvent('mode_selected', { mode })
      },
      unlockAdvanced: () => {
        if (new Set(get().standardResults.map(r => r.challengeType)).size !== 4 || get().advancedUnlocked) return
        set({ advancedUnlocked: true })
        trackEvent('advanced_unlocked')
      },
      saveDuel: (result) => set(state => ({ duelHistory: [...state.duelHistory.filter(r => r.id !== result.id), result] })),
      saveResult: (payload, mode = 'standard') => {
        const { challengeType, result } = payload
        const state = get()
        const points = toPoints(result.score)
        if (mode === 'advanced') {
          const previousBest = state.advancedBests[challengeType] ?? null
          const isPersonalBest = previousBest === null || points > previousBest
          const advancedResults = [...state.advancedResults, { challengeType, scenarioId: result.scenarioId, score: result.score, completedAt: new Date().toISOString() }]
          set({ advancedResults, advancedBests: { ...state.advancedBests, [challengeType]: Math.max(previousBest ?? 0, points) } })
          trackEvent('advanced_challenge_completed', { challengeType, scenarioId: result.scenarioId })
          return { points, previousBest, isPersonalBest, pointsToBest: Math.max(0, (previousBest ?? 0) - points), unlockedNext: null, seriesCompleted: new Set(advancedResults.map(r => r.challengeType)).size === 4 }
        }
        const previousBest = state.personalBests[challengeType] ?? null
        const isPersonalBest = previousBest === null || points > previousBest

        const nextIndex = CHALLENGE_ORDER.indexOf(challengeType) + 1
        const unlockedNext = CHALLENGE_ORDER[nextIndex] ?? null

        const challengeResult: ChallengeResult = {
          challengeType,
          scenarioId: result.scenarioId,
          score: result.score,
          completedAt: new Date().toISOString(),
        }

        // Последнее прохождение — то, из которого собирается профиль.
        const resultSlice = resultSliceFor(payload)

        const completedChallenges = state.completedChallenges.includes(challengeType)
          ? state.completedChallenges
          : [...state.completedChallenges, challengeType]

        const unlockedChallenges =
          unlockedNext && !state.unlockedChallenges.includes(unlockedNext)
            ? [...state.unlockedChallenges, unlockedNext]
            : state.unlockedChallenges

        const nextState = {
          ...state,
          ...resultSlice,
          completedChallenges,
          unlockedChallenges,
          challengeResults: [...state.challengeResults, challengeResult],
          firstResults:
            state.firstResults[challengeType] === undefined
              ? { ...state.firstResults, [challengeType]: points }
              : state.firstResults,
          personalBests: isPersonalBest
            ? { ...state.personalBests, [challengeType]: points }
            : state.personalBests,
          attempts: {
            ...state.attempts,
            [challengeType]: (state.attempts[challengeType] ?? 0) + 1,
          },
        }

        const seriesCompleted = completedChallenges.length === CHALLENGE_ORDER.length

        set({
          ...resultSlice,
          standardResults: [...state.standardResults, challengeResult],
          completedChallenges: nextState.completedChallenges,
          unlockedChallenges: nextState.unlockedChallenges,
          challengeResults: nextState.challengeResults,
          firstResults: nextState.firstResults,
          personalBests: nextState.personalBests,
          attempts: nextState.attempts,
          tradingProfile: seriesCompleted
            ? buildTradingProfile({
                blindMarket: nextState.blindMarketResult,
                marketMaker: nextState.marketMakerResult,
                blackSwan: nextState.blackSwanResult,
                crossArbitrage: nextState.crossArbitrageResult,
              })
            : state.tradingProfile,
          seriesCompletedAt: seriesCompleted
            ? new Date().toISOString()
            : state.seriesCompletedAt,
        })

        get().unlockAdvanced()
        return {
          points,
          previousBest,
          isPersonalBest,
          pointsToBest: previousBest === null ? 0 : Math.max(0, previousBest - points),
          unlockedNext,
          seriesCompleted,
        }
      },

      setPlayerName: (name) => set({ playerName: name.slice(0, 24) }),

      resetProgress: () => set({ ...initialState }),

      /** Повторное прохождение серии: рекорды и попытки сохраняются. */
      restartSeries: () =>
        set((state) => ({
          selectedMode: 'standard',
          completedChallenges: [],
          unlockedChallenges: ['blind-market'],
          challengeResults: [],
          blindMarketResult: undefined,
          marketMakerResult: undefined,
          blackSwanResult: undefined,
          crossArbitrageResult: undefined,
          tradingProfile: undefined,
          seriesCompletedAt: undefined,
          personalBests: state.personalBests,
          firstResults: state.firstResults,
          attempts: state.attempts,
        })),

      isUnlocked: (challenge) => get().unlockedChallenges.includes(challenge),

      overallScore: () => {
        const state = get()
        return computeOverallScore({
          blindMarket: state.blindMarketResult,
          marketMaker: state.marketMakerResult,
          blackSwan: state.blackSwanResult,
          crossArbitrage: state.crossArbitrageResult,
        })
      },

      /** Рейтинг учитывает лучший результат каждого испытания. */
      bestOverallScore: () => {
        const { personalBests } = get()
        return Math.round(
          weightedChallengeScore({
            blindMarket: personalBests['blind-market'] ?? 0,
            marketMaker: personalBests['market-maker'] ?? 0,
            blackSwan: personalBests['black-swan'] ?? 0,
            crossArbitrage: personalBests['cross-arbitrage'] ?? 0,
          }),
        )
      },
    }),
    {
      name: 'market-trials-v1',
      version: 5,
      // v1 — серия из трёх испытаний. Прошедшим «Рыночный шок» открываем
      // четвёртое, а профиль без «Поиска возможностей» пересобирается позже.
      // v2 — маркет-мейкер без разложения PnL и фаз потока.
      // v3 — «Рыночный шок» на линейном графике без свечей и уровней.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedState
        if (version < 2) {
          const unlocked = state.unlockedChallenges ?? ['blind-market']
          const completed = state.completedChallenges ?? []
          if (completed.includes('black-swan') && !unlocked.includes('cross-arbitrage')) {
            state.unlockedChallenges = [...unlocked, 'cross-arbitrage']
          }
          if (state.tradingProfile && state.tradingProfile.opportunity === undefined) {
            state.tradingProfile = undefined
            state.seriesCompletedAt = undefined
          }
        }
        if (version < 3 && state.marketMakerResult) {
          state.marketMakerResult = upgradeMarketMakerResult(state.marketMakerResult)
        }
        if (version < 4 && state.blackSwanResult) {
          state.blackSwanResult = upgradeMarketShockResult(state.blackSwanResult)
        }
        if (version < 5) {
          state.selectedMode = 'standard'
          state.standardResults = state.challengeResults ?? []
          // Старые сохранения могли сбрасывать серию, сохраняя личные рекорды.
          state.advancedUnlocked = CHALLENGE_ORDER.every(type => state.personalBests?.[type] !== undefined || state.completedChallenges?.includes(type) || state.standardResults.some(r => r.challengeType === type))
          state.advancedResults = []
          state.advancedBests = {}
          state.duelHistory = []
        }
        return state
      },
      partialize,
    },
  ),
)
