import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatNum, formatClock } from '../utils/format.js'
import { panel, label, Button } from './widgets.js'
import { AD_BOOST } from '../config/balance.js'

export const HEADER_H = 130

// Шапка ровно по кадру `ref/main-early.png`:
//   ряд 1 — белая пилюля с деньгами слева, «Income /s» и зелёное значение по
//           центру, белая пилюля с гемами справа;
//   ряд 2 — аватар карьеры слева, синяя «Activate 2x» по центру, тёмная
//           «CLASSES» справа.
// До шага 1 доход стоял слева, прижатый к аватару: четыре элемента не влезали
// в один ряд. В оригинале рядов два, и всё встаёт на место.
export class TopBar extends Phaser.GameObjects.Container {
  constructor(scene, state, { onBoost, onClasses, onCareer }) {
    super(scene, 0, 0)
    this.state = state
    const { width } = scene.scale

    panel(scene, 0, 0, width, HEADER_H, { fill: PAL.chrome, radius: 0 }).setDepth(-2)
    panel(scene, 14, 16, 132, 34, { fill: PAL.panel, radius: 17 }).setDepth(-1)
    panel(scene, width - 146, 16, 132, 34, { fill: PAL.panel, radius: 17 }).setDepth(-1)
    label(scene, 26, 24, '💵', { size: 15 })
    label(scene, width - 134, 24, '💎', { size: 15 })

    this.cashText = label(scene, 96, 25, '', { size: 14, bold: true, align: 'center' })
    this.gemsText = label(scene, width - 76, 25, '', { size: 14, bold: true, align: 'center' })

    label(scene, width / 2, 14, 'Income /s', { size: 12, color: CSS.text, align: 'center' })
    this.incomeText = label(scene, width / 2, 30, '', { size: 21, bold: true, align: 'center', color: CSS.greenDim })

    this.boostBtn = new Button(scene, width / 2, 84, 148, 34, 'Activate 2x', { size: 13 })
    this.boostBtn.on('press', onBoost)

    // [F] на кадрах слева от строки Income стоит аватар в рамке — это вход в
    // карьеру (`CareerPlayers`), отдельную от состава систему.
    this.careerBtn = new Button(scene, 46, 82, 56, 56, '👤', { fill: PAL.panelAlt, size: 24, radius: 12 })
    this.careerBtn.on('press', onCareer)
    this.careerDot = scene.add.circle(70, 58, 5, PAL.red).setVisible(false)
    this.careerLvl = label(scene, 46, 100, '', { size: 9, bold: true, align: 'center', color: CSS.muted })

    this.classBtn = new Button(scene, width - 76, 84, 130, 44,
      'CLASSES', { fill: PAL.dark, size: 13, radius: 10 })
    this.classBtn.on('press', onClasses)
    this.classIcon = label(scene, width - 128, 74, '', { size: 17 })
    this.classDot = scene.add.circle(width - 16, 66, 5, PAL.red)

    this.add([this.cashText, this.gemsText, this.incomeText, this.boostBtn,
      this.classBtn, this.careerBtn, this.careerDot, this.careerLvl,
      this.classIcon, this.classDot])
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    this.cashText.setText(formatMoney(s.cash).replace('$', ''))
    this.gemsText.setText(formatNum(s.gems))
    this.incomeText.setText(formatMoney(s.incomePerSec))
    this.incomeText.setColor(s.adBoostActive ? CSS.accent : CSS.greenDim)

    const used = s.cls.adBoostsUsed
    if (s.adBoostActive) {
      this.boostBtn.setText('2x  ' + formatClock(s.adBoostLeftSec))
    } else if (used >= AD_BOOST.maxPerClass) {
      this.boostBtn.setText('2x Limit Reached').setEnabled(false)
    } else {
      this.boostBtn.setText(`Activate 2x (${AD_BOOST.maxPerClass - used})`)
    }
    this.classIcon.setText(s.clsDef.icon)

    // Точка у аватара — есть нераспределённые очки навыка.
    const free = s.careerPoints
    this.careerLvl.setText('Lv. ' + s.career.level)
    this.careerDot.setVisible(free > 0)
  }
}
