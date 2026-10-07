import { scenarioCatalog } from '@/modes/scenarios'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Inbox } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { TradingChart } from '@/components/charts/TradingChart'
import {
  ComparisonNarrative,
  ComparisonTable,
  GhostTimeline,
  type ComparisonRow,
} from '@/components/results/Comparison'
import { LinkButton } from '@/components/ui/Button'
import { Button } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'
import { getBlindScenario } from '@/data/blindMarketScenarios'
import {
  getCrossArbitrageSession,
  sessionScenarios,
} from '@/data/crossArbitrageScenarios'
import { getMarketMakerScenario } from '@/data/marketMakerScenarios'
import { BlindMarketGame } from '@/games/blind-market/BlindMarketGame'
import { actionShortLabels } from '@/games/blind-market/scoring'
import { CrossArbitrageGame } from '@/games/cross-arbitrage/CrossArbitrageGame'
import { bestTrade } from '@/games/cross-arbitrage/engine'
import {
  formatDecisionSeconds,
  formatEdge,
  roundShortLabel,
} from '@/games/cross-arbitrage/scoring'
import { MarketMakerGame } from '@/games/market-maker/MarketMakerGame'
import { actionPastLabels as shockActionLabels } from '@/games/market-shock/engine'
import { MarketShockGame } from '@/games/market-shock/MarketShockGame'
import { getMarketShockScenario } from '@/games/market-shock/scenarios'
import { trackEvent } from '@/lib/analytics'
import {
  exposureLabel,
  formatMoney,
  formatNumber,
  formatPercent,
  formatPrice,
  plural,
} from '@/lib/formatting'
import { decodeSharePayload, type SharePayload } from '@/lib/sharing'
import { challengeTitles, useGameStore } from '@/store/gameStore'
import type {
  BlindMarketResult,
  ChallengeType,
  CrossArbitrageResult,
  MarketMakerResult,
  MarketShockResult,
} from '@/types/game'

type AnyResult = BlindMarketResult | MarketMakerResult | MarketShockResult | CrossArbitrageResult

export function SharedChallengePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const saveResult = useGameStore((state) => state.saveResult)

  const payload = useMemo(() => {
    const data = searchParams.get('data')
    return data ? decodeSharePayload(data) : null
  }, [searchParams])

  const [started, setStarted] = useState(false)
  const [myResult, setMyResult] = useState<AnyResult | null>(null)

  useEffect(() => {
    if (!payload) return
    trackEvent('shared_challenge_opened', {
      challengeType: payload.t,
      scenarioId: payload.s,
      seed: payload.d,
    })
  }, [payload])

  if (!payload || (id && id !== payload.t) || !scenarioCatalog[payload.t].some(s => s.id === payload.s && s.seed === payload.d && s.mode === 'standard')) {
    return <BrokenLink />
  }

  const challengeType: ChallengeType = payload.t

  // Прохождение по ссылке засчитывается в прогресс: это вход в полную серию.
  const finish = (result: AnyResult) => {
    setMyResult(result)
    trackEvent('shared_challenge_completed', {
      challengeType,
      scenarioId: payload.s,
      score: Math.round(result.score),
    })
  }

  if (!started) {
    return (
      <Invitation
        challengeType={challengeType}
        senderName={payload.n}
        onStart={() => setStarted(true)}
      />
    )
  }

  if (myResult) {
    return <SharedComparison payload={payload} result={myResult} />
  }

  if (challengeType === 'blind-market') {
    return (
      <BlindMarketGame
        scenario={getBlindScenario(payload.s)}
        onComplete={(result) => {
          saveResult({ challengeType, result })
          finish(result)
        }}
      />
    )
  }

  if (challengeType === 'cross-arbitrage') {
    return (
      <CrossArbitrageGame
        session={getCrossArbitrageSession(payload.s)}
        onComplete={(result) => {
          saveResult({ challengeType, result })
          finish(result)
        }}
      />
    )
  }

  if (challengeType === 'market-maker') {
    return (
      <MarketMakerGame
        scenario={getMarketMakerScenario(payload.s)}
        onComplete={(result) => {
          saveResult({ challengeType, result })
          finish(result)
        }}
      />
    )
  }

  return (
    <MarketShockGame
      scenario={getMarketShockScenario(payload.s)}
      onComplete={(result) => {
        saveResult({ challengeType, result })
        finish(result)
      }}
    />
  )
}

