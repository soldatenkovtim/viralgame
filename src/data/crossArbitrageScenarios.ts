import type {
  ArbitrageVenueQuote,
  CrossArbitrageScenario,
  CrossArbitrageSession,
} from '@/types/game'

function quote(
  venueName: string,
  bid: number,
  ask: number,
  feePercent: number,
  availableLiquidity = 100,
  depthRate = 0.004,
): ArbitrageVenueQuote {
  return {
    venueId: venueName.toLowerCase(),
    venueName,
    bid,
    ask,
    feeRate: feePercent / 100,
    bidLiquidity: availableLiquidity,
    askLiquidity: availableLiquidity,
    secondBid: Math.round(bid * (1 - depthRate) * 100) / 100,
    secondAsk: Math.round(ask * (1 + depthRate) * 100) / 100,
    secondBidLiquidity: 100 - availableLiquidity,
    secondAskLiquidity: 100 - availableLiquidity,
  }
}

export const crossArbitrageScenarios: CrossArbitrageScenario[] = [
  /* A — очевидный арбитраж */
  {
    id: 'arb_btc_obvious',
    asset: 'BTC / USDT',
    kind: 'obvious',
    seed: 610101,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 64_180, 64_212, 0.1),
      quote('Beta', 64_548, 64_590, 0.08),
      quote('Gamma', 64_290, 64_335, 0.12),
    ],
    revealText:
      'Beta котировала заметно выше остальных: разницы хватало с запасом даже после двух комиссий.',
  },
  {
    id: 'arb_y_obvious',
    asset: 'ASSET Y',
    kind: 'obvious',
    seed: 610102,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 250.8, 251.05, 0.06),
      quote('Beta', 249.4, 249.62, 0.05),
      quote('Gamma', 250.05, 250.35, 0.1),
    ],
    revealText:
      'Самая дешёвая покупка была на Beta, самая дорогая продажа — на Alpha. Остальные пары почти не давали edge.',
  },
  {
    id: 'arb_x_liquidity',
    asset: 'ASSET X',
    kind: 'small',
    seed: 610103,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 99.62, 99.8, 0.05, 25),
      quote('Beta', 99.99, 100.2, 0.06),
      quote('Gamma', 99.7, 99.95, 0.08),
    ],
    revealText:
      'Edge был небольшим, а на Alpha по котировке стояло только 25 единиц. Всё, что выше, исполнялось хуже и съедало прибыль.',
  },
  {
    id: 'arb_btc_liquidity',
    asset: 'BTC / USDT',
    kind: 'obvious',
    seed: 610104,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 64_012, 64_040, 0.05),
      quote('Beta', 64_318, 64_352, 0.08, 30, 0.0005),
      quote('Gamma', 64_110, 64_150, 0.06),
    ],
    revealText:
      'Лучшая пара — Alpha → Beta, но на Beta покупали только 30 единиц. Даже с ухудшением исполнения полный размер оставался выгоднее.',
  },
  {
    id: 'arb_eth_dynamic',
    asset: 'ETH / USDT',
    kind: 'obvious',
    seed: 610105,
    durationSeconds: 15,
    dynamic: true,
    quotes: [
      quote('Alpha', 3_098.4, 3_099.6, 0.06),
      quote('Beta', 3_111.8, 3_113.2, 0.08),
      quote('Gamma', 3_101, 3_102.6, 0.1),
    ],
    revealText:
      'Расхождение между Alpha и Beta было реальным, но другие участники тоже его видели — котировки сошлись за несколько секунд.',
  },
  {
    id: 'arb_btc_dynamic',
    asset: 'BTC / USDT',
    kind: 'obvious',
    seed: 610106,
    durationSeconds: 15,
    dynamic: true,
    quotes: [
      quote('Alpha', 64_520, 64_558, 0.06),
      quote('Beta', 64_330, 64_362, 0.08),
      quote('Gamma', 64_790, 64_828, 0.1),
    ],
    revealText:
      'Beta отставала от рынка, Gamma убежала вперёд. Окно закрывалось с каждым обновлением котировок.',
  },

  /* B — ложный арбитраж: gross > 0, после комиссий < 0 */
  {
    id: 'arb_x_false',
    asset: 'ASSET X',
    kind: 'false',
    seed: 610201,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 99.7, 100, 0.1),
      quote('Beta', 100.15, 100.4, 0.1),
      quote('Gamma', 99.85, 100.12, 0.08),
    ],
    revealText:
      'Alpha → Beta выглядело как +0,15%, но две комиссии по 0,10% забирали 0,20%. Чистый результат — около −0,05%.',
  },
  {
    id: 'arb_btc_false',
    asset: 'BTC / USDT',
    kind: 'false',
    seed: 610202,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 64_402, 64_431, 0.12),
      quote('Beta', 64_520, 64_551, 0.1),
      quote('Gamma', 64_355, 64_398, 0.1),
    ],
    revealText:
      'Gamma → Beta давало около +0,19% по ценам, а комиссии в сумме — 0,20%. Расхождение почти целиком уходило на издержки.',
  },
  {
    id: 'arb_y_false',
    asset: 'ASSET Y',
    kind: 'false',
    seed: 610203,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 249.1, 249.4, 0.1),
      quote('Beta', 249.72, 249.98, 0.09),
      quote('Gamma', 249.3, 249.55, 0.07),
    ],
    revealText:
      'Alpha → Beta давало +0,13% до комиссий. Комиссии обеих площадок в сумме — 0,19%.',
  },
  {
    id: 'arb_eth_false',
    asset: 'ETH / USDT',
    kind: 'false',
    seed: 610204,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 3_120.1, 3_121.3, 0.1),
      quote('Beta', 3_126, 3_127.2, 0.1),
      quote('Gamma', 3_121.9, 3_123.1, 0.06),
    ],
    revealText:
      'Разница Alpha → Beta — около 0,15%. После двух комиссий по 0,10% сделка уходила в минус.',
  },

  /* C — нет возможности */
  {
    id: 'arb_x_none',
    asset: 'ASSET X',
    kind: 'none',
    seed: 610301,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 99.82, 100.02, 0.08),
      quote('Beta', 99.9, 100.1, 0.06),
      quote('Gamma', 99.78, 100, 0.05),
    ],
    revealText:
      'Цены отличались, но самая высокая цена продажи была ниже самой низкой цены покупки. Собрать сделку было не из чего.',
  },
  {
    id: 'arb_btc_none',
    asset: 'BTC / USDT',
    kind: 'none',
    seed: 610302,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 64_205, 64_244, 0.08),
      quote('Beta', 64_228, 64_262, 0.06),
      quote('Gamma', 64_190, 64_236, 0.05),
    ],
    revealText:
      'Площадки котировали почти одно и то же. Любая пара давала минус ещё до комиссий.',
  },

  /* D — несколько вариантов, один заметно лучше */
  {
    id: 'arb_x_multiple_liq',
    asset: 'ASSET X',
    kind: 'multiple',
    seed: 610401,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 99.55, 99.75, 0.08, 10, 0.01),
      quote('Beta', 100.3, 100.52, 0.1),
      quote('Gamma', 99.95, 100.05, 0.05),
    ],
    revealText:
      'Alpha давала самую дешёвую покупку, но только для 10 единиц. При полном объёме маршрут Gamma → Beta приносил больше благодаря глубине.',
  },
  {
    id: 'arb_eth_multiple',
    asset: 'ETH / USDT',
    kind: 'multiple',
    seed: 610402,
    durationSeconds: 15,
    quotes: [
      quote('Alpha', 3_104.2, 3_105.4, 0.05),
      quote('Beta', 3_117.5, 3_118.9, 0.1),
      quote('Gamma', 3_109.8, 3_111, 0.04),
    ],
    revealText:
      'Прибыльных маршрутов было три, но Alpha → Beta давал больше, чем два остальных вместе.',
  },
  {
    id: 'arb_x_multiple_dynamic',
    asset: 'ASSET X',
    kind: 'multiple',
    seed: 610403,
    durationSeconds: 15,
    dynamic: true,
    quotes: [
      quote('Alpha', 100.48, 100.66, 0.08),
      quote('Beta', 99.7, 99.88, 0.1),
      quote('Gamma', 100.21, 100.38, 0.05),
    ],
    revealText:
      'Beta → Alpha был лучшим маршрутом, Beta → Gamma — запасным. Когда котировки начали сходиться, закрылись оба.',
  },
]

