import { UpgradeCard, CARD_W, CARD_H } from './UpgradeCard.js'
import { ScrollView } from './ScrollView.js'

const GAP = 10
const COLS = 2

// Сетка апгрейдов 2xN со скроллом. Покупка идёт прямо во время гонки —
// это единственное действие игрока в оригинале.
export class UpgradeGrid {
  constructor(scene, state, x, y, w, h, onBuy) {
    this.scene_ = scene
    this.state = state
    this.viewW = w
    this.onBuy = onBuy
    this.view = new ScrollView(scene, x, y, w, h)
    this.cards = []
    this.build()
  }

  set locked(on) { this.view.locked = on }
  get locked() { return this.view.locked }

  build() {
    this.view.clearContent()
    this.cards = []

    const defs = this.state.clsDef.upgrades
    const offsetX = (this.viewW - (COLS * CARD_W + (COLS - 1) * GAP)) / 2
    defs.forEach((def, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const card = new UpgradeCard(
        this.scene_, this.state, def,
        offsetX + col * (CARD_W + GAP),
        row * (CARD_H + GAP),
        this.onBuy
      )
      this.view.inner.add(card)
      this.cards.push(card)
    })
    const rows = Math.ceil(defs.length / COLS)
    this.view.setContentHeight(rows * (CARD_H + GAP) - GAP)
  }

  refresh() {
    for (const c of this.cards) c.refresh()
  }
}