function Invitation({
  challengeType,
  senderName,
  onStart,
}: {
  challengeType: ChallengeType
  senderName?: string
  onStart: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-accent/40 bg-violet-dim/30">
        <Inbox className="h-5 w-5 text-violet-soft" aria-hidden />
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          Тебе отправили рынок
        </h1>
        <p className="text-lg leading-relaxed text-chalk-200">
          Пройди тот же сценарий и сравни решения.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-chalk-400">
        <span className="text-chalk-50">{challengeTitles[challengeType]}</span>
        <span>
          {senderName ? `Отправил: ${senderName}. ` : ''}
          Результат отправителя скрыт до конца прохождения.
        </span>
        <span>Тот же seed — рынок будет точно такой же.</span>
      </div>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Пройти этот сценарий
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>

      <Disclaimer>
        Без регистрации. Испытания используются
        исключительно для тестирования игровой механики.
      </Disclaimer>
    </div>
  )
}

function SharedComparison({
  payload,
  result,
}: {
  payload: SharePayload
  result: AnyResult
}) {
  const theirName = payload.n || 'Другой игрок'

  const { rows, ghost, narrative, chart } = useMemo(
    () => buildComparison(payload, result),
    [payload, result],
  )

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <header className="flex flex-col gap-5">
        <SectionLabel>Один рынок · два трейдера</SectionLabel>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          Сравнение решений
        </h1>
      </header>

      <ComparisonTable rows={rows} theirName={theirName} />

      {narrative ? <ComparisonNarrative>{narrative}</ComparisonNarrative> : null}

      {chart ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-normal tracking-tight text-chalk-50">
            Где ваши решения разошлись
          </h2>
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <TradingChart
              className="h-[420px]"
              candles={chart.candles}
              visibleCount={chart.candles.length}
              timeframe="1d"
              annotations={{ levels: [], trendLine: null }}
              markers={chart.markers}
            />
          </div>
        </section>
      ) : null}

      {ghost.length ? (
        <section className="flex flex-col gap-6 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
          <h2 className="text-lg font-normal tracking-tight text-chalk-50">
            Пошаговое сравнение
          </h2>
          <GhostTimeline entries={ghost} theirName={theirName.toLowerCase()} />
        </section>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-ink-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer>
          Сравниваются решения внутри одной игровой сессии, а не квалификация
          участников.
        </Disclaimer>
        <LinkButton to="/play" variant="primary" size="lg">
          Пройти всю серию
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
    </div>
  )
}

interface ComparisonView {
  rows: ComparisonRow[]
  ghost: { moment: string; mine: string; theirs: string }[]
  narrative: string | null
  chart: { candles: ReturnType<typeof getBlindScenario>['candles']; markers: ChartMarker[] } | null
}

