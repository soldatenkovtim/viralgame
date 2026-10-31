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
    description="Вы начинаете с открытой позицией. После рыночного события решите: удержать её, сократить, увеличить или полностью закрыть."
    stats={[
      { value: scenario.phases.length, label: 'этапа рынка' },
      { value: timerDisabled ? 'Без лимита' : `${difficulty.timerSeconds} с`, label: 'на каждое решение' },
      { value: CAPITAL.toLocaleString('ru-RU'), label: 'игровой капитал' },
    ]}
    note={timerDisabled
      ? 'Изучите позицию и график, затем нажмите «Начать управление позицией». В этом режиме таймер отключён.'
      : 'Изучите позицию и график без спешки. После «Начать управление позицией» рынок покажет событие, затем включится таймер.'}
    cta="Открыть рынок" visual={<ChallengeIllustration kind="black-swan" />}
    mode={mode} state="intro" onStart={onStart}
  />
}