export const crossArbitrageSessions: CrossArbitrageSession[] = [
  {
    id: 'arb_session_01',
    seed: 510301,
    scenarioIds: [
      'arb_btc_obvious',
      'arb_x_false',
      'arb_x_multiple_liq',
      'arb_eth_dynamic',
      'arb_x_liquidity',
    ],
  },
  {
    id: 'arb_session_02',
    seed: 510302,
    scenarioIds: [
      'arb_eth_multiple',
      'arb_btc_false',
      'arb_x_liquidity',
      'arb_y_false',
      'arb_btc_dynamic',
    ],
  },
  {
    id: 'arb_session_03',
    seed: 510303,
    scenarioIds: [
      'arb_y_obvious',
      'arb_x_liquidity',
      'arb_x_multiple_dynamic',
      'arb_eth_false',
      'arb_btc_liquidity',
    ],
  },
]

export function getCrossArbitrageScenario(id: string): CrossArbitrageScenario {
  return (
    crossArbitrageScenarios.find((scenario) => scenario.id === id) ??
    crossArbitrageScenarios[0]
  )
}

export function getCrossArbitrageSession(id?: string | null): CrossArbitrageSession {
  if (id) {
    const found = crossArbitrageSessions.find((session) => session.id === id)
    if (found) return found
  }
  return crossArbitrageSessions[0]
}

/** Выбор набора рынков по номеру попытки — при реплее рынки меняются. */
export function pickCrossArbitrageSession(attempt: number): CrossArbitrageSession {
  return crossArbitrageSessions[attempt % crossArbitrageSessions.length]
}

export function sessionScenarios(session: CrossArbitrageSession): CrossArbitrageScenario[] {
  return session.scenarioIds.map(getCrossArbitrageScenario)
}