function buildComparison(payload: SharePayload, result: AnyResult): ComparisonView {
  if (payload.t === 'blind-market') {
    const blind = result as BlindMarketResult
    const scenario = getBlindScenario(payload.s)

    const myLabels = blind.decisions.map((decision, index) =>
      index === 0
        ? exposureLabel(decision.exposure)
        : actionShortLabels[decision.action ?? 'hold'],
    )

    const rows: ComparisonRow[] = [
      {
        label: 'Результат',
        mine: formatPercent(blind.pnlPercent),
        theirs: formatPercent(payload.r),
        mineTone: blind.pnlPercent >= 0 ? 'up' : 'down',
        theirsTone: payload.r >= 0 ? 'up' : 'down',
      },
      ...myLabels.map((label, index) => ({
        label: index === 0 ? 'Вход' : `Точка ${index + 1}`,
        mine: label,
        theirs: payload.a[index] ?? '—',
        diverged: label !== payload.a[index],
      })),
    ]

    // Маркеры обоих игроков на одном графике: круг — ты, квадрат — другой игрок.
    const markers: ChartMarker[] = []
    blind.decisions.forEach((_, index) => {
      markers.push({
        candleIndex: scenario.checkpoints[index] - 1,
        position: 'belowBar',
        shape: 'circle',
        color: '#7b5cff',
        text: `ты: ${myLabels[index]}`,
      })
    })
    payload.a.forEach((label, index) => {
      if (index >= scenario.checkpoints.length) return
      markers.push({
        candleIndex: scenario.checkpoints[index] - 1,
        position: 'aboveBar',
        shape: 'square',
        color: '#8b8b99',
        text: label,
      })
    })

    return {
      rows,
      ghost: myLabels.map((label, index) => ({
        moment: index === 0 ? 'Вход в рынок' : `Точка ${index + 1}`,
        mine: label,
        theirs: payload.a[index] ?? '—',
      })),
      narrative: buildNarrative(myLabels, payload.a),
      chart: { candles: scenario.candles, markers },
    }
  }

  if (payload.t === 'cross-arbitrage') {
    return buildArbitrageComparison(payload, result as CrossArbitrageResult)
  }

  if (payload.t === 'black-swan') {
    const swan = result as MarketShockResult
    const myLabels = swan.decisions.map((decision) => shockActionLabels[decision.action])

    return {
      rows: [
        {
          label: 'Результат',
          mine: formatPercent(swan.pnlPercent),
          theirs: formatPercent(payload.r),
          mineTone: swan.pnlPercent >= 0 ? 'up' : 'down',
          theirsTone: payload.r >= 0 ? 'up' : 'down',
        },
        ...myLabels.map((label, index) => ({
          label: `Решение ${index + 1}`,
          mine: label,
          theirs: payload.a[index] ?? '—',
          diverged: label !== payload.a[index],
        })),
      ],
      ghost: myLabels.map((label, index) => ({
        moment: `Решение ${index + 1}`,
        mine: label,
        theirs: payload.a[index] ?? '—',
      })),
      narrative: buildNarrative(myLabels, payload.a),
      chart: null,
    }
  }

  const maker = result as MarketMakerResult
  return {
    rows: [
      {
        label: 'PnL',
        mine: formatMoney(maker.pnl),
        theirs: formatMoney(payload.r),
        mineTone: maker.pnl >= 0 ? 'up' : 'down',
        theirsTone: payload.r >= 0 ? 'up' : 'down',
      },
      {
        label: 'Средний спред',
        mine: formatPrice(maker.averageSpread),
        theirs: payload.a[0] ?? '—',
      },
      {
        label: 'Максимальный inventory',
        mine: formatNumber(maker.maxInventory),
        theirs: payload.a[1] ?? '—',
      },
      {
        label: 'Хедж',
        mine: formatNumber(maker.hedgeCount),
        theirs: payload.a[2] ?? '—',
      },
    ],
    ghost: [],
    narrative:
      'Вы котировали один и тот же поток. Разница в результате — это разница в том, как быстро каждый из вас менял спред и сбрасывал инвентарь.',
    chart: null,
  }
}

function tradesLabel(count: number): string {
  return `${count} ${plural(count, ['сделка', 'сделки', 'сделок'])}`
}

function falseLabel(count: number): string {
  return `${count} ${plural(count, ['ложная', 'ложных', 'ложных'])}`
}

