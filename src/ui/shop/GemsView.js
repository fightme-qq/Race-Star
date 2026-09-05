import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { GEM_PACKS, IAP_NOTE } from '../../config/shop.js'
import { label } from '../widgets.js'
import { ShopRow, sectionCard, usd, ROW_H, HEAD_H } from './ShopRow.js'
import { formatNum } from '../../utils/format.js'

// Лестница гемовых паков — то, ради чего магазин в оригинале и существует.
// Имена [E] из локализации билда, из цен известна ровно одна (`Pile of Gems
// $1.99` [F] с витрины). Позиции показаны и НЕ продаются: реальных покупок в
// сборке нет, а выдавать их бесплатно значило бы обнулить всю экономику гемов.
export class GemsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w

    this.bg = scene.add.graphics()
    this.head = label(scene, 14, 0, 'GEMS', { size: 13, bold: true })
    this.note = label(scene, 14, 0, IAP_NOTE, { size: 10, color: CSS.dim })
    this.hint = label(scene, w - 14, 0, '', { size: 11, color: CSS.muted, align: 'right' })
    this.add([this.bg, this.head, this.note, this.hint])

    this.rows = GEM_PACKS.map(() => new ShopRow(scene, w, () => toast?.(IAP_NOTE, PAL.muted)))
    this.add(this.rows)

    this.boxH = 0
    scene.add.existing(this)
  }

  refresh() {
    const h = HEAD_H + ROW_H * GEM_PACKS.length + 26
    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, h)
    this.head.setPosition(14, 13)
    this.hint.setPosition(this.boxW - 14, 14).setText(`You have ${formatNum(this.state.gems)} 💎`)

    GEM_PACKS.forEach((pack, i) => {
      this.rows[i].place(HEAD_H + i * ROW_H, {
        title: pack.name,
        desc: `${formatNum(pack.gems)} 💎`,
        tag: pack.tag || '',
        price: usd(pack.usd),
        fill: PAL.line, enabled: false, dim: true,
      })
    })

    this.note.setPosition(14, HEAD_H + ROW_H * GEM_PACKS.length + 4)
    this.boxH = h
  }
}
