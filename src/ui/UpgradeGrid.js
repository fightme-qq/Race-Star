import Phaser from 'phaser'
import { UpgradeCard, CARD_W, CARD_H } from './UpgradeCard.js'

const GAP = 10
const COLS = 2

// Сетка апгрейдов 2xN со скроллом. Покупка идёт прямо во время гонки —
// это единственное действие игрока в оригинале.
export class UpgradeGrid extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h, onBuy) {
    super(scene, x, y)
    this.scene_ = scene
    this.state = state
    this.viewW = w
    this.viewH = h
    this.onBuy = onBuy

    this.inner = scene.add.container(0, 0)
    this.add(this.inner)

    const mask = scene.make.graphics({ x: 0, y: 0, add: false })
    mask.fillStyle(0xffffff)
    mask.fillRect(x, y, w, h)
    this.setMask(mask.createGeometryMask())

    this.cards = []
    this.scrollY = 0
    this.locked = false
    this.build()
    this.wireScroll(x, y, w, h)
    scene.add.existing(this)
  }

  build() {
    this.cards.forEach((c) => c.destroy())
    this.cards = []
    this.inner.removeAll()

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
      this.inner.add(card)
      this.cards.push(card)
    })
    const rows = Math.ceil(defs.length / COLS)
    this.contentH = rows * (CARD_H + GAP) - GAP
    this.scrollY = 0
    this.inner.y = 0
  }

  // Скролл слушаем на уровне сцены, а не через Zone: Zone с topOnly
  // перехватывала бы pointerdown у кнопок покупки внутри карточек.
  wireScroll(x, y, w, h) {
    const input = this.scene_.input
    let dragging = false
    let startY = 0
    let startScroll = 0
    const inside = (p) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h

    input.on('pointerdown', (p) => {
      if (this.locked || !inside(p)) return
      dragging = true
      startY = p.y
      startScroll = this.scrollY
    })
    input.on('pointermove', (p) => {
      if (!dragging || !p.isDown) return
      this.setScroll(startScroll + (p.y - startY))
    })
    input.on('pointerup', () => { dragging = false })
    input.on('wheel', (p, objs, dx, dy) => {
      if (this.locked || !inside(p)) return
      this.setScroll(this.scrollY - dy * 0.5)
    })
  }

  setScroll(value) {
    const min = Math.min(0, this.viewH - this.contentH)
    this.scrollY = Phaser.Math.Clamp(value, min, 0)
    this.inner.y = this.scrollY
  }

  refresh() {
    for (const c of this.cards) c.refresh()
  }
}
