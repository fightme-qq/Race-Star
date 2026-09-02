import Phaser from 'phaser'
import { PAL, CSS, FONT, textOn } from '../config/palette.js'

// Мелкие переиспользуемые примитивы плоского мобильного UI.

export function panel(scene, x, y, w, h, { fill = PAL.panel, radius = 12, stroke = null, alpha = 1 } = {}) {
  const g = scene.add.graphics()
  g.fillStyle(fill, alpha)
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
// `chip` — вложенный ценник справа, как в оригинале: `[ Upgrade    $25 ]`.
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, text, opts = {}) {
    super(scene, x, y)
    this.boxW = w
    this.boxH = h
    this.opts = { fill: PAL.accent, fillDisabled: PAL.line, radius: 10, size: 13, bold: true, chip: false, ...opts }
    this.bg = scene.add.graphics()
    this.txt = scene.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: this.opts.size + 'px',
      color: this.opts.color || textOn(this.opts.fill),
      fontStyle: this.opts.bold ? 'bold' : 'normal',
    }).setOrigin(0.5)
    this.add([this.bg, this.txt])
    if (this.opts.chip) {
      this.chipTxt = scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: (this.opts.size - 1) + 'px', color: CSS.onDark, fontStyle: 'bold',
      }).setOrigin(0.5)
      this.add(this.chipTxt)
    }
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

  setText(text) { this.txt.setText(text); this.redraw(); return this }

  setChip(text) { this.chipTxt?.setText(text); this.redraw(); return this }

  setEnabled(on) {
    if (this.enabled === on) return this
    this.enabled = on
    this.redraw()
    return this
  }

  setFill(color) { this.opts.fill = color; this.redraw(); return this }

  redraw() {
    const { fill, fillDisabled, radius, chip, chipFill } = this.opts
    const active = fill && this.enabled ? fill : fillDisabled
    this.bg.clear()
    this.bg.fillStyle(active, 1)
    this.bg.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, radius)
    this.txt.setColor(this.opts.color || textOn(active))
    this.txt.setAlpha(this.enabled ? 1 : 0.55)

    if (!chip || !this.chipTxt) return
    // Ценник прижат к правому краю, подпись — к левой части остатка.
    const cw = Math.max(46, this.chipTxt.width + 18)
    const cx = this.boxW / 2 - cw / 2 - 4
    this.bg.fillStyle(chipFill || PAL.accentDim, this.enabled ? 1 : 0.5)
    this.bg.fillRoundedRect(cx - cw / 2, -this.boxH / 2 + 4, cw, this.boxH - 8, radius - 4)
    this.chipTxt.setPosition(cx, 0).setAlpha(this.enabled ? 1 : 0.55)
    this.txt.setPosition(-this.boxW / 2 + (this.boxW - cw) / 2, 0)
  }
}

// Горизонтальная полоса прогресса.
export class Bar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, color = PAL.accent, track = PAL.panelAlt) {
    super(scene, x, y)
    this.boxW = w; this.boxH = h; this.color = color; this.track = track
    this.g = scene.add.graphics()
    this.add(this.g)
    this.setValue(0)
    scene.add.existing(this)
  }

  setValue(ratio) {
    const r = Phaser.Math.Clamp(ratio, 0, 1)
    this.g.clear()
    this.g.fillStyle(this.track, 1)
    this.g.fillRoundedRect(0, 0, this.boxW, this.boxH, this.boxH / 2)
    if (r > 0.01) {
      this.g.fillStyle(this.color, 1)
      this.g.fillRoundedRect(0, 0, Math.max(this.boxH, this.boxW * r), this.boxH, this.boxH / 2)
    }
  }
}