function buildArbitrageComparison(
  payload: SharePayload,
  arb: CrossArbitrageResult,
): ComparisonView {
  const [theirTrades = 0, theirFalse = 0, theirMs = 0, theirFound = 0] = payload.m ?? []
  const theirReturn = payload.r
  const myLabels = arb.rounds.map(roundShortLabel)

  const scenarios = sessionScenarios(getCrossArbitrageSession(payload.s))
  const available =
    scenarios.reduce((sum, scenario) => sum + Math.max(0, bestTrade(scenario.quotes).capitalReturn), 0) *
    100
  const theirCaptured = (payload.p ?? []).reduce((sum, value) => sum + Math.max(0, value), 0)
  const myCaptured = arb.rounds.reduce((sum, round) => sum + Math.max(0, round.capitalReturn), 0) * 100

  const rows: ComparisonRow[] = [
    {
      label: 'Результат',
      mine: formatEdge(arb.totalReturnPercent),
      theirs: formatEdge(theirReturn),
      mineTone: arb.totalReturnPercent > 0 ? 'up' : arb.totalReturnPercent < 0 ? 'down' : 'neutral',
      theirsTone: theirReturn > 0 ? 'up' : theirReturn < 0 ? 'down' : 'neutral',
    },
    { label: 'Сделок', mine: tradesLabel(arb.tradeCount), theirs: tradesLabel(theirTrades) },
    { label: 'Ложных сделок', mine: falseLabel(arb.falseTrades), theirs: falseLabel(theirFalse) },
    {
      label: 'Найдено возможностей',
      mine: `${arb.found} / ${arb.opportunities}`,
      theirs: `${theirFound} / ${arb.opportunities}`,
    },
    {
      label: 'Среднее время',
      mine: formatDecisionSeconds(arb.averageDecisionMs),
      theirs: formatDecisionSeconds(theirMs),
    },
    ...myLabels.map((label, index) => ({
      label: `Рынок ${index + 1}`,
      mine: label,
      theirs: payload.a[index] ?? '—',
      diverged: label !== payload.a[index],
    })),
  ]

  const sentences: string[] = []
  const myReturn = Number(arb.totalReturnPercent.toFixed(2))
  if (myLabels.every((label, index) => label === payload.a[index])) {
    sentences.push('Вы собрали одни и те же маршруты с тем же размером — рынок читался одинаково.')
  } else if (arb.tradeCount < theirTrades && myReturn > theirReturn) {
    sentences.push('Ты совершил меньше сделок, но сохранил больший чистый edge.')
  } else if (arb.tradeCount > theirTrades && myReturn > theirReturn) {
    sentences.push('Ты открыл больше сделок, и дополнительные сделки пережили комиссии.')
  } else if (arb.tradeCount > theirTrades && myReturn < theirReturn) {
    sentences.push('Ты торговал чаще, но часть лишних сделок ушла на комиссии.')
  } else if (arb.falseTrades < theirFalse) {
    sentences.push('Ты реже входил в сделки, которые после комиссий уходили в минус.')
  } else if (arb.falseTrades > theirFalse) {
    sentences.push('Разница в результате — в сделках, где комиссии оказались выше расхождения.')
  } else if (myReturn !== theirReturn) {
    sentences.push('Вы торговали похоже — разница в выборе пары и размере позиции.')
  }

  if (available > 0) {
    const myShare = Math.round((myCaptured / available) * 100)
    const theirShare = Math.round((theirCaptured / available) * 100)
    sentences.push(
      `Из доступного в этих рынках edge ты собрал ${myShare}%, другой игрок — ${theirShare}%.`,
    )
  }

  return {
    rows,
    ghost: myLabels.map((label, index) => ({
      moment: `Рынок ${index + 1} · ${scenarios[index]?.asset ?? ''}`,
      mine: label,
      theirs: payload.a[index] ?? '—',
    })),
    narrative: sentences.length ? sentences.join(' ') : null,
    chart: null,
  }
}

/** Текст о том, где именно разошлись решения, важнее разницы в score. */
function buildNarrative(mine: string[], theirs: string[]): string | null {
  if (!theirs.length) return null

  const firstDivergence = mine.findIndex((label, index) => label !== theirs[index])

  if (firstDivergence === -1) {
    return 'Вы прошли сценарий одинаково — те же решения в тех же точках. Разница в результате была бы только за счёт размера позиции.'
  }

  if (firstDivergence === 0) {
    return 'Вы разошлись сразу на входе и дальше торговали разные сценарии одного и того же рынка.'
  }

  return 'Вы одинаково начали сценарий, но по-разному отреагировали на первое серьёзное движение.'
}

function BrokenLink() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-28 sm:px-8 sm:py-36">
      <h1 className="text-3xl font-extrabold tracking-[-0.025em] text-chalk-50 sm:text-4xl">
        Ссылка не читается
      </h1>
      <p className="text-sm leading-relaxed text-chalk-400">
        Похоже, ссылка была обрезана при отправке. Можно просто начать серию с
        первого испытания.
      </p>
      <LinkButton to="/play" variant="primary" className="self-start">
        К испытаниям
      </LinkButton>
    </div>
  )
}