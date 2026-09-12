import { UpgradeCard, CARD_W, CARD_H } from './UpgradeCard.js'
import { ScrollView } from './ScrollView.js'
import { PAL } from '../config/palette.js'
import { CARD, GRID_PEEK } from '../config/layout.js'

const GAP = CARD.gap
const COLS = 2

// Сетка апгрейдов 2xN со скроллом. Покупка идёт прямо во время гонки —
// это единственное действие игрока в оригинале.
export class UpgradeGrid {
  constructor(scene, state, x, y, w, h, onBuy) {
    this.scene_ = scene
    this.state = state
    this.viewW = w
    this.onBuy = onBuy
    // Затухание цветом фона экрана ровно по выглядывающему ряду: он гаснет,
    // а не обрывается срезом. Высота полосы равна высоте «выглядывания» —
    // тогда она никогда не залезает на полностью видимую карточку.
    this.view = new ScrollView(scene, x, y, w, h, { fade: PAL.bg, fadeH: GRID_PEEK })
    this.cards = []
    this.build()
  }

  set locked(on) { this.view.locked = on }
  get locked() { return this.view.locked }

  build() {
    this.view.clearContent()
    this.cards = []

    const defs = this.state.clsDef.upgrades
    const offsetX = Math.round((this.viewW - (COLS * CARD_W + (COLS - 1) * GAP)) / 2)
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
    // Нижнее поле, чтобы последний ряд не упирался в кромку маски.
    this.view.setContentHeight(rows * (CARD_H + GAP) - GAP + 6)
  }

  refresh() {
    for (const c of this.cards) c.refresh()
  }
}
