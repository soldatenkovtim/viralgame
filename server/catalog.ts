// Versioned, deterministic standard markets. Covered against the game catalog by tests.
export const roomMarkets = {
  'blind-market': [
    { id: 'blind_01', seed: 730114 }, { id: 'blind_02', seed: 481907 }, { id: 'blind_03', seed: 269533 },
  ],
  'market-maker': [
    { id: 'mm_informed_rally', seed: 401173 }, { id: 'mm_late_informed', seed: 918264 }, { id: 'mm_informed_break', seed: 553902 },
  ],
  'black-swan': [
    { id: 'shock_trend_collapse', seed: 310220 }, { id: 'shock_v_reversal', seed: 240805 },
    { id: 'shock_false_breakdown', seed: 230310 }, { id: 'shock_liquidity_crisis', seed: 200309 }, { id: 'shock_second_leg', seed: 230313 },
  ],
  'cross-arbitrage': [
    { id: 'arb_session_01', seed: 510301 }, { id: 'arb_session_02', seed: 510302 }, { id: 'arb_session_03', seed: 510303 },
  ],
}
