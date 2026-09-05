import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label, Button } from '../widgets.js'

export const ROW_H = 62
export const HEAD_H = 38

// Строка магазина: название, подпись, кнопка-ценник справа. Одна на все четыре
// вкладки — позиции отличаются только валютой и тем, продаются ли они вообще.
export class ShopRow extends Phaser.GameObjects.Container {
  constructor(scene, w, onPress) {
    super(scene, 0, 0)
    this.boxW = w
    this.title = label(scene, 14, 0, '', { size: 13, bold: true })
    this.desc = label(scene, 14, 0, '', { size: 11, color: CSS.muted })
    this.tag = label(scene, 14, 0, '', { size: 10, bold: true, color: CSS.gold })
    this.btn = new Button(scene, 0, 0, 104, 34, '', { size: 12 })
    this.btn.on('press', () => onPress?.())
    this.add([this.title, this.desc, this.tag, this.btn])
    scene.add.existing(this)
  }

  // `top` — верх строки в координатах вида. Раскладка здесь, а не в каждом
  // виде: четыре экрана с одинаковыми рядами разъехались бы по пикселю.
  place(top, { title, desc = '', tag = '', price, fill = PAL.accent, enabled = true, dim = false }) {
    this.title.setPosition(14, top + 10).setText(title).setAlpha(dim ? 0.55 : 1)
    this.desc.setPosition(14, top + (tag ? 42 : 30)).setAlpha(dim ? 0.55 : 1)
    // Подпись обрезается по ширине до ценника, а не переносится: длинная строка
    // уезжала ПОД кнопку и читалась как обрезанная случайно. Поймано `npm run
    // shot` — сборка и smoke на это молчат, текст рисуется целиком поверх.
    this.desc.setText(desc)
    const maxW = this.boxW - 128
    if (this.desc.width > maxW) {
      let cut = desc
      while (cut.length > 4 && this.desc.width > maxW) {
        cut = cut.slice(0, -2)
        this.desc.setText(cut + '…')
      }
    }
    this.tag.setPosition(14, top + 28).setText(tag).setVisible(!!tag)
    this.btn.setPosition(this.boxW - 60, top + ROW_H / 2)
    this.btn.setText(price)
    this.btn.setFill(fill)
    this.btn.setEnabled(enabled)
    return this
  }
}

// Карточка-подложка под группу строк. Рисуется в общий graphics вида: полсотни
// отдельных Graphics на экран стоили бы дороже, чем весь остальной магазин.
export function sectionCard(g, y, w, h) {
  g.fillStyle(PAL.panel, 1)
  g.fillRoundedRect(0, y, w, h, 14)
  g.lineStyle(1, PAL.line, 1)
  g.strokeRoundedRect(0, y, w, h, 14)
}

export const usd = (v) => '$' + v.toFixed(2)
