# Historical market data

Frozen historical OHLCV datasets from Yahoo Finance. `manifest.json` records source links, exact periods, row counts and SHA-256 hashes of the original `*.source.json` responses. Runtime imports only the compact candle files, never source responses.

- Archived daily Blind Market (retained for existing duel links): AAPL (2023-01-03–2023-07-31), NVDA (2023-01-03–2023-09-27), BTC-USD (2022-11-01–2023-03-30).
- Market Shock: ^GSPC (COVID sell-off), GC=F (gold futures, March 2020 liquidation and recovery), META (February 2022 earnings gap; traded as FB then).

Extraction copies `indicators.quote[0]` open/high/low/close/volume without interpolation, simulated bars, price scaling or volume scaling. Equity OHLC supplied by Yahoo is split-adjusted (not dividend-adjusted `adjclose`). In particular NVDA's 2023 prices reflect subsequent stock splits. Session timestamps are normalized to the same UTC calendar date at midnight so DST does not merge daily bars; the provider timestamps remain in source files. Weekends and exchange holidays remain gaps.

BTC-USD is the provider's consolidated USD series, not Binance BTC/USDT. Its volume uses the provider's aggregate definition. ^GSPC volume is the provider's index-associated volume, not tradable index units. GC=F is the provider's continuous/front-contract series: contract changes can affect price and volume; it is not a single expiry. No order-book liquidity is inferred from OHLCV.

All modes use immutable historical OHLCV. Standard Blind Market now uses the versioned intraday datasets described below. Advanced has separate IDs and difficulty settings; its historical datasets are currently shared with Standard, and Blind decision checkpoints differ. Never replace an existing published ID's candles: publish a new versioned ID when a market changes, so shared challenges stay reproducible.

The game reveals the asset, period and source only after completion. This is UI concealment for a client-side prototype, not protection against inspecting downloaded JavaScript.

`src/scenario-engine/scenarios.test.ts` verifies each candle against its original provider response and checks its hash. Weekly candles are formed only from currently visible daily bars; no future data enters aggregation.

Standard Blind Market hints use `blind-benchmark.json` (^GSPC, 2022-11-01–2023-08-31). They are frozen at the first visible checkpoint: sample standard deviation of 20 daily returns, mean high-low range relative to open, recent volume ratio, 20-bar asset return and distance to its moving average. Correlation uses Pearson correlation of returns between 21 matching session dates; both assets use the same intervals, so crypto weekends are not paired with single-day index returns. The benchmark return uses those same intervals. Sector descriptions reveal only the selected broad industry, not the instrument, event or date. No future candles enter any hint.


## Restored intraday Blind Market

Active Standard scenarios use `aapl-intraday.json`, `nvda-intraday.json`, and `btc-intraday.json`, with `benchmark-intraday.json` for S&P 500 comparisons. Their exact frozen periods and source hashes are in the manifest. These are original 15-minute OHLCV observations, not subdivisions of daily candles. Null observations and the provider's extra closing-price snapshots outside the equity session are omitted. No future or currently forming bars are included in the selected periods.

15m / 1h / 4h / 1d views and replay derive from this one base series. Hints now explicitly describe 15-minute returns and ranges; correlation aligns identical timestamp intervals with the benchmark and is limited to the first decision's visible history. Old daily IDs remain disabled for random selection but resolvable for previously shared duels. New datasets use new scenario IDs.
