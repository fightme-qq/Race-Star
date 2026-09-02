import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatGain } from '../utils/format.js'
import { label, Button } from './widgets.js'
import { upgradeEffect, isUpgradeLocked } from '../systems/UpgradeSystem.js'
import { TROPHY_UNLOCK_AT } from '../config/balance.js'

import { drawUpgradeIcon, EMOJI } from './UpgradeIcon.js'

// [F] Тег текстом («OFFENSE») в оригинале на карточке не выводится вовсе —
// тип слота закодирован цветом иконки, см. UpgradeIcon.js.

export const CARD_W = 172
export const CARD_H = 138

// Карточка апгрейда: иконка, название в две строки, чип уровня, плашка
// «текущий → следующий», синяя кнопка Upgrade с вложенным ценником.
export class UpgradeCard extends Phaser.GameObjects.Container {
  constructor(scene, state, def, x, y, onBuy) {
    super(scene, x, y)
    this.state = state
    this.def = def

    this.bg = scene.add.graphics()

    this.icon = label(scene, 33, 22, EMOJI[def.key] || '⚙', { size: 20, align: 'center' })
    // Название занимает оставшуюся ширину и переносится на 2 строки.
    this.nameText = label(scene, 60, 14, def.name, { size: 13, bold: true })
    this.nameText.setWordWrapWidth(CARD_W - 76)
    this.nameText.setLineSpacing(-1)
    this.infoDot = label(scene, CARD_W - 22, 12, 'ⓘ', { size: 14, color: CSS.dim, align: 'center' })

    this.lvlText = label(scene, 60, 58, '', { size: 11, color: CSS.muted })
    this.curText = label(scene, CARD_W / 2 - 14, 84, '', { size: 13, bold: true, align: 'right', color: CSS.muted })
    this.arrow = label(scene, CARD_W / 2, 84, '→', { size: 12, align: 'center', color: CSS.dim })
    this.nextText = label(scene, CARD_W / 2 + 14, 84, '', { size: 13, bold: true, color: CSS.greenDim })

    this.buyBtn = new Button(scene, CARD_W / 2, CARD_H - 24, CARD_W - 22, 34, 'Upgrade',
      { size: 13, chip: true })
    this.buyBtn.on('press', () => onBuy(def.key))

    this.add([this.bg, this.icon, this.nameText, this.infoDot, this.lvlText,
      this.curText, this.arrow, this.nextText, this.buyBtn])
    this.drawFrame()
    scene.add.existing(this)
  }

  drawFrame() {
    const g = this.bg
    g.clear()
    g.fillStyle(PAL.panel, 1)
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, 12)
    g.lineStyle(1, PAL.line, 1)
    g.strokeRoundedRect(0, 0, CARD_W, CARD_H, 12)
    // Плашка иконки и плашка эффекта — оба `panelAlt`, как на кадре.
    g.fillStyle(PAL.panelAlt, 1)
    g.fillRoundedRect(11, 11, 44, 44, 10)
    g.fillRoundedRect(11, 74, CARD_W - 22, 28, 8)
    g.fillRoundedRect(58, 54, 44, 18, 6)
    // Боевые слоты рисуются вектором, экономические остаются эмодзи.
    this.icon.setVisible(!drawUpgradeIcon(g, this.def.key, 33, 33))
  }

  refresh() {
    const s = this.state
    const def = this.def
    const level = s.levelOf(def.key)
    const eff = upgradeEffect(def, level)
    const price = s.priceOf(def.key)

    this.lvlText.setText('Lv. ' + level)
    // Формат строки эффекта — с кадров: боевые «16% → 18%», денежные
    // «+$6 → +$9», Grandstands без знака и единицы — «10 → 15».
    const fmt = (v) =>
      eff.unit === '%' ? v.toFixed(0) + '%'
      : eff.unit === '$' ? '+$' + formatGain(v)
      : formatGain(v)
    this.curText.setText(fmt(eff.current))
    this.nextText.setText(fmt(eff.next))

    if (isUpgradeLocked(def, s)) {
      this.buyBtn.setText('Locked').setChip(`${s.trophiesEarned}/${TROPHY_UNLOCK_AT} 🏆`).setEnabled(false)
      return
    }
    this.buyBtn.setText('Upgrade')
    this.buyBtn.setChip(def.currency === 'trophy' ? price + ' 🏆' : formatMoney(price))
    this.buyBtn.setFill(def.currency === 'trophy' ? PAL.gold : PAL.accent)
    this.buyBtn.opts.chipFill = def.currency === 'trophy' ? 0xd2860a : PAL.accentDim
    this.buyBtn.setEnabled(s.canBuy(def.key))
  }
}
