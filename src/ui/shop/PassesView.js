import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { MONTHLY, FUNDS, BOOSTERS, IAP_NOTE } from '../../config/shop.js'
import { label } from '../widgets.js'
import { ShopRow, sectionCard, usd, ROW_H, HEAD_H } from './ShopRow.js'

// Витрина реальных денег целиком: месячные пассы, ступенчатые фонды и
// постоянные бустеры. Ничего из этого не продаётся, и гемовой цены им нарочно
// не придумано — `No Ads`, `Double Income Booster` и `x2 Resources` это
// ПОСТОЯННЫЕ множители дохода, то есть вторая ось разгона, которой в оригинале
// за игровую валюту нет (разбор — в шапке config/shop.js).
const GROUPS = [
  {
    key: 'monthly', head: 'MONTHLY PASSES',
    // «...activate special bonuses for 30 days after purchase. You can have
    // multiple Monthly Passes active at the same time» [E].
    items: MONTHLY.map((m) => ({ name: m.name, desc: m.desc, tag: `${m.days} Days`, usd: m.usd })),
  },
  {
    key: 'funds', head: 'FUNDS',
    // «Purchase the previous stage first» [E]: ступени открываются по очереди,
    // поэтому доступна всегда только первая.
    items: FUNDS.map((f) => ({
      name: `${f.name} · Stage 1`, desc: f.desc, tag: `Stage 1 of ${f.stages}`, usd: f.usd[0],
    })),
  },
  {
    key: 'boost', head: 'BOOSTERS',
    items: BOOSTERS.map((b) => ({ name: b.name, desc: b.desc, tag: '', usd: b.usd })),
  },
]

export class PassesView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast }) {
    super(scene, 0, 0)
    this.boxW = w

    this.bg = scene.add.graphics()
    this.note = label(scene, 14, 0, IAP_NOTE, { size: 10, color: CSS.dim })
    this.add([this.bg, this.note])

    this.groups = GROUPS.map((g) => {
      const head = label(scene, 14, 0, g.head, { size: 13, bold: true })
      const rows = g.items.map(() => new ShopRow(scene, w, () => toast?.(IAP_NOTE, PAL.muted)))
      this.add([head, ...rows])
      return { def: g, head, rows }
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  refresh() {
    let y = 0
    this.bg.clear()

    for (const group of this.groups) {
      const h = HEAD_H + ROW_H * group.rows.length + 8
      sectionCard(this.bg, y, this.boxW, h)
      group.head.setPosition(14, y + 13)
      group.def.items.forEach((item, i) => {
        group.rows[i].place(y + HEAD_H + i * ROW_H, {
          title: item.name, desc: item.desc, tag: item.tag,
          price: usd(item.usd), fill: PAL.line, enabled: false, dim: true,
        })
      })
      y += h + 12
    }

    this.note.setPosition(14, y)
    this.boxH = y + 18
  }
}
