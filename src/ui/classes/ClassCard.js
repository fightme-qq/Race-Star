import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { formatMoney, formatNum } from '../../utils/format.js'
import { label, Button } from '../widgets.js'

export const CLASS_CARD_H = 262
// Закрытый класс показывает только шапку: на карточке нечего выводить, кроме
// цены, а пустое белое поле в 260 пикселей выглядит как сломанная вёрстка.
export const CLASS_CARD_LOCKED_H = 88

// Карточка класса по кадру `ref/video/classes.png`. Семь блоков: иконка на
// плашке, имя, счётчики 👥/🍀, кнопка Watch (у активного — подпись Active),
// поле Team Name с карандашом, строка лиги со ссылкой Advance, три колонки
// SEASON/SCORE/RANK и синяя кнопка Details. До шага 1 у нас было три из семи.
export class ClassCard extends Phaser.GameObjects.Container {
  constructor(scene, state, def, w, { onPick, onUnlock, onRename, onAdvance, onDetails }) {
    super(scene, 0, 0)
    this.state = state
    this.def = def
    // Поле называется boxW, а не w: `Container.setPosition(x, y, z, w)` кладёт
    // четвёртый аргумент позиции в `this.w`, и вызов `card.setPosition(6, y)`
    // молча обнулял ширину — карточка схлопывалась в вертикальную полоску.
    this.boxW = w

    this.bg = scene.add.graphics()
    this.icon = label(scene, 40, 20, def.icon, { size: 30, align: 'center' })
    this.nameText = label(scene, 78, 16, def.name, { size: 19, bold: true })
    this.fans = label(scene, 78, 44, '', { size: 13, bold: true, color: CSS.accent })
    this.luck = label(scene, 146, 44, '', { size: 13, bold: true, color: CSS.greenDim })

    this.mainBtn = new Button(scene, w - 82, 38, 128, 44, 'Watch', { fill: PAL.green, size: 15 })
    this.mainBtn.on('press', () => {
      const cs = state.classes[def.id]
      if (cs.unlocked) onPick(def.id)
      else onUnlock(def.id)
    })

    this.capTeam = label(scene, 18, 78, 'Team Name', { size: 11, color: CSS.muted })
    this.teamText = label(scene, 30, 100, '', { size: 14 })
    this.pencil = new Button(scene, w - 38, 110, 36, 30, '✎', { fill: PAL.panel, color: CSS.dim, size: 17 })
    this.pencil.on('press', () => onRename(def.id))

    this.capLeague = label(scene, 18, 132, 'Current League', { size: 11, color: CSS.muted })
    this.leagueText = label(scene, 30, 154, '', { size: 14, bold: true })
    this.advance = new Button(scene, w - 62, 164, 88, 28, 'Advance',
      { fill: PAL.panelAlt, color: CSS.accent, size: 13 })
    this.advance.on('press', () => onAdvance(def.id))

    this.capScore = label(scene, 18, 186, 'Current Season Score', { size: 11, color: CSS.muted })
    this.cols = ['SEASON', 'SCORE', 'RANK'].map((cap, i) => ({
      cap: label(scene, 50 + i * 68, 210, cap, { size: 10, bold: true, color: CSS.muted, align: 'center' }),
      val: label(scene, 50 + i * 68, 226, '', { size: 14, align: 'center' }),
    }))
    this.details = new Button(scene, w - 74, 227, 112, 38, 'Details', { size: 14 })
    this.details.on('press', () => onDetails(def.id))

    this.extra = [this.capTeam, this.teamText, this.pencil, this.capLeague,
      this.leagueText, this.advance, this.capScore, this.details,
      ...this.cols.flatMap((c) => [c.cap, c.val])]

    this.add([this.bg, this.icon, this.nameText, this.fans, this.luck, this.mainBtn, ...this.extra])
    scene.add.existing(this)
  }

  get cardH() {
    return this.state.classes[this.def.id].unlocked ? CLASS_CARD_H : CLASS_CARD_LOCKED_H
  }

  drawFrame(unlocked, active) {
    const g = this.bg
    const w = this.boxW
    g.clear()
    g.fillStyle(PAL.panel, 1)
    g.fillRoundedRect(0, 0, w, this.cardH, 14)
    // [F] Активный класс подсвечен зелёной рамкой (кадр `classes-scrolled`).
    g.lineStyle(2, active ? PAL.green : PAL.line, 1)
    g.strokeRoundedRect(0, 0, w, this.cardH, 14)
    g.fillStyle(PAL.panelAlt, 1)
    g.fillRoundedRect(14, 12, 52, 52, 12)
    if (!unlocked) return
    g.fillRoundedRect(16, 92, w - 32, 34, 8)   // поле имени команды
    g.fillRoundedRect(16, 146, w - 32, 34, 8)  // строка лиги
    g.fillRoundedRect(16, 200, w - 32, 46, 8)  // три колонки счёта
  }

  refresh() {
    const s = this.state
    const cs = s.classes[this.def.id]
    const active = s.activeClass === this.def.id
    this.drawFrame(cs.unlocked, active)
    for (const o of this.extra) o.setVisible(cs.unlocked)

    if (!cs.unlocked) {
      const price = s.unlockPriceFor(this.def.id)
      this.fans.setText('Locked').setColor(CSS.muted)
      this.luck.setText('')
      this.mainBtn.setText('Unlock ' + formatMoney(price))
        .setFill(PAL.accent).setEnabled(s.cash >= price)
      return
    }

    const dist = s.winChanceOf(this.def.id)
    // RANK — ожидаемое место в заезде. Настоящая таблица лиги приходит на шаге 3.
    const expected = dist.reduce((acc, p, i) => acc + p * (i + 1), 0)
    this.fans.setText('👥 ' + formatNum(cs.fans)).setColor(CSS.accent)
    this.luck.setText('🍀 ' + Math.round(dist[0] * 100) + '%')
    this.teamText.setText(cs.teamName)
    this.leagueText.setText(s.leagueOf(this.def.id).name.toUpperCase())
    this.cols[0].val.setText(String(cs.season).padStart(3, '0'))
    this.cols[1].val.setText(String(cs.seasonScore))
    this.cols[2].val.setText(String(Math.round(expected)))

    this.mainBtn.setText(active ? 'Active' : 'Watch')
      .setFill(active ? PAL.panelAlt : PAL.green).setEnabled(!active)
  }
}
