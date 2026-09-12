import { PAL } from '../../config/palette.js'
import { SeededRandom } from '../../utils/rng.js'

// Статика трассы: поле, полотно, поребрик, осевая, стартовая клетка.
// Рисуется ОДИН раз в два Graphics — ассетов в проекте нет принципиально.
//
// От прежней версии отличается тем, что всё берётся из TrackPath, то есть из
// таблицы, равномерной по длине дуги. Раньше поребрик шагал по параметру
// сплайна: на коротких сегментах зубцы сбивались в кашу, на длинных
// растягивались втрое. Теперь шаг зубца — это фиксированное число пикселей.
const ROAD_W = 19
const KERB_PX = 9              // длина зубца поребрика в пикселях
const DASH_PX = 10

export class TrackScenery {
  constructor(scene, path, w, h) {
    this.path = path
    this.field = scene.add.graphics()
    this.road = scene.add.graphics()
    this.drawField(w, h)
    this.drawRoad()
  }

  get layers() { return [this.field, this.road] }

  drawField(w, h) {
    const g = this.field
    g.fillStyle(PAL.grass, 1)
    g.fillRoundedRect(0, 0, w, h, 10)

    // Озеро и ряд боксов — ориентиры, чтобы круг читался как круг: без них
    // проезд одного и того же поворота не отличить от следующего.
    g.fillStyle(PAL.water, 1)
    g.fillEllipse(w * 0.66, h * 0.84, w * 0.15, h * 0.10)
    g.fillStyle(PAL.water, 0.45)
    g.fillEllipse(w * 0.66, h * 0.82, w * 0.10, h * 0.05)

    g.fillStyle(PAL.concrete, 1)
    for (let i = 0; i < 12; i++) {
      g.fillRect(w * 0.30 + i * w * 0.033, h * 0.90, w * 0.026, h * 0.045)
    }

    // Сид фиксированный: иначе деревья скакали бы при каждом ререндере.
    const rng = new SeededRandom(20260903)
    for (let i = 0; i < 110; i++) {
      const x = rng.float(0.03, 0.97) * w
      const y = rng.float(0.03, 0.97) * h
      if (this.path.distTo(x, y) < ROAD_W + 16) continue
      const r = rng.float(3.5, 6.5)
      g.fillStyle(0x000000, 0.14)
      g.fillCircle(x + 1.5, y + 2, r)
      g.fillStyle(PAL.grassDark, 1)
      g.fillCircle(x, y, r)
      g.fillStyle(PAL.grass, 0.55)
      g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.45)
    }
  }

  drawRoad() {
    const g = this.road
    const path = this.path
    const pts = path.outline(2)

    g.lineStyle(ROAD_W + 26, PAL.sand, 1)
    g.strokePoints(pts, true)
    g.lineStyle(ROAD_W + 4, 0x000000, 0.18)
    g.strokePoints(pts, true)
    g.lineStyle(ROAD_W, PAL.road, 1)
    g.strokePoints(pts, true)

    // Поребрик: шаг в пикселях, поэтому зубцы одинаковы и в шпильке, и на прямой.
    const kerbs = Math.max(24, Math.round(path.length / KERB_PX))
    for (let i = 0; i < kerbs; i++) {
      const a = path.at(i / kerbs)
      const b = path.at((i + 1) / kerbs)
      g.lineStyle(3, i % 2 ? 0xe23b3b : 0xffffff, 1)
      for (const s of [-1, 1]) {
        const off = s * (ROAD_W / 2 + 1.5)
        g.beginPath()
        g.moveTo(a.x + a.nx * off, a.y + a.ny * off)
        g.lineTo(b.x + b.nx * off, b.y + b.ny * off)
        g.strokePath()
      }
    }

    // Осевая — пунктир, тоже с шагом в пикселях.
    const dashes = Math.max(20, Math.round(path.length / (DASH_PX * 2)))
    g.lineStyle(1.6, 0xffffff, 0.8)
    for (let i = 0; i < dashes; i++) {
      const a = path.at(i / dashes)
      const b = path.at((i + 0.5) / dashes)
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
      g.strokePath()
    }

    this.drawStartLine(g)
  }

  // Стартовая клетка — шахматка в две полосы поперёк полотна. Нужна не для
  // красоты: без неё круг не считается глазом, а именно «где линия» и был
  // вопрос, когда точки на ней телепортировались.
  drawStartLine(g) {
    const f = this.path.at(0)
    const cells = 7
    const cw = ROAD_W / cells
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cells; c++) {
        const off = -ROAD_W / 2 + c * cw
        const along = r * 4
        const x = f.x + f.nx * off + f.tx * along
        const y = f.y + f.ny * off + f.ty * along
        g.fillStyle((r + c) % 2 ? 0x151515 : 0xffffff, 1)
        // Ячейка как четырёхугольник по тангенсу/нормали: поперёк полотна под
        // любым углом, а не осевой прямоугольник.
        g.fillPoints([
          { x, y },
          { x: x + f.nx * cw, y: y + f.ny * cw },
          { x: x + f.nx * cw + f.tx * 4, y: y + f.ny * cw + f.ty * 4 },
          { x: x + f.tx * 4, y: y + f.ty * 4 },
        ], true)
      }
    }
  }
}
