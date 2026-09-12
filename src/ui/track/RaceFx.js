import { PAL, CSS, FONT } from '../../config/palette.js'

// Разовые эффекты: искры на обгоне, вспышка линии старт/финиш, всплывающая
// подпись у машины игрока.
//
// Вспышка линии — не украшение. Круг игрока раньше «заканчивался» телепортом
// точки, и это читалось как сбой. Теперь пересечение линии отмечается ровно
// там, где линия нарисована, и служит той же цели: показать, что круг закрыт.
const SPARKS = 64
const LABELS = 3

export class RaceFx {
  constructor(scene, path) {
    this.path = path
    this.g = scene.add.graphics()
    this.sparks = []
    this.flash = 0
    this.flashCol = 0xffffff
    this.labels = []
    for (let i = 0; i < LABELS; i++) {
      const t = scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold',
        color: CSS.onDark, stroke: '#02081e', strokeThickness: 3,
      }).setOrigin(0.5, 1).setAlpha(0)
      this.labels.push(t)
    }
    this.scene = scene
  }

  get layers() { return [this.g, ...this.labels] }

  // Искры летят ПОПЕРЁК курса в обе стороны: так виден момент расхождения
  // двух машин, а не просто подсветка одной.
  burst(x, y, dx, dy, color, n = 7) {
    const mx = -dy, my = dx
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= SPARKS) break
      const s = (i % 2 ? 1 : -1) * (0.5 + Math.abs(Math.sin(i * 2.3)))
      this.sparks.push({
        x, y,
        vx: mx * s * 38 - dx * 24, vy: my * s * 38 - dy * 24,
        life: 0.42, max: 0.42, color,
      })
    }
  }

  flashLine(color = 0xffffff) {
    this.flash = 1
    this.flashCol = color
  }

  label(x, y, text, color = CSS.onDark) {
    // Берём самую выцветшую плашку: так новая подпись никогда не затирает ту,
    // что ещё читается.
    const t = this.labels.reduce((a, b) => (a.alpha <= b.alpha ? a : b))
    this.scene.tweens.killTweensOf(t)
    t.setText(text).setColor(color).setPosition(x, y - 12).setAlpha(1).setScale(0.8)
    this.scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, delay: 260 })
  }

  update(dt) {
    const g = this.g
    g.clear()

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      if (s.life <= 0) { this.sparks.splice(i, 1); continue }
      const k = s.life / s.max
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt
      g.lineStyle(1.6 * k + 0.4, s.color, k)
      g.beginPath()
      g.moveTo(s.x, s.y)
      g.lineTo(nx, ny)
      g.strokePath()
      s.x = nx
      s.y = ny
      s.vx *= 0.90
      s.vy *= 0.90
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.2)
      const f = this.path.at(0)
      const half = 14
      for (const [width, alpha] of [[7, 0.28], [3, 0.85]]) {
        g.lineStyle(width, this.flashCol, this.flash * alpha)
        g.beginPath()
        g.moveTo(f.x - f.nx * half, f.y - f.ny * half)
        g.lineTo(f.x + f.nx * half, f.y + f.ny * half)
        g.strokePath()
      }
    }
  }

  // Финиш заезда: клетчатая вспышка золотом и место игрока подписью. Раньше
  // о конце заезда на карте не говорило НИЧЕГО — точки просто оказывались на
  // старте.
  finish(car, place) {
    this.flashLine(PAL.gold)
    if (car) {
      this.burst(car.x, car.y, car.dx, car.dy, place === 1 ? PAL.gold : PAL.dim, 10)
      this.label(car.x, car.y, `P${place}`, place === 1 ? CSS.gold : CSS.onDark)
    }
  }
}
