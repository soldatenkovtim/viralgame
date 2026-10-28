import { ChallengeIntro } from '@/components/challenge/ChallengeIntro'
import { ChallengeIllustration } from '@/components/challenge/ChallengeIllustration'
import { CAPITAL } from '@/lib/constants'
import { difficultyFor, type GameMode } from '@/modes/config'
import type { MarketShockScenario } from '@/types/game'

export function MarketShockIntro({ scenario, mode, timerDisabled, onStart }: {
  scenario: MarketShockScenario
  mode: GameMode
  timerDisabled: boolean
  onStart: () => void
}) {
  const difficulty = difficultyFor('black-swan', scenario.mode === 'advanced')
  return <ChallengeIntro number="03" title={<>Рыночный<br />шок</>}
    subtitle="Рынок изменился. Позиция осталась."
    description="Вы уже находитесь в позиции, когда рыночные условия резко меняются. Оцените ситуацию и определите дальнейшие действия."
    stats={[
      { value: scenario.phases.length, label: 'этапа рынка' },
      { value: timerDisabled ? 'Без лимита' : `${difficulty.timerSeconds} с`, label: 'на решение' },
      { value: CAPITAL.toLocaleString('ru-RU'), label: 'капитал' },
    ]}
    note="Сначала изучите открытую позицию и график. Отсчёт начнётся после перехода к управлению и появления рыночного события."
    cta="Открыть рынок" visual={<ChallengeIllustration kind="black-swan" />}
    mode={mode} state="intro" onStart={onStart}
  />
}
