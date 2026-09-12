import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatGain } from '../utils/format.js'
import { label, Button, tapZone } from './widgets.js'
import { fitText, fitWrapped, vcenter } from './layout.js'
import { CARD } from '../config/layout.js'
import { upgradeEffect, isUpgradeLocked } from '../systems/UpgradeSystem.js'
import { TROPHY_UNLOCK_AT } from '../config/balance.js'

import { drawUpgradeIcon, EMOJI } from './UpgradeIcon.js'

// [F] Тег текстом («OFFENSE») в оригинале на карточке не выводится вовсе —
// тип слота закодирован цветом иконки, см. UpgradeIcon.js.

export const CARD_W = CARD.w
export const CARD_H = CARD.h

// Вертикаль карточки одной лентой: каждый блок начинается там, где кончился
// предыдущий, плюс зазор. Раньше числа стояли независимо, и плашка эффекта
// (74..102) пересекалась с кнопкой (97..131) на 5px — на кадре кнопка сидела
// на сером прямоугольнике.
const L = {
  pad: 10,
  iconY: 10, iconS: 42,
  nameY: 11, nameH: 32,
  chipY: 52, chipH: 16, chipW: 46,
  plateY: 72, plateH: 24,
  btnY: 102, btnH: 34,
}
const NAME_X = L.pad + L.iconS + 8              // 60
const INFO_W = 20

export class UpgradeCard extends Phaser.GameObjects.Container {
  constructor(scene, state, def, x, y, onBuy, onInfo) {
    super(scene, x, y)
    this.state = state
    this.def = def

    this.bg = scene.add.graphics()
    this.icon = label(scene, L.pad + L.iconS / 2, L.iconY + 11, EMOJI[def.key] || '⚙',
      { size: 20, align: 'center' })

    // Ширина имени считается от правого края МИНУС место под ⓘ. Было: имя
    // переносилось по ширине CARD_W-76 от x=60, то есть до 156, а значок ⓘ
    // стоял на 143..157 — «Attacking» упиралось прямо в него.
    this.nameMaxW = CARD_W - NAME_X - INFO_W - L.pad
    this.nameText = label(scene, NAME_X, L.nameY, def.name, { size: 13, bold: true })
    this.nameText.setLineSpacing(-1)
    fitWrapped(this.nameText, this.nameMaxW, L.nameH, 10)

    this.infoDot = label(scene, CARD_W - L.pad, L.nameY, 'ⓘ', { size: 13, color: CSS.dim, align: 'right' })
    // ⓘ был НАРИСОВАН, но не нажимался: `label` — обычный текст без
    // setInteractive, и единственная подсказка на карточке молчала на тап.
    // Своя зона 34x34 вокруг значка, потому что 13px — не тап-цель; в
    // кнопку `Upgrade` (y 102..136) она не заходит, значит ничего не крадёт.
    this.infoBtn = tapZone(scene, CARD_W - L.pad - 7, L.nameY + 7, 34, 34,
      () => onInfo?.(this.def))

    this.lvlText = label(scene, NAME_X + L.chipW / 2, L.chipY, '', { size: 10, color: CSS.muted, align: 'center' })

    const mid = CARD_W / 2
    this.curText = label(scene, mid - 12, L.plateY, '', { size: 13, bold: true, align: 'right', color: CSS.muted })
    this.arrow = label(scene, mid, L.plateY, '→', { size: 12, align: 'center', color: CSS.dim })
    this.nextText = label(scene, mid + 12, L.plateY, '', { size: 13, bold: true, color: CSS.greenDim })

    this.buyBtn = new Button(scene, mid, L.btnY + L.btnH / 2, CARD_W - 2 * L.pad - 2, L.btnH, 'Upgrade',
      { size: 13, chip: true })
    this.buyBtn.on('press', () => onBuy(def.key))

    this.add([this.bg, this.icon, this.nameText, this.infoDot, this.infoBtn, this.lvlText,
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
    // Плашка иконки, чип уровня и плашка эффекта — все `panelAlt`, как на кадре.
    g.fillStyle(PAL.panelAlt, 1)
    g.fillRoundedRect(L.pad, L.iconY, L.iconS, L.iconS, 10)
    g.fillRoundedRect(NAME_X, L.chipY, L.chipW, L.chipH, 5)
    g.fillRoundedRect(L.pad, L.plateY, CARD_W - 2 * L.pad, L.plateH, 8)
    // Боевые слоты рисуются вектором, экономические остаются эмодзи.
    this.icon.setVisible(!drawUpgradeIcon(g, this.def.key, L.pad + L.iconS / 2, L.iconY + L.iconS / 2))
  }

  refresh() {
    const s = this.state
    const def = this.def
    const level = s.levelOf(def.key)
    const eff = upgradeEffect(def, level)
    const price = s.priceOf(def.key)

    // Чип и обе половины плашки центрируются по ИЗМЕРЕННОЙ высоте текста:
    // «Lv. 0» раньше сидело баз-лайном ровно на нижней кромке чипа.
    vcenter(this.lvlText.setText('Lv. ' + level), L.chipY, L.chipH)

    // Формат строки эффекта — с кадров: боевые «16% → 18%», денежные
    // «+$6 → +$9», Grandstands без знака и единицы — «10 → 15».
    const fmt = (v) =>
      eff.unit === '%' ? v.toFixed(0) + '%'
      : eff.unit === '$' ? '+$' + formatGain(v)
      : formatGain(v)
    fitText(this.curText.setFontSize(13).setText(fmt(eff.current)), 58)
    fitText(this.nextText.setFontSize(13).setText(fmt(eff.next)), 58)
    vcenter(this.curText, L.plateY, L.plateH)
    vcenter(this.nextText, L.plateY, L.plateH)
    vcenter(this.arrow, L.plateY, L.plateH)

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
