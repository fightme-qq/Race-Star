import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'

// Мелкие переиспользуемые примитивы плоского мобильного UI.

export function panel(scene, x, y, w, h, { fill = PAL.panel, radius = 12, stroke = null } = {}) {
  const g = scene.add.graphics()
  g.fillStyle(fill, 1)
  g.fillRoundedRect(x, y, w, h, radius)
  if (stroke !== null) {
    g.lineStyle(1, stroke, 1)
    g.strokeRoundedRect(x, y, w, h, radius)
  }
  return g
}

export function label(scene, x, y, text, { size = 12, color = CSS.text, align = 'left', bold = false } = {}) {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: size + 'px',
    color,
    fontStyle: bold ? 'bold' : 'normal',
    align,
  })
  if (align === 'center') t.setOrigin(0.5, 0)
  else if (align === 'right') t.setOrigin(1, 0)
  return t
}

// Кнопка-плашка с закруглением. onClick вызывается только если enabled.
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, text, opts = {}) {
    super(scene, x, y)
    this.w = w
    this.h = h
    this.opts = { fill: PAL.green, fillDisabled: PAL.line, radius: 10, size: 13, bold: true, ...opts }
    this.bg = scene.add.graphics()
    this.txt = scene.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: this.opts.size + 'px',
      color: CSS.text,
      fontStyle: this.opts.bold ? 'bold' : 'normal',
    }).setOrigin(0.5)
    this.add([this.bg, this.txt])
    this.setSize(w, h)
    // Hit-area контейнера задаётся от ЛЕВОГО ВЕРХНЕГО угла, даже когда сам
    // контейнер центрирован: Phaser перед проверкой прибавляет к точке
    // displayOrigin (= width/2, height/2). Прямоугольник -w/2..w/2 из-за этого
    // уезжал на полширины влево — правая половина кнопки не нажималась, а
    // пустое место слева от неё нажималось. Нашлось smoke-тестом драйверов.
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
    this.enabled = true
    this.downAt = null
    // Срабатываем на отпускании и только если палец не уехал — иначе
    // скролл сетки апгрейдов случайно покупал бы то, за что тянули.
    this.on('pointerdown', (p) => { if (this.enabled) this.downAt = { x: p.x, y: p.y } })
    this.on('pointerout', () => { this.downAt = null })
    this.on('pointerup', (p) => {
      if (!this.enabled || !this.downAt) return
      const moved = Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y)
      this.downAt = null
      if (moved > 12) return
      scene.tweens.add({ targets: this, scale: 0.94, duration: 60, yoyo: true })
      this.emit('press')
    })
    this.redraw()
    scene.add.existing(this)
  }

  setText(text) { this.txt.setText(text); return this }

  setEnabled(on) {
    if (this.enabled === on) return this
    this.enabled = on
    this.redraw()
    return this
  }

  setFill(color) { this.opts.fill = color; this.redraw(); return this }

  redraw() {
    const { fill, fillDisabled, radius } = this.opts
    this.bg.clear()
    this.bg.fillStyle(this.enabled ? fill : fillDisabled, 1)
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, radius)
    this.txt.setAlpha(this.enabled ? 1 : 0.45)
  }
}

// Горизонтальная полоса прогресса.
export class Bar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, color = PAL.accent) {
    super(scene, x, y)
    this.w = w; this.h = h; this.color = color
    this.g = scene.add.graphics()
    this.add(this.g)
    this.setValue(0)
    scene.add.existing(this)
  }

  setValue(ratio) {
    const r = Phaser.Math.Clamp(ratio, 0, 1)
    this.g.clear()
    this.g.fillStyle(PAL.line, 1)
    this.g.fillRoundedRect(0, 0, this.w, this.h, this.h / 2)
    if (r > 0.01) {
      this.g.fillStyle(this.color, 1)
      this.g.fillRoundedRect(0, 0, Math.max(this.h, this.w * r), this.h, this.h / 2)
    }
  }
}
