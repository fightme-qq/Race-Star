import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatNum } from '../utils/format.js'
import { label, Button } from './widgets.js'
import { upgradeEffect, isUpgradeLocked } from '../systems/UpgradeSystem.js'
import { TROPHY_UNLOCK_AT } from '../config/balance.js'

const TAG_COLOR = { offense: PAL.red, defense: PAL.cyan, income: PAL.green, fans: PAL.purple }
const TAG_NAME = { offense: 'OFFENSE', defense: 'DEFENSE', income: 'INCOME', fans: 'FANS' }

export const CARD_W = 178
export const CARD_H = 118

// Карточка апгрейда: название, тег, уровень, "текущий -> следующий", кнопка покупки.
export class UpgradeCard extends Phaser.GameObjects.Container {
  constructor(scene, state, def, x, y, onBuy) {
    super(scene, x, y)
    this.state = state
    this.def = def

    this.bg = scene.add.graphics()
    this.tagBg = scene.add.graphics()

    // Название занимает всю ширину и переносится на 2 строки — тег ушёл ниже.
    this.nameText = label(scene, 11, 9, def.name, { size: 11, bold: true })
    this.nameText.setWordWrapWidth(CARD_W - 22)
    this.nameText.setLineSpacing(-1)

    this.tagText = label(scene, 17, 44, TAG_NAME[def.tag], { size: 8, bold: true })
    this.lvlText = label(scene, CARD_W - 11, 44, '', { size: 10, color: CSS.muted, align: 'right' })
    this.effText = label(scene, 11, 60, '', { size: 13, bold: true, color: CSS.accent })

    this.buyBtn = new Button(scene, CARD_W / 2, CARD_H - 22, CARD_W - 22, 30, '', { size: 13 })
    this.buyBtn.on('press', () => onBuy(def.key))

    this.add([this.bg, this.tagBg, this.nameText, this.tagText, this.lvlText, this.effText, this.buyBtn])
    this.drawFrame()
    scene.add.existing(this)
  }

  drawFrame() {
    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, CARD_W, CARD_H, 12)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 12)

    const color = TAG_COLOR[this.def.tag]
    this.tagBg.clear()
    this.tagBg.fillStyle(color, 0.2)
    this.tagBg.fillRoundedRect(11, 41, this.tagText.width + 12, 15, 7)
    this.tagText.setColor('#' + color.toString(16).padStart(6, '0'))
  }

  refresh() {
    const s = this.state
    const def = this.def
    const level = s.levelOf(def.key)
    const eff = upgradeEffect(def, level)
    const price = s.priceOf(def.key)

    this.lvlText.setText('Lv. ' + level)
    const fmt = (v) => (eff.unit === '$' ? formatMoney(v) : eff.unit === '%' ? v.toFixed(0) + '%' : formatNum(v))
    this.effText.setText(`${fmt(eff.current)} → ${fmt(eff.next)}`)

    if (isUpgradeLocked(def, s)) {
      this.buyBtn.setText(`${s.trophiesEarned} / ${TROPHY_UNLOCK_AT} 🏆`).setEnabled(false)
      return
    }
    this.buyBtn.setText(def.currency === 'trophy' ? price + ' 🏆' : formatMoney(price))
    this.buyBtn.setFill(def.currency === 'trophy' ? PAL.gold : PAL.green)
    this.buyBtn.setEnabled(s.canBuy(def.key))
  }
}
