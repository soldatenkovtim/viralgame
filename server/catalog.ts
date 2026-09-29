/** IDs/seeds must match the client catalog; checked by rooms.test.ts. */
export const roomMarkets = {
  'blind-market': [{ id: 'blind-aapl-intraday-01', seed: 1788183000 }, { id: 'blind-nvda-intraday-01', seed: 1788183000 }, { id: 'blind-btc-intraday-01', seed: 1787980500 }],
  'market-maker': [{ id: 'mm-noise-01', seed: 270431 }, { id: 'mm-toxic-01', seed: 401173 }, { id: 'mm-inventory-01', seed: 918264 }],
  'black-swan': [{"id": "shock-sp500-intraday-01", "seed": 1788967800}, {"id": "shock-gold-intraday-01", "seed": 1789048800}, {"id": "shock-nvda-intraday-01", "seed": 1788183000}],
  'cross-arbitrage': [{ id: 'arb-clean-01', seed: 510301 }, { id: 'arb-liquidity-01', seed: 510302 }, { id: 'arb-competing-01', seed: 510303 }],
}
