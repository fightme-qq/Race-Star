import Phaser from 'phaser'
import { PAL } from '../../config/palette.js'

const FILL = 0x0a1424
const ALPHA = 0.72

// Затемнение с ДЫРКОЙ: подсвеченный элемент остаётся виден и нажимаем, всё
// вокруг гаснет и тапы не пропускает.
//
// Дырка собрана из ЧЕТЫРЁХ прямоугольников вокруг цели, а не из маски с
// вычитанием. Причина не в простоте: маска гасит только пиксели, а тапы ходят
// мимо неё — игрок в обучающем шаге «нажми Upgrade» мог бы нажать что угодно,
// включая вкладку, которая ещё закрыта. Четыре прямоугольника — это заодно и
// четыре зоны перехвата, то есть подсветка и блокировка гарантированно
// описывают одну и ту же геометрию (разъехаться им нечем).
export class Spotlight extends Phaser.GameObjects.Container {
  constructor(scene, onTapOutside) {
    super(scene, 0, 0)
    this.W = scene.scale.width
    this.H = scene.scale.height
    this.g = scene.add.graphics()
    this.frame = scene.add.graphics()
    this.add([this.g, this.frame])

    // Зоны создаются один раз и переставляются: пересоздание на каждом шаге
    // оставляло бы висеть слушатели предыдущего.
    this.zones = [0, 1, 2, 3].map(() => {
      const z = scene.add.zone(0, 0, 1, 1).setOrigin(0)
      z.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1, 1), Phaser.Geom.Rectangle.Contains)
      z.on('pointerup', () => onTapOutside?.())
      this.add(z)
      return z
    })
    scene.add.existing(this)
  }

  // rect = null — гасим весь экран без дырки (шаги без цели).
  show(rect) {
    const pad = 6
    const r = rect
      ? new Phaser.Geom.Rectangle(
        Math.max(0, rect.x - pad), Math.max(0, rect.y - pad),
        rect.width + pad * 2, rect.height + pad * 2)
      : new Phaser.Geom.Rectangle(0, -1, 0, 0)

    this.g.clear().fillStyle(FILL, ALPHA)
    // top / bottom / left / right — в этом же порядке лежат зоны.
    const parts = [
      { x: 0, y: 0, w: this.W, h: Math.max(0, r.y) },
      { x: 0, y: r.bottom, w: this.W, h: Math.max(0, this.H - r.bottom) },
      { x: 0, y: r.y, w: Math.max(0, r.x), h: r.height },
      { x: r.right, y: r.y, w: Math.max(0, this.W - r.right), h: r.height },
    ]
    parts.forEach((p, i) => {
      if (p.w > 0 && p.h > 0) this.g.fillRect(p.x, p.y, p.w, p.h)
      const z = this.zones[i]
      z.setPosition(p.x, p.y).setSize(Math.max(0, p.w), Math.max(0, p.h))
      z.input.hitArea.setTo(0, 0, Math.max(0, p.w), Math.max(0, p.h))
    })

    this.frame.clear()
    this.scene.tweens.killTweensOf(this.frame)
    if (!rect) return this
    this.frame.lineStyle(2, PAL.accent, 1).strokeRoundedRect(r.x, r.y, r.width, r.height, 12)
    this.scene.tweens.add({
      targets: this.frame, alpha: 0.25, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    return this
  }
}
