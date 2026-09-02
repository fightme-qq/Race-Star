import Phaser from 'phaser'
import { PAL, RACER_COLORS } from '../config/palette.js'
import { RACE } from '../config/balance.js'
import { SeededRandom } from '../utils/rng.js'

// Трасса — вид сверху, участники = цветные точки без коллизий (как в оригинале).
// Полотно рисуется слоями поверх зелёного поля: песчаная обочина, серый асфальт,
// красно-белый поребрик по кромкам, белый пунктир по осевой. Всё графикой:
// ассетов в проекте нет принципиально.
const SHAPE = [
  [0.10, 0.62], [0.09, 0.34], [0.20, 0.14], [0.38, 0.12], [0.49, 0.28],
  [0.60, 0.40], [0.71, 0.16], [0.88, 0.16], [0.95, 0.42], [0.86, 0.66],
  [0.66, 0.72], [0.46, 0.62], [0.30, 0.72], [0.15, 0.82],
]

const ROAD_W = 17
const KERB_STEP = 0.006

export class TrackView extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h) {
    super(scene, x, y)
    this.boxW = w
    this.boxH = h

    const pts = SHAPE.map(([px, py]) => new Phaser.Math.Vector2(px * w, py * h))
    this.curve = new Phaser.Curves.Spline([...pts, pts[0], pts[1]])

    this.field = scene.add.graphics()
    this.road = scene.add.graphics()
    this.drawField()
    this.drawRoad()

    this.dots = []
    for (let i = 0; i < RACE.racers; i++) {
      const isPlayer = i === 0
      const dot = scene.add.circle(0, 0, isPlayer ? 7 : 5.5, RACER_COLORS[i % RACER_COLORS.length])
      dot.setStrokeStyle(2, isPlayer ? 0xffffff : 0x000000, isPlayer ? 0.95 : 0.25)
      dot.setDepth(isPlayer ? 3 : 2)
      this.dots.push(dot)
    }
    this.add([this.field, this.road, ...this.dots])
    scene.add.existing(this)
  }

  // Поле: трава, озеро, ряд боксов вдоль стартовой прямой и деревья. Сид
  // фиксированный — иначе деревья скакали бы при каждом ререндере.
  drawField() {
    const g = this.field
    const { boxW: w, boxH: h } = this
    g.fillStyle(PAL.grass, 1)
    g.fillRoundedRect(0, 0, w, h, 8)

    g.fillStyle(PAL.water, 1)
    g.fillEllipse(w * 0.66, h * 0.84, w * 0.14, h * 0.09)

    g.fillStyle(PAL.concrete, 1)
    for (let i = 0; i < 12; i++) g.fillRect(w * 0.30 + i * w * 0.033, h * 0.90, w * 0.026, h * 0.045)

    const rng = new SeededRandom(20260903)
    for (let i = 0; i < 90; i++) {
      const x = rng.float(0.03, 0.97) * w
      const y = rng.float(0.03, 0.97) * h
      // Дерево не должно лечь на полотно — отбрасываем точки рядом с кривой.
      if (this.distToCurve(x, y) < ROAD_W + 18) continue
      const r = rng.float(3.5, 6.5)
      g.fillStyle(PAL.grassDark, 1)
      g.fillCircle(x, y, r)
      g.fillStyle(PAL.grass, 0.5)
      g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.45)
    }
  }

  distToCurve(x, y) {
    let best = 1e9
    for (let t = 0; t < 1; t += 0.01) {
      const p = this.curve.getPoint(t)
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y)
      if (d < best) best = d
    }
    return best
  }

  drawRoad() {
    const g = this.road
    g.clear()
    g.lineStyle(ROAD_W + 24, PAL.sand, 1)
    this.curve.draw(g, 240)
    g.lineStyle(ROAD_W, PAL.road, 1)
    this.curve.draw(g, 240)

    // Поребрик: короткие отрезки по обеим кромкам, цвет чередуется.
    let i = 0
    for (let t = 0; t < 1; t += KERB_STEP, i++) {
      const { nx, ny, p } = this.frameAt(t)
      const a = this.curve.getPoint(Math.min(1, t + KERB_STEP))
      g.lineStyle(3, i % 2 ? 0xe23b3b : 0xffffff, 1)
      for (const s of [-1, 1]) {
        const off = s * (ROAD_W / 2 + 1)
        g.beginPath()
        g.moveTo(p.x + nx * off, p.y + ny * off)
        g.lineTo(a.x + nx * off, a.y + ny * off)
        g.strokePath()
      }
    }

    // Осевая — белый пунктир.
    g.lineStyle(1.5, 0xffffff, 0.85)
    for (let t = 0; t < 1; t += 0.012) {
      const p = this.curve.getPoint(t)
      const a = this.curve.getPoint(Math.min(1, t + 0.006))
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.lineTo(a.x, a.y)
      g.strokePath()
    }

    // Стартовая клетка — поперёк полотна, по нормали к кривой в точке t=0.
    const { nx, ny, p } = this.frameAt(0)
    g.lineStyle(4, 0xffffff, 0.95)
    g.beginPath()
    g.moveTo(p.x - nx * ROAD_W / 2, p.y - ny * ROAD_W / 2)
    g.lineTo(p.x + nx * ROAD_W / 2, p.y + ny * ROAD_W / 2)
    g.strokePath()
  }

  // Точка кривой и единичная нормаль к ней.
  frameAt(t) {
    const p = this.curve.getPoint(t)
    const a = this.curve.getPoint(Math.min(1, t + 0.004))
    const len = Math.max(0.001, Math.hypot(a.x - p.x, a.y - p.y))
    return { p, nx: -(a.y - p.y) / len, ny: (a.x - p.x) / len }
  }

  update(sim) {
    const tmp = new Phaser.Math.Vector2()
    for (let i = 0; i < this.dots.length; i++) {
      const racer = sim.racers[i]
      if (!racer) continue
      const { t } = sim.lapPositionOf(racer)
      this.curve.getPoint(t % 1, tmp)
      // Смещение по нормали, чтобы точки не слипались на одной линии.
      const offset = (i % 3 - 1) * 4
      const ahead = this.curve.getPoint((t + 0.01) % 1)
      const dx = ahead.x - tmp.x
      const dy = ahead.y - tmp.y
      const len = Math.max(0.001, Math.hypot(dx, dy))
      this.dots[i].setPosition(tmp.x - (dy / len) * offset, tmp.y + (dx / len) * offset)
    }
  }
}
