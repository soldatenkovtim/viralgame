import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildTradingProfile, computeOverallScore } from '@/lib/profile'
import type {
  BlackSwanResult,
  BlindMarketResult,
  ChallengeResult,
  ChallengeType,
  MarketMakerResult,
  TradingProfile,
} from '@/types/game'

export const CHALLENGE_ORDER: ChallengeType[] = [
  'blind-market',
  'market-maker',
  'black-swan',
]

export const challengeTitles: Record<ChallengeType, string> = {
  'blind-market': 'Слепой рынок',
  'market-maker': 'Маркет-мейкер',
  'black-swan': 'Рыночный шок',
}

export const challengeNumbers: Record<ChallengeType, string> = {
  'blind-market': '01',
  'market-maker': '02',
  'black-swan': '03',
}

export const challengeRoutes: Record<ChallengeType, string> = {
  'blind-market': '/challenge/blind-market',
  'market-maker': '/challenge/market-maker',
  'black-swan': '/challenge/black-swan',
}

/** Очки испытания для личных рекордов: score 0–100 → 0–10 000. */
export function toPoints(score: number): number {
  return Math.round(score * 100)
}

export type ResultPayload =
  | { challengeType: 'blind-market'; result: BlindMarketResult }
  | { challengeType: 'market-maker'; result: MarketMakerResult }
  | { challengeType: 'black-swan'; result: BlackSwanResult }

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
  completedChallenges: ChallengeType[]
  unlockedChallenges: ChallengeType[]
  challengeResults: ChallengeResult[]

  blindMarketResult?: BlindMarketResult
  marketMakerResult?: MarketMakerResult
  blackSwanResult?: BlackSwanResult

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
  saveResult: (payload: ResultPayload) => SaveOutcome
  setPlayerName: (name: string) => void
  resetProgress: () => void
  restartSeries: () => void
  isUnlocked: (challenge: ChallengeType) => boolean
  overallScore: () => number
  bestOverallScore: () => number
}

const initialState = {
  completedChallenges: [] as ChallengeType[],
  unlockedChallenges: ['blind-market'] as ChallengeType[],
  challengeResults: [] as ChallengeResult[],
  blindMarketResult: undefined,
  marketMakerResult: undefined,
  blackSwanResult: undefined,
  tradingProfile: undefined,
  firstResults: {} as Record<string, number>,
  personalBests: {} as Record<string, number>,
  attempts: {} as Record<string, number>,
  playerName: '',
  seriesCompletedAt: undefined,
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

      saveResult: ({ challengeType, result }) => {
        const state = get()
        const points = toPoints(result.score)
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
        const resultSlice =
          challengeType === 'blind-market'
            ? { blindMarketResult: result as BlindMarketResult }
            : challengeType === 'market-maker'
              ? { marketMakerResult: result as MarketMakerResult }
              : { blackSwanResult: result as BlackSwanResult }

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
              })
            : state.tradingProfile,
          seriesCompletedAt: seriesCompleted
            ? new Date().toISOString()
            : state.seriesCompletedAt,
        })

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
          completedChallenges: [],
          unlockedChallenges: ['blind-market'],
          challengeResults: [],
          blindMarketResult: undefined,
          marketMakerResult: undefined,
          blackSwanResult: undefined,
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
        })
      },

      /** Рейтинг учитывает лучший результат каждого испытания. */
      bestOverallScore: () => {
        const { personalBests } = get()
        const blind = (personalBests['blind-market'] ?? 0) / 100
        const maker = (personalBests['market-maker'] ?? 0) / 100
        const swan = (personalBests['black-swan'] ?? 0) / 100
        return Math.round((blind * 0.35 + maker * 0.35 + swan * 0.3) * 100)
      },
    }),
    {
      name: 'market-trials-v1',
      version: 1,
      partialize: (state) => ({
        completedChallenges: state.completedChallenges,
        unlockedChallenges: state.unlockedChallenges,
        challengeResults: state.challengeResults,
        blindMarketResult: state.blindMarketResult,
        marketMakerResult: state.marketMakerResult,
        blackSwanResult: state.blackSwanResult,
        tradingProfile: state.tradingProfile,
        firstResults: state.firstResults,
        personalBests: state.personalBests,
        attempts: state.attempts,
        playerName: state.playerName,
        seriesCompletedAt: state.seriesCompletedAt,
      }),
    },
  ),
)
