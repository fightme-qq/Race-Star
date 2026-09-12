import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney, formatNum, formatClock } from '../utils/format.js'
import { panel, label, Button } from './widgets.js'
import { fitText } from './layout.js'
import { HEADER_H, SCREEN, R, DEPTH } from '../config/layout.js'
import { AD_BOOST } from '../config/balance.js'

export { HEADER_H }

// Шапка по кадру `ref/main-early.png`, но с посчитанной, а не подобранной
// раскладкой второго ряда.
//
// Было: boost — центр width/2, ширина 148 (121..269); classes — центр width-76,
// ширина 130 (249..379). При width=390 это ДВАДЦАТЬ пикселей наложения, и
// правый край «Activate 2x» уходил под чёрную плашку. На 430px-макете, с
// которого раскладку снимали, они как раз расходились — отсюда и ошибка.
// Стало: ряд делится на три колонки от левого края к правому, ширина средней
// кнопки — ОСТАТОК между соседями, а не собственная константа.
const ROW1_Y = 10
const PILL_W = 120
const PILL_H = 34

const ROW2_Y = 66
const ROW2_H = 46
const AVA_W = 52
const CLASS_W = 122
const GAP = 8

export class TopBar extends Phaser.GameObjects.Container {
  constructor(scene, state, { onBoost, onClasses, onCareer }) {
    super(scene, 0, 0)
    this.state = state
    const W = scene.scale.width || SCREEN.w

    panel(scene, 0, 0, W, HEADER_H, { fill: PAL.chrome, radius: 0 }).setDepth(DEPTH.behind)

    // --- ряд 1: деньги | доход | гемы ---
    const gemsX = W - 12 - PILL_W
    panel(scene, 12, ROW1_Y, PILL_W, PILL_H, { fill: PAL.panel, radius: PILL_H / 2 }).setDepth(-1)
    panel(scene, gemsX, ROW1_Y, PILL_W, PILL_H, { fill: PAL.panel, radius: PILL_H / 2 }).setDepth(-1)
    label(scene, 24, ROW1_Y + 8, '💵', { size: 15 })
    label(scene, gemsX + 12, ROW1_Y + 8, '💎', { size: 15 })

    // Текст пилюли центрируется в остатке ПОСЛЕ иконки, а не по центру пилюли:
    // иначе «14.4K» стояло вплотную к 💵 и с запасом справа.
    this.cashText = label(scene, 12 + (PILL_W + 22) / 2, ROW1_Y + 9, '',
      { size: 14, bold: true, align: 'center' })
    this.gemsText = label(scene, gemsX + (PILL_W + 22) / 2, ROW1_Y + 9, '',
      { size: 14, bold: true, align: 'center' })

    // Колонка дохода живёт строго между пилюлями: 132..258 при W=390.
    this.incomeMaxW = gemsX - (12 + PILL_W) - 12
    label(scene, W / 2, ROW1_Y - 2, 'Income /s', { size: 11, color: CSS.text, align: 'center' })
    this.incomeText = label(scene, W / 2, ROW1_Y + 12, '',
      { size: 20, bold: true, align: 'center', color: CSS.greenDim })
    // [X] Строки НЕТ на кадрах, и она добавлена сознательно: в шапке стоит
    // доход АКТИВНОГО класса [F], а параллельный доход покинутых классов —
    // главный множитель поздней игры — без неё был бы игроку невидим.
    this.idleText = label(scene, W / 2, ROW1_Y + 39, '', { size: 10, align: 'center', color: CSS.muted })

    // --- ряд 2: аватар | 2x | классы ---
    const boostX = 12 + AVA_W + GAP                 // 72
    const classX = W - 12 - CLASS_W                 // 256
    const boostW = classX - GAP - boostX            // 176 — остаток, не константа

    // [F] слева от дохода на кадрах аватар в рамке — вход в карьеру.
    this.careerBtn = new Button(scene, 12 + AVA_W / 2, ROW2_Y + ROW2_H / 2, AVA_W, ROW2_H, '👤',
      { fill: PAL.panelAlt, size: 22, radius: R.md })
    this.careerBtn.on('press', onCareer)
    this.careerDot = scene.add.circle(12 + AVA_W - 4, ROW2_Y + 4, 5, PAL.red).setVisible(false)
    // Уровень ПОД аватаром, а не на его нижней кромке: раньше метка стояла на
    // y=100 при кнопке 54..110 и перечёркивала её собственную рамку.
    this.careerLvl = label(scene, 12 + AVA_W / 2, ROW2_Y + ROW2_H + 3, '',
      { size: 9, bold: true, align: 'center', color: CSS.muted })

    this.boostBtn = new Button(scene, boostX + boostW / 2, ROW2_Y + ROW2_H / 2, boostW, ROW2_H,
      'Activate 2x', { size: 13 })
    this.boostBtn.on('press', onBoost)
    this.boostMaxW = boostW - 20

    // Иконка класса уехала ВНУТРЬ подписи кнопки. Отдельной меткой она стояла
    // на фиксированном x и при короткой подписи прилипала к букве C («🚙CLASSES»
    // на кадре parallel). Одним текстом Phaser центрирует связку сам.
    this.classBtn = new Button(scene, classX + CLASS_W / 2, ROW2_Y + ROW2_H / 2, CLASS_W, ROW2_H,
      'CLASSES', { fill: PAL.dark, size: 12, radius: R.md })
    this.classBtn.on('press', onClasses)
    this.classMaxW = CLASS_W - 16
    this.classDot = scene.add.circle(W - 18, ROW2_Y + 4, 5, PAL.red)

    this.add([this.cashText, this.gemsText, this.incomeText, this.idleText, this.boostBtn,
      this.classBtn, this.careerBtn, this.careerDot, this.careerLvl, this.classDot])
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    fitText(this.cashText.setFontSize(14).setText(formatMoney(s.cash).replace('$', '')), PILL_W - 30)
    fitText(this.gemsText.setFontSize(14).setText(formatNum(s.gems)), PILL_W - 30)

    // Кегль каждый раз возвращаем к базовому: fitText умеет только уменьшать,
    // и после «$3.37K» значение «$1» осталось бы мелким навсегда.
    fitText(this.incomeText.setFontSize(20).setText(formatMoney(s.activeIncomePerSec)), this.incomeMaxW)
    this.incomeText.setColor(s.adBoostActive ? CSS.accent : CSS.greenDim)

    const idle = s.idleIncomePerSec
    fitText(this.idleText.setFontSize(10).setText(idle > 0 ? `+ ${formatMoney(idle)} /s idle` : ''), 200)

    const used = s.cls.adBoostsUsed
    if (s.adBoostActive) this.boostBtn.setText('2x  ' + formatClock(s.adBoostLeftSec))
    else if (used >= AD_BOOST.maxPerClass) this.boostBtn.setText('2x Limit Reached').setEnabled(false)
    else this.boostBtn.setText(`Activate 2x (${AD_BOOST.maxPerClass - used})`)
    fitText(this.boostBtn.txt.setFontSize(13), this.boostMaxW)

    this.classBtn.setText(`${s.clsDef.icon}  CLASSES`)
    fitText(this.classBtn.txt.setFontSize(12), this.classMaxW)

    this.careerLvl.setText('Lv. ' + s.career.level)
    this.careerDot.setVisible(s.careerPoints > 0)
  }
}
