import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatNum, formatClock } from '../utils/format.js'
import { panel, label, Button } from './widgets.js'
import { AD_BOOST } from '../config/balance.js'

// Верхняя панель: деньги слева, гемы справа, "Income /s" по центру,
// под ним кнопка Activate 2x и вход в модалку классов — как на кадрах.
export class TopBar extends Phaser.GameObjects.Container {
  constructor(scene, state, { onBoost, onClasses }) {
    super(scene, 0, 0)
    this.state = state

    panel(scene, 10, 8, 150, 30, { fill: PAL.panelAlt, radius: 15 }).setDepth(-1)
    panel(scene, 230, 8, 150, 30, { fill: PAL.panelAlt, radius: 15 }).setDepth(-1)

    this.cashText = label(scene, 22, 15, '', { size: 14, bold: true, color: CSS.green })
    this.gemsText = label(scene, 370, 15, '', { size: 14, bold: true, color: CSS.cyan, align: 'right' })

    label(scene, 195, 44, 'Income /s', { size: 11, color: CSS.muted, align: 'center' })
    this.incomeText = label(scene, 195, 57, '', { size: 20, bold: true, align: 'center' })

    this.boostBtn = new Button(scene, 300, 66, 148, 30, 'Activate 2x', { fill: PAL.accent, size: 12 })
    this.boostBtn.on('press', onBoost)

    this.classBtn = new Button(scene, 90, 66, 148, 30, '🏎 CLASSES', { fill: PAL.panelAlt, size: 12 })
    this.classBtn.on('press', onClasses)

    this.add([this.cashText, this.gemsText, this.incomeText, this.boostBtn, this.classBtn])
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    this.cashText.setText('💵 ' + formatMoney(s.cash))
    this.gemsText.setText(formatNum(s.gems) + ' 💎')
    this.incomeText.setText(formatMoney(s.incomePerSec))
    this.incomeText.setColor(s.adBoostActive ? CSS.accent : CSS.text)

    const used = s.cls.adBoostsUsed
    if (s.adBoostActive) {
      this.boostBtn.setText('2x ' + formatClock(s.adBoostLeftSec))
    } else if (used >= AD_BOOST.maxPerClass) {
      this.boostBtn.setText('2x — лимит').setEnabled(false)
    } else {
      this.boostBtn.setText(`Activate 2x (${AD_BOOST.maxPerClass - used})`)
    }
    this.classBtn.setText(s.clsDef.icon + '  ' + s.clsDef.name.toUpperCase())
  }
}
