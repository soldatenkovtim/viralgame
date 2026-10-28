import { gameEntry } from '@/lib/gameEntry'
import { CHALLENGE_ORDER, challengeRoutes, challengeTitles, type GameState } from '@/store/gameStore'

/** Current standard series only; historical bests, advanced runs and duels do not count. */
export function standardProgress(state: GameState) {
  const completed = CHALLENGE_ORDER.filter(challenge => state.completedChallenges.includes(challenge))
  const count = completed.length
  const total = CHALLENGE_ORDER.length
  const complete = count === total
  const entry = gameEntry({ ...state, selectedMode: 'standard', completedChallenges: completed })
  const next = CHALLENGE_ORDER.find(challenge => challengeRoutes[challenge] === entry.to)
  return {
    completed, count, total, complete, next,
    to: complete ? '/profile' : entry.to,
    action: complete ? 'Посмотреть результаты' : next ? count === 0 ? 'Начать испытание' : 'Продолжить' : 'Выбрать испытание',
    description: complete ? 'Вы завершили стандартную серию из четырёх испытаний.'
      : count === 0 && next === CHALLENGE_ORDER[0] ? 'Вы ещё не начали стандартную серию. Первое испытание — «Слепой рынок».'
        : `Пройдено ${count} из ${total} испытаний.${next ? ` Следующее — «${challengeTitles[next]}».` : ' Выберите доступное испытание.'}`,
  }
}
