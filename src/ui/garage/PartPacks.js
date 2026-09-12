import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { PART_BY_ID } from '../../config/garage.js'
import { SP } from '../../config/layout.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { card } from './cardBg.js'

const PACK_H = 112
const BTN_H = 32

// Паки частей — [E] `Unrevealed Garage Gear` / `Boost Your Ride`: части
// приходят тем же способом, что гир драйверов. Счётчик pity показан открыто,
// как на баннерах гачи: «Guaranteed ... in N draws».
//
// Купон — отдельная кнопка, а не замена цены: купон тратится только на x1
// (см. GameState.drawParts), и подмешивать его в цену значило бы, что игрок не
// видит, гемы у него ушли или купон.
export class PartPacks extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.add(this.bg)

    // Ширина кнопки считается ЗДЕСЬ: hit-area ставится в конструкторе Button от
    // (w, h), и поздняя правка boxW подвинула бы только рисунок (правило 10).
    this.btnW = (w - SP.lg * 2 - SP.sm * 2) / 3
    this.rows = state.partPacks.map((p) => {
      const name = label(scene, SP.lg, 0, p.pack.name, { size: 14, bold: true })
      const odds = label(scene, SP.lg, 0, this.oddsText(p.pack), { size: 10, color: CSS.muted })
      const pity = label(scene, SP.lg, 0, '', { size: 10, color: CSS.gold })
      const b1 = new Button(scene, 0, 0, this.btnW, BTN_H, '', { size: 12, fill: p.pack.color })
      const b10 = new Button(scene, 0, 0, this.btnW, BTN_H, '', { size: 12 })
      const coupon = new Button(scene, 0, 0, this.btnW, BTN_H, '', { size: 12, fill: PAL.gold })
      b1.on('press', () => this.draw(p.pack.id, 1, false))
      b10.on('press', () => this.draw(p.pack.id, 10, false))
      coupon.on('press', () => this.draw(p.pack.id, 1, true))
      this.add([name, odds, pity, b1, b10, coupon])
      return { name, odds, pity, b1, b10, coupon }
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  oddsText(pack) {
    return Object.entries(pack.odds)
      .map(([id, p]) => `${PART_BY_ID[id].name} ${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%`)
      .join(' · ')
  }

  draw(packId, count, useCoupon) {
    const got = this.state.drawParts(packId, count, useCoupon)
    if (!got) { this.toast?.(useCoupon ? 'No coupons' : 'Not enough Gems', PAL.red); return }
    const bag = this.state.parts
    const best = [...got].sort((a, b) => bag.valueOf(b) - bag.valueOf(a))[0]
    const r = PART_BY_ID[best.rarity]
    this.toast?.(`${r.name} part  ·  ${got.length} opened`, r.color)
    this.onChange?.()
  }

  refresh() {
    const bw = this.btnW
    let y = 0
    this.bg.clear()

    this.state.partPacks.forEach((p, i) => {
      const c = this.rows[i]
      card(this.bg, y, this.boxW, PACK_H)
      c.name.setY(y + SP.md)
      c.odds.setY(y + SP.md + 20)
      fitText(c.odds.setFontSize(10), this.boxW - SP.lg * 2)
      c.pity.setY(y + SP.md + 36)
        .setText(`Guaranteed ${PART_BY_ID[p.pack.pityRarity].name} in ${p.pityLeft} draws`)
      const by = y + PACK_H - SP.md - BTN_H / 2
      const btns = [
        [c.b1, `Open x1  ${p.pack.gems1} 💎`, p.can1],
        [c.b10, `Open x10  ${p.pack.gems10} 💎`, p.can10],
        [c.coupon, `Coupon (${p.coupons})`, p.coupons > 0],
      ]
      btns.forEach(([btn, text, on], k) => {
        btn.setPosition(SP.lg + (bw + SP.sm) * k + bw / 2, by)
        btn.setText(text).setEnabled(on)
        fitText(btn.txt.setFontSize(12), bw - SP.md)
      })
      y += PACK_H + SP.md
    })

    this.boxH = y
  }
}
