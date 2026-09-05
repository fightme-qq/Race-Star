import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label } from '../widgets.js'
import { ShopRow, sectionCard, ROW_H, HEAD_H } from './ShopRow.js'
import { timeLeft } from '../rewards/TasksView.js'
import { formatMoney } from '../../utils/format.js'

// Единственная вкладка магазина, которая влияет на баланс: гемы -> деньги.
// Выплата хранится в СЕКУНДАХ дохода, а на экране разворачивается в сумму,
// которую игрок получит сейчас, — как награды вкладки 5 (rewards/reward.js).
export class CashView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.head = label(scene, 14, 0, 'CASH FOR GEMS', { size: 13, bold: true })
    this.timer = label(scene, w - 14, 0, '', { size: 11, color: CSS.muted, align: 'right' })
    this.note = label(scene, 14, 0, '', { size: 10, color: CSS.dim })
    this.add([this.bg, this.head, this.timer, this.note])

    this.rows = state.cashPacks.map((row) => new ShopRow(scene, w, () => this.buy(row.pack.id)))
    this.add(this.rows)

    this.boxH = 0
    scene.add.existing(this)
  }

  buy(id) {
    const cash = this.state.buyCashPack(id)
    if (!cash) {
      this.toast?.('Not enough Gems', PAL.red)
      return
    }
    this.toast?.('+' + formatMoney(cash), PAL.greenDim)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const rows = s.cashPacks
    const h = HEAD_H + ROW_H * rows.length + 26
    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, h)
    this.head.setPosition(14, 13)
    this.timer.setPosition(this.boxW - 14, 14).setText(`Resets in ${timeLeft(s.resetInSec('daily'))}`)

    rows.forEach((row, i) => {
      const sold = row.left === 0
      this.rows[i].place(HEAD_H + i * ROW_H, {
        title: row.pack.name,
        // Сумма считается от ТЕКУЩЕГО дохода: тот же пак в конце игры стоит на
        // порядки больше, чем в начале, и подпись обязана это показывать.
        desc: `${formatMoney(s.incomePerSec * row.seconds)}  ·  ${row.left} / ${row.pack.perDay} left today`,
        price: sold ? 'Sold out' : `${row.pack.gems} 💎`,
        fill: sold ? PAL.line : PAL.accent,
        enabled: row.available,
        dim: sold,
      })
    })

    this.note.setPosition(14, HEAD_H + ROW_H * rows.length + 4)
      .setText('Payout scales with your income · limited per day')
    this.boxH = h
  }
}
