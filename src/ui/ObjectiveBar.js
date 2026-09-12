import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { label } from './widgets.js'
import { fitText } from './layout.js'
import { SIDE, TOAST_LANE_Y, TOAST_LANE_H, DEPTH } from '../config/layout.js'

// Постоянная строка «что делать сейчас». Стоит в полосе всплывашек, а не в
// своём ряду: собственный ряд сдвинул бы всю вертикаль главного экрана, а она
// выверена по кадру оригинала. Полоса тостов для этого и годится — она пустая
// почти всё время, а тост (глубина 200) ложится поверх на свои 1.7 с и уходит.
//
// Почему это не то же самое, что обучение: туториал кончается через минуту, а
// «непонятно, что делать» возвращается на десятом часу, когда открылось шесть
// вкладок. Строка отвечает на этот вопрос всегда и одной фразой.
export class ObjectiveBar extends Phaser.GameObjects.Container {
  constructor(scene, state) {
    super(scene, 0, 0)
    this.state = state
    const W = scene.scale.width
    this.rect = new Phaser.Geom.Rectangle(SIDE, TOAST_LANE_Y, W - SIDE * 2, TOAST_LANE_H)

    this.bg = scene.add.graphics()
    this.text = label(scene, SIDE + 12, TOAST_LANE_Y + 6, '', { size: 12, bold: true, color: CSS.text })
    this.count = label(scene, W - SIDE - 12, TOAST_LANE_Y + 6, '', { size: 12, bold: true, color: CSS.accent, align: 'right' })
    this.add([this.bg, this.text, this.count])
    this.setDepth(DEPTH.objective)
    scene.add.existing(this)
    this.refresh()
  }

  // Подсветка обучения целится сюда, а union текстов дал бы прямоугольник уже
  // самой плашки — рамка легла бы внутрь неё.
  getBounds() { return Phaser.Geom.Rectangle.Clone(this.rect) }

  refresh() {
    const obj = this.state.tutorial.objective
    this.setVisible(!!obj)
    if (!obj) return

    const done = obj.at !== null && obj.now >= obj.at
    const { x, y, width: w, height: h } = this.rect
    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1).fillRoundedRect(x, y, w, h, h / 2)
    this.bg.lineStyle(1, done ? PAL.green : PAL.line, 1).strokeRoundedRect(x, y, w, h, h / 2)

    const counter = obj.at !== null ? `${Math.min(obj.now, obj.at)}/${obj.at}` : ''
    this.count.setText(counter)
    fitText(this.count.setFontSize(12), 60)
    fitText(this.text.setFontSize(12).setText('🎯  ' + obj.text), w - 40 - this.count.width)
  }
}
