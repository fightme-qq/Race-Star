import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SP, R } from '../../config/layout.js'
import { label } from '../widgets.js'
import { drawUpgradeIcon } from '../UpgradeIcon.js'
import { fitText } from '../layout.js'
import { hex, fmt, levelText, plusText, rarityOf, sideOf, SIDE_ICON_KEY } from './gearText.js'

export const GCARD_H = 62

const PAD = SP.sm + 2
// Векторная иконка стороны нарисована в 24px, а карточке нужна мельче —
// масштабируем саму графику, а не копируем фигуры со своими числами.
const ICON_SCALE = 0.6
const ICON_R = 12 * ICON_SCALE

// Мини-карточка предмета в сумке. Язык тот же, что у карточки драйвера: цвет
// редкости живёт в обводке и подписи, а не в заливке — на светлой теме цветная
// заливка съедает текст (тот же вывод, что у круга рейтинга в DriverCard).
export class GearCard extends Phaser.GameObjects.Container {
  constructor(scene, item, w, { title, value, onTap }) {
    super(scene, 0, 0)
    this.item = item
    this.boxW = w
    this.val = value
    this.selected = false

    const r = rarityOf(item)
    this.bg = scene.add.graphics()
    this.titleTxt = label(scene, PAD, 7, title, { size: 11, bold: true })
    this.rarityTxt = label(scene, PAD, 24, r.name + (item.plus ? ' ' + plusText(item) : ''),
      { size: 9, color: hex(r.color) })
    this.lvlTxt = label(scene, PAD, 40, levelText(item), { size: 9, color: CSS.muted })
    this.valTxt = label(scene, w - PAD - ICON_R * 2 - SP.xs, 38, fmt(value),
      { size: 11, bold: true, align: 'right' })
    this.add([this.bg, this.titleTxt, this.rarityTxt, this.lvlTxt, this.valTxt])

    // Имя слота бывает длиннее карточки («Chest Protector» против «Helmet»),
    // а редкость с плюсом — длиннее колонки: ужимаем по измеренной ширине.
    fitText(this.titleTxt, w - PAD * 2)
    fitText(this.rarityTxt, w - PAD * 2)
    fitText(this.lvlTxt, w - PAD * 2 - ICON_R * 2 - SP.xs - this.valTxt.width - SP.xs)

    this.setSize(w, GCARD_H)
    // Hit-area от левого верхнего угла (правило 10): содержимое от 0,0.
    this.setInteractive(new Phaser.Geom.Rectangle(w / 2, GCARD_H / 2, w, GCARD_H),
      Phaser.Geom.Rectangle.Contains)
    // Порог 12px: сетка скроллится, иначе протяжка выбирала бы предмет,
    // за который тянут (правило 4).
    let downAt = null
    this.on('pointerdown', (p) => { downAt = { x: p.x, y: p.y } })
    this.on('pointerout', () => { downAt = null })
    this.on('pointerup', (p) => {
      if (!downAt) return
      const moved = Phaser.Math.Distance.Between(downAt.x, downAt.y, p.x, p.y)
      downAt = null
      if (moved <= 12) onTap?.(this.item)
    })

    this.draw()
    scene.add.existing(this)
  }

  setSelected(on) {
    if (this.selected === on) return
    this.selected = on
    this.draw()
  }

  draw() {
    const r = rarityOf(this.item)
    this.bg.clear()
    this.bg.fillStyle(this.selected ? PAL.panel : PAL.panelAlt, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, GCARD_H, R.sm)
    this.bg.lineStyle(this.selected ? 2 : 1, this.selected ? PAL.accent : r.color, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, GCARD_H, R.sm)

    // Сторона — иконкой сетки апгрейдов, в ту же графику, что и лист карточки.
    this.bg.save()
    this.bg.translateCanvas(this.boxW - PAD - ICON_R, 44)
    this.bg.scaleCanvas(ICON_SCALE, ICON_SCALE)
    drawUpgradeIcon(this.bg, SIDE_ICON_KEY[sideOf(this.item.slot)], 0, 0)
    this.bg.restore()
  }
}
