import Phaser from 'phaser'
import { PAL, RACER_COLORS } from '../config/palette.js'
import { RACE } from '../config/balance.js'

// Трасса — вид сверху, участники = цветные точки без коллизий (как в оригинале).
// Нормализованные опорные точки замкнутого круга, растягиваются под область.
const SHAPE = [
  [0.10, 0.62], [0.09, 0.34], [0.20, 0.14], [0.38, 0.12], [0.49, 0.28],
  [0.60, 0.40], [0.71, 0.16], [0.88, 0.16], [0.95, 0.42], [0.86, 0.66],
  [0.66, 0.72], [0.46, 0.62], [0.30, 0.72], [0.15, 0.82],
]

export class TrackView extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h) {
    super(scene, x, y)
    this.w = w
    this.h = h

    const pts = SHAPE.map(([px, py]) => new Phaser.Math.Vector2(px * w, py * h))
    this.curve = new Phaser.Curves.Spline([...pts, pts[0], pts[1]])

    this.road = scene.add.graphics()
    this.drawRoad()

    this.dots = []
    this.labels = []
    for (let i = 0; i < RACE.racers; i++) {
      const isPlayer = i === 0
      const dot = scene.add.circle(0, 0, isPlayer ? 7 : 5, RACER_COLORS[i % RACER_COLORS.length])
      dot.setStrokeStyle(isPlayer ? 2 : 0, 0xffffff, 0.9)
      dot.setDepth(isPlayer ? 3 : 2)
      this.dots.push(dot)
    }
    this.add([this.road, ...this.dots])
    scene.add.existing(this)
  }

  drawRoad() {
    const g = this.road
    g.clear()
    g.lineStyle(16, PAL.line, 1)
    this.curve.draw(g, 220)
    g.lineStyle(2, PAL.dim, 0.7)
    this.curve.draw(g, 220)

    // Стартовая клетка — поперёк полотна, по нормали к кривой в точке t=0.
    const p = this.curve.getPoint(0)
    const ahead = this.curve.getPoint(0.008)
    const len = Math.max(0.001, Math.hypot(ahead.x - p.x, ahead.y - p.y))
    const nx = -(ahead.y - p.y) / len
    const ny = (ahead.x - p.x) / len
    g.lineStyle(3, 0xffffff, 0.9)
    g.beginPath()
    g.moveTo(p.x - nx * 9, p.y - ny * 9)
    g.lineTo(p.x + nx * 9, p.y + ny * 9)
    g.strokePath()
  }

  // racers: массив из RaceSimulation, порядок = стартовый (0 = игрок)
  update(sim) {
    const tmp = new Phaser.Math.Vector2()
    for (let i = 0; i < this.dots.length; i++) {
      const racer = sim.racers[i]
      if (!racer) continue
      const { t } = sim.lapPositionOf(racer)
      this.curve.getPoint(t % 1, tmp)
      // Небольшое смещение по нормали, чтобы точки не слипались на одной линии.
      const offset = (i % 3 - 1) * 4
      const ahead = this.curve.getPoint((t + 0.01) % 1)
      const dx = ahead.x - tmp.x
      const dy = ahead.y - tmp.y
      const len = Math.max(0.001, Math.hypot(dx, dy))
      this.dots[i].setPosition(tmp.x - (dy / len) * offset, tmp.y + (dx / len) * offset)
    }
  }
}
