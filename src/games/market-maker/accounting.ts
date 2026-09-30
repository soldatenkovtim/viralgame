/** Quantities are asset units, not lots. Hedge fees are kept outside cash. */
export class MarketMakerAccount {
  cash: number
  inventory = 0
  averageEntry: number | null = null
  hedgeCosts = 0
  carryCosts = 0
  transactionCosts = 0
  /** Realized trading PnL before separately recorded costs. */
  realizedPnl = 0
  readonly initialCapital: number

  constructor(initialCapital = 0) {
    this.initialCapital = initialCapital
    this.cash = initialCapital
  }

  /** Positive quantity buys; negative quantity sells at the actual execution price. */
  execute(quantity: number, price: number, transactionCost = 0): void {
    if (quantity === 0) return
    const next = this.inventory + quantity
    if (this.inventory !== 0 && Math.sign(quantity) !== Math.sign(this.inventory)) {
      const closed = Math.min(Math.abs(quantity), Math.abs(this.inventory))
      this.realizedPnl += closed * Math.sign(this.inventory) * (price - this.averageEntry!)
    }
    if (this.inventory === 0 || Math.sign(quantity) === Math.sign(this.inventory)) {
      this.averageEntry =
        (Math.abs(this.inventory) * (this.averageEntry ?? 0) + Math.abs(quantity) * price) /
        Math.abs(next)
    } else if (next === 0) {
      this.averageEntry = null
    } else if (Math.sign(next) !== Math.sign(this.inventory)) {
      this.averageEntry = price
    }
    this.cash -= price * quantity + transactionCost
    this.transactionCosts += transactionCost
    this.inventory = next
  }

  chargeCarry(cost: number): void {
    this.cash -= cost
    this.carryCosts += cost
  }

  hedge(mark: number, cost: number): void {
    this.execute(-this.inventory, mark)
    this.hedgeCosts += cost
  }

  openInventoryPnl(mark: number): number {
    return this.inventory * (mark - (this.averageEntry ?? mark))
  }

  totalPnl(mark: number): number {
    return this.cash + this.inventory * mark - this.initialCapital - this.hedgeCosts
  }
}
