import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function HomePage() {
  const navigate = useNavigate()
  const completed = useGameStore((state) => state.completedChallenges)
  const unlocked = useGameStore((state) => state.unlockedChallenges)
  const personalBests = useGameStore((state) => state.personalBests)

  const startGame = () => {
    trackEvent('game_started', { completed: completed.length })
    navigate(completed.length > 0 ? '/play' : '/challenge/blind-market')
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
      <section className="flex flex-col items-start gap-8 pt-16 pb-14 sm:pt-28 sm:pb-20">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-accent" aria-hidden />
          <span className="text-[11px] tracking-[0.22em] text-chalk-500 uppercase">
            Прототип · внутреннее тестирование
          </span>
        </div>

        <h1 className="max-w-4xl text-5xl leading-[0.95] font-light tracking-[-0.03em] text-chalk-50 sm:text-7xl lg:text-[88px]">
          MARKET
          <br />
          TRIALS
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-chalk-200 sm:text-xl">
          Три рынка. Три разных испытания. Посмотрим, как ты принимаешь решения,
          когда правильного ответа заранее нет.
        </p>

        <p className="max-w-xl text-sm leading-relaxed text-chalk-500">
          Без регистрации. Около 10 минут. Результат не является оценкой
          профессиональной квалификации.
        </p>

        <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={startGame}
            className="group inline-flex min-h-13 items-center gap-3 rounded-lg bg-violet-accent px-8 text-base font-medium text-white transition-colors hover:bg-violet-soft"
          >
            {completed.length > 0 ? 'Продолжить испытания' : 'Начать испытания'}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>

          <span className="tnum text-sm text-chalk-500">
            {completed.length} / 3 испытаний
          </span>
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {CHALLENGE_ORDER.map((challenge) => (
          <ChallengeCard
            key={challenge}
            challenge={challenge}
            locked={!unlocked.includes(challenge)}
            completed={completed.includes(challenge)}
            bestPoints={personalBests[challenge]}
          />
        ))}
      </section>

      <section className="grid gap-10 border-t border-ink-800 py-16 sm:grid-cols-3">
        <HowItWorks
          step="Решения, а не настройки"
          text="Никаких 30 параметров заявки. Направление, размер, уверенность — вся сложность в самом решении."
        />
        <HowItWorks
          step="Рынок развивается"
          text="В каждом сценарии несколько точек принятия решения. Рынок двигается, и позицию приходится пересматривать."
        />
        <HowItWorks
          step="Профиль сессии"
          text="В конце собирается описание твоих решений внутри игры. Его можно отправить другому трейдеру и сравнить."
        />
      </section>
    </div>
  )
}

function HowItWorks({ step, text }: { step: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-normal tracking-tight text-chalk-50">{step}</h3>
      <p className="text-sm leading-relaxed text-chalk-400">{text}</p>
    </div>
  )
}
