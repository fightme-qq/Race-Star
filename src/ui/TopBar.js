import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatNum, formatClock } from '../utils/format.js'
import { panel, label, Button } from './widgets.js'
import { AD_BOOST } from '../config/balance.js'

// Верхняя панель: деньги слева, гемы справа, "Income /s" по центру,
// под ним кнопка Activate 2x и вход в модалку классов — как на кадрах.
export class TopBar extends Phaser.GameObjects.Container {
  constructor(scene, state, { onBoost, onClasses, onCareer }) {
    super(scene, 0, 0)
    this.state = state

    panel(scene, 10, 8, 150, 30, { fill: PAL.panelAlt, radius: 15 }).setDepth(-1)
    panel(scene, 230, 8, 150, 30, { fill: PAL.panelAlt, radius: 15 }).setDepth(-1)

    this.cashText = label(scene, 22, 15, '', { size: 14, bold: true, color: CSS.green })
    this.gemsText = label(scene, 370, 15, '', { size: 14, bold: true, color: CSS.cyan, align: 'right' })

    // Порядок нижнего ряда — как на кадрах: [аватар] $1 [Activate 2x] [CLASSES].
    // Раньше доход стоял по центру экрана, но с появлением аватара четыре
    // элемента в ряд туда не влезли: кнопка классов накрыла собой значение
    // дохода. Значение сдвинуто влево, к аватару, а не ужато.
    label(scene, 110, 44, 'Income /s', { size: 11, color: CSS.muted, align: 'center' })
    this.incomeText = label(scene, 110, 55, '', { size: 18, bold: true, align: 'center' })

    this.boostBtn = new Button(scene, 205, 66, 108, 30, 'Activate 2x', { fill: PAL.accent, size: 11 })
    this.boostBtn.on('press', onBoost)

    // [F] на кадрах слева от строки Income стоит аватар — это вход в карьеру
    // (`CareerPlayers`), отдельную от состава систему.
    this.careerBtn = new Button(scene, 40, 66, 60, 30, '', { fill: PAL.panelAlt, size: 12 })
    this.careerBtn.on('press', onCareer)

    this.classBtn = new Button(scene, 322, 66, 116, 30, '🏎 CLASSES', { fill: PAL.panelAlt, size: 11 })
    this.classBtn.on('press', onClasses)

    this.add([this.cashText, this.gemsText, this.incomeText,
      this.boostBtn, this.classBtn, this.careerBtn])
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

    // Точка у аватара — есть нераспределённые очки навыка.
    const free = s.careerPoints
    this.careerBtn.setText(`👤 ${s.career.level}` + (free > 0 ? ' •' : ''))
    this.careerBtn.setFill(free > 0 ? PAL.accentDim : PAL.panelAlt)
  }
}
