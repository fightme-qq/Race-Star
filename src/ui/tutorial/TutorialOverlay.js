import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../../config/palette.js'
import { panel, label, Button } from '../widgets.js'
import { fitWrapped } from '../layout.js'
import { SIDE, RACE_Y, R } from '../../config/layout.js'
import { STEPS } from '../../config/tutorial.js'

const CARD_W = 330
const PAD = 16
const BTN_H = 38

// Куда смотрит шаг. Прямоугольники берём ИЗМЕРЕНИЕМ живых объектов, а не
// константами раскладки: карточка апгрейда ездит в скролле, а строка статов
// пересчитывается потоком в RacePanel.refresh — зашитые координаты подсветили
// бы пустое место ровно там, где текст длиннее обычного.
const TARGETS = {
  raceHead: (s) => new Phaser.Geom.Rectangle(SIDE, RACE_Y, s.scale.width - SIDE * 2, 76),
  raceStats: (s) => union(s.racePanel.offText, s.racePanel.defText, s.racePanel.modeText),
  firstCard: (s) => s.grid.cards[0]?.getBounds(),
  income: (s) => union(s.topBar.incomeText),
  objective: (s) => s.objective?.getBounds(),
}

const union = (...objs) => {
  const rects = objs.filter(Boolean).map((o) => o.getBounds())
  if (!rects.length) return null
  const out = Phaser.Geom.Rectangle.Clone(rects[0])
  for (const r of rects.slice(1)) Phaser.Geom.Rectangle.Union(out, r, out)
  return out
}

// Карточка обучения: заголовок, текст, кнопка. Живёт поверх всего, кроме
// тостов, и сама решает, встать ей выше или ниже подсвеченного места.
export class TutorialCard extends Phaser.GameObjects.Container {
  constructor(scene, { onNext, onSkip }) {
    super(scene, 0, 0)
    this.W = scene.scale.width
    // Суффикс Btn/Text не для красоты: у Container заняты не только `list`,
    // `name` и `w` (правило 11), но и `next` — он геттер, и `this.next = ...`
    // роняет сборку экрана целиком. Поймано `npm run shot`: сцена не поднялась,
    // а сборка при этом зелёная.
    this.bg = scene.add.graphics()
    this.titleText = label(scene, 0, 0, '', { size: 16, bold: true })
    this.bodyText = label(scene, 0, 0, '', { size: 13, color: CSS.muted })
    this.bodyText.setWordWrapWidth(CARD_W - PAD * 2)
    this.stepText = label(scene, 0, 0, '', { size: 10, bold: true, color: CSS.accent })
    this.hintText = label(scene, 0, 0, '', { size: 12, bold: true, color: CSS.accent, align: 'right' })

    this.nextBtn = new Button(scene, 0, 0, 108, 38, 'Next', { radius: R.md })
    this.nextBtn.on('press', onNext)
    this.skipBtn = new Button(scene, 0, 0, 92, 30, 'Skip', {
      fill: PAL.panelAlt, color: CSS.muted, size: 11, radius: R.md,
    })
    this.skipBtn.on('press', onSkip)

    this.add([this.bg, this.stepText, this.titleText, this.bodyText, this.hintText,
      this.nextBtn, this.skipBtn])
    scene.add.existing(this)
  }

  // avoid — прямоугольник подсветки: карточка встаёт с той стороны от него,
  // где больше места. Иначе на шаге про карточку апгрейда (низ экрана) она
  // накрыла бы ровно то, на что показывает.
  show(index, stepDef, avoid) {
    this.setVisible(true)
    this.stepText.setText(`STEP ${index + 1} / ${STEPS.length}`)
    this.titleText.setText(stepDef.title)
    fitWrapped(this.bodyText.setFontSize(13).setText(stepDef.body), CARD_W - PAD * 2, 90)

    const waiting = !!stepDef.await
    this.nextBtn.setVisible(!waiting)

    // Вертикаль карточки считается ОДНОЙ цепочкой сверху вниз, как вертикаль
    // главного экрана: метка шага → заголовок → текст → ряд кнопок. Раньше
    // высота и положение кнопок были двумя независимыми формулами, и ряд
    // кнопок наезжал на вторую строку текста — Button центрируется по Y, а
    // считалось от его верхнего края.
    const bodyY = PAD + 38
    const bodyH = this.bodyText.height
    const rowY = bodyY + bodyH + 14          // верх ряда кнопок
    const h = rowY + BTN_H + PAD
    const x = Math.round((this.W - CARD_W) / 2)
    const below = avoid ? avoid.bottom + 18 : 0
    const above = avoid ? avoid.y - 18 - h : 0
    const y = !avoid
      ? Math.round((this.scene.scale.height - h) / 2)
      : (this.scene.scale.height - below >= h + 20 ? below : Math.max(12, above))

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1).fillRoundedRect(x, y, CARD_W, h, R.lg)
    this.bg.lineStyle(2, PAL.accent, 1).strokeRoundedRect(x, y, CARD_W, h, R.lg)

    this.stepText.setPosition(x + PAD, y + PAD - 2)
    this.titleText.setPosition(x + PAD, y + PAD + 14)
    this.bodyText.setPosition(x + PAD, y + bodyY)

    const btnCY = y + rowY + BTN_H / 2
    this.nextBtn.setPosition(x + CARD_W - PAD - 54, btnCY)
    // На ждущем шаге вместо «Next» стоит подсказка действия — она объясняет,
    // чего от игрока ждут, а кнопки под ней нет по построению: нажатие на неё
    // засчитало бы шаг, которого игрок не сделал.
    this.hintText.setText(waiting ? (stepDef.hint || '') : '')
    this.hintText.setPosition(x + CARD_W - PAD, btnCY - 7)
    // «Skip» доступен всегда: обучение, из которого нельзя выйти, — не
    // обучение, а замок. На ждущем шаге он единственная кнопка, и без него
    // игрок без денег заперт до конца первой минуты.
    this.skipBtn.setPosition(x + PAD + 46, btnCY)
    this.skipBtn.setText(waiting ? 'Skip this' : 'Skip')
    return this
  }

  hide() { this.setVisible(false); return this }
}

// Цель шага может ещё не существовать (сетка не построена, строка цели скрыта).
// Тогда шаг показывается без подсветки, а не роняет сцену.
export const targetRect = (scene, key) => {
  if (!key || !TARGETS[key]) return null
  try { return TARGETS[key](scene) || null } catch { return null }
}
