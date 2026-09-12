import Phaser from 'phaser'
import { PAL, CSS, textOn } from '../../config/palette.js'
import { label } from '../widgets.js'
import { fitText } from '../layout.js'

export const CHIP_W = 100
export const CHIP_H = 42

// Одна карта альбома. Состояний четыре, и все четыре обязаны читаться без
// подписи-легенды: есть / нет / золотая / можно открыть Wild Card.
//   есть      — заливка цветом редкости, буква белая;
//   нет       — серый контур, буква серая;
//   золотая   — золотое кольцо поверх заливки [E] «Golden Cards»;
//   Wild      — на недостающей карте подпись WILD, и только тогда карта нажимается.
// Буква, а не картинка: ассетов в сборке нет, а `Uncommon` в 100px не влезает
// тем же кеглем, каким читается редкость.
export class CardChip extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, { onTap }) {
    super(scene, x, y)
    this.boxW = w
    this.boxH = CHIP_H
    this.bg = scene.add.graphics()
    this.letter = label(scene, w / 2, 3, '', { size: 16, bold: true, align: 'center' })
    this.sub = label(scene, w / 2, 26, '', { size: 9, align: 'center' })
    this.add([this.bg, this.letter, this.sub])

    // Hit-area от ЛЕВОГО ВЕРХНЕГО угла: содержимое нарисовано от 0,0, а Phaser
    // перед проверкой прибавляет displayOrigin (правило 10).
    this.setSize(w, CHIP_H)
    this.setInteractive(new Phaser.Geom.Rectangle(w / 2, CHIP_H / 2, w, CHIP_H),
      Phaser.Geom.Rectangle.Contains)
    let downAt = null
    this.on('pointerdown', (p) => { downAt = { x: p.x, y: p.y } })
    this.on('pointerout', () => { downAt = null })
    this.on('pointerup', (p) => {
      if (!downAt || !this.tappable) return
      const moved = Phaser.Math.Distance.Between(downAt.x, downAt.y, p.x, p.y)
      downAt = null
      if (moved <= 12) onTap?.(this.cardIndex)
    })
    scene.add.existing(this)
  }

  // `card` — строка из albumRows(): {index, rarity, owned, golden}.
  refresh(card, wildReady) {
    this.cardIndex = card.index
    this.tappable = !card.owned && wildReady
    const c = card.rarity.color

    this.bg.clear()
    this.bg.fillStyle(card.owned ? c : PAL.panelAlt, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, CHIP_H, 8)
    this.bg.lineStyle(card.golden ? 2.5 : 1, card.golden ? PAL.gold : card.owned ? c : PAL.dim, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, CHIP_H, 8)

    this.letter.setText(card.rarity.name[0])
    this.letter.setColor(card.owned ? textOn(c) : CSS.dim)
    this.sub.setColor(card.owned ? textOn(c) : this.tappable ? CSS.accent : CSS.dim)
    fitText(this.sub.setFontSize(9).setText(
      card.golden ? 'GOLDEN' : this.tappable ? 'USE WILD' : card.rarity.name.toUpperCase()
    ), this.boxW - 8)
    return this
  }
}
