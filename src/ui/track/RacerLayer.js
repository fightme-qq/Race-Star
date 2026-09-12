import { RACE } from '../../config/balance.js'
import { RACER_COLORS } from '../../config/palette.js'
import { Formation, COL } from './Formation.js'
import { Duel } from './Duel.js'

// Движение машин по трассе. Симуляция даёт ТОЛЬКО прогресс (кто где по
// дистанции) — всё остальное живёт здесь и в Formation.js и на исход не влияет
// ни на процент: боевой расчёт остаётся в RaceModel.js.
//
// Что решает этот слой:
//
// 1. НЕТ ТЕЛЕПОРТА МЕЖДУ ЗАЕЗДАМИ. Прогресс в модели каждые 60 секунд
//    сбрасывается в ноль, и точки прыгали на старт — «респавн». Здесь у каждой
//    машины своя НАКОПЛЕННАЯ дистанция, которая только растёт: складывается
//    приращение модели, а не абсолютное значение, поэтому сброс не виден вовсе.
//    Разрывы плавно подтягиваются к тем, что велит новая гонка, — пелотон
//    сжимается в группу и растягивается заново, как на реальном старте.
//
// 2. МАШИНЫ НЕ ЗАНИМАЮТ ОДНО МЕСТО. Раньше смещение по нормали было
//    (i % 3 - 1) * 4 — константа на всю гонку, из-за чего три точки ехали
//    слипшись. Просветы теперь держит строй (Formation.js).
//
// Кадр считается в четыре шага: advance (дистанция) -> Duel.plan (роли и цель
// по ширине) -> place (движение и позиция) -> detectPasses (события). Порядок
// важен: строй и борьба решают, КУДА машина хочет, а place двигает её туда с
// ограничением по скорости — мгновенных поправок позиции нет ни одной.
const LANE_RATE = 50     // px/s — предел скорости перестроения
const CONVERGE = 2.0     // 1/s — подтяжка визуальных разрывов к модели
const TRAIL = 12

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export class RacerLayer {
  constructor(path, onEvent) {
    this.path = path
    this.lapPx = path.length
    this.onEvent = onEvent
    this.pack = 0
    this.sim = null
    this.form = new Formation(this.lapPx, RACE.racers)
    this.duel = new Duel(this.lapPx)
    this.order = []
    this.cars = []
    const grid = []
    for (let i = 0; i < RACE.racers; i++) grid.push(this.form.gridDist(i))
    const mid = grid.reduce((s, v) => s + v, 0) / grid.length
    for (let i = 0; i < RACE.racers; i++) {
      const col = Formation.column(i)
      this.cars.push({
        i, isPlayer: i === 0, color: RACER_COLORS[i % RACER_COLORS.length],
        dist: grid[i] - mid, simDist: 0, prevSim: 0, prevTarget: null,
        delta: 0, passCd: 0, pace: RACE.laps / RACE.durationSec,
        col, home: col, cross: 0, lane: col * COL, laneT: col * COL,
        attack: 0, defend: 0, draft: 0, lap: 1, pos: i + 1, mode: 'attack',
        x: 0, y: 0, dx: 1, dy: 0, trail: [], frame: path.at(0),
      })
      this.order.push(i)
    }
  }

  update(sim, alpha, dt) {
    const fresh = sim !== this.sim
    this.sim = sim
    const step = clamp(dt, 0.001, 0.05)
    this.advance(sim, alpha, step, fresh)
    this.duel.plan(this.cars, this.order, step)
    this.place(step)
    this.detectPasses(step)
  }

  advance(sim, alpha, dt, fresh) {
    let sumD = 0, sumDelta = 0
    for (const c of this.cars) {
      const r = sim.racers[c.i]
      const d = sim.lapDistanceOf(r, alpha)
      c.delta = fresh ? 0 : Math.max(0, d - c.prevSim)
      c.prevSim = d
      c.simDist = d
      c.pos = r.position
      c.mode = r.attacking ? 'attack' : 'defend'
      // Темп сглаживаем: сравнение «кто быстрее» по одному кадру дрожало бы,
      // и машины дёргались бы между атакой и слипстримом каждые 16 мс.
      c.pace += (c.delta / dt - c.pace) * Math.min(1, dt * 3)
      sumD += d
      sumDelta += c.delta
    }
    const packRate = sumDelta / this.cars.length
    this.pack += packRate
    this.form.reslot(this.cars, dt)
    const targets = this.form.targets(this.cars, sumD / this.cars.length, this.pack)
    const k = Math.min(1, CONVERGE * dt)

    for (const c of this.cars) {
      const t = targets[c.i]
      if (fresh) c.prevTarget = null
      // Ход складывается из скорости САМОЙ ЦЕЛИ (feed-forward) и поправки на
      // ошибку. Это не украшение схемы, а исправление последнего наложения,
      // которое держалось до конца: раньше базой был СОБСТВЕННЫЙ темп машины из
      // модели, а поправка могла его только подрезать. У следящего контура с
      // такой базой установившаяся ошибка равна (свой темп - темп пелотона) / k
      // — до 50 px при разнице темпа в треть. Быстрая машина уезжала на
      // полкорпуса вперёд своей цели и втыкалась в того, кто идёт перед ней в
      // той же колонне: стенд показывал именно это — сближение с 12.5 px до
      // нуля за 20 кадров при неизменных местах в очереди.
      // С упором на скорость цели установившаяся ошибка НУЛЕВАЯ, а разница
      // темпов уезжает туда, где ей и место, — в сами цели (Formation.targets).
      const feed = c.prevTarget === null ? 0 : t - c.prevTarget
      c.prevTarget = t
      // Пол в нуле: машина не едет назад НИКОГДА. Потолок в две скорости
      // пелотона: никаких перескоков, даже когда на стыке заездов строй
      // пересобирается целиком. Обе границы проверяет стенд tools/sim/track.js
      // по максимальному перескоку позиции за кадр.
      c.dist += clamp(feed + (t - c.dist) * k, 0, packRate * 2)
    }
    this.order.sort((a, b) => this.cars[b].dist - this.cars[a].dist)
  }

  place(dt) {
    for (const c of this.cars) {
      c.lane += clamp(c.laneT - c.lane, -LANE_RATE * dt, LANE_RATE * dt)
      // Положение берётся по ДОЛЕ ВРЕМЕНИ круга, а не по доле длины: TrackPath
      // раздаёт время неравномерно, поэтому машина сама тормозит в поворотах и
      // разгоняется на прямых, проходя круг за то же время.
      const f = this.path.atLapTime(c.dist - Math.floor(c.dist))
      c.frame = f
      const x = f.x + f.nx * c.lane
      const y = f.y + f.ny * c.lane
      // Курс — не чистый тангенс: добавляем поперечную составляющую, поэтому
      // при перестроении машина видимо доворачивает, а не едет боком.
      const speed = Math.max(30, c.pace * this.lapPx)
      const vx = f.tx * speed + f.nx * (c.laneT - c.lane) * 6
      const vy = f.ty * speed + f.ny * (c.laneT - c.lane) * 6
      const L = Math.hypot(vx, vy) || 1
      c.dx = vx / L
      c.dy = vy / L

      if (!c.trail.length || Math.hypot(x - c.trail[0].x, y - c.trail[0].y) > 2.2) {
        c.trail.unshift({ x, y })
        if (c.trail.length > TRAIL) c.trail.pop()
      }
      c.x = x
      c.y = y

      const lap = Math.max(1, Math.floor(c.dist) + 1)
      if (lap > c.lap) {
        c.lap = lap
        if (c.isPlayer) this.onEvent?.({ type: 'lap', car: c })
      }
    }
  }

  // Обгон = смена порядка по ВИЗУАЛЬНОЙ дистанции. Считаем по ней, а не по
  // модели, чтобы искра вылетала ровно в тот кадр, когда машины разъехались на
  // экране. Кулдаун обязателен: пара, идущая вплотную, может перещёлкнуть
  // порядок несколько раз за секунду, и искры сыпались бы непрерывно.
  detectPasses(dt) {
    const prev = this.prevOrder
    if (prev) {
      for (let k = 0; k < this.order.length; k++) {
        const c = this.cars[this.order[k]]
        c.passCd = Math.max(0, c.passCd - dt)
        if (c.passCd > 0) continue
        if (prev.indexOf(this.order[k]) > k) {
          c.passCd = 1.2
          this.onEvent?.({ type: 'pass', car: c })
        }
      }
    }
    this.prevOrder = [...this.order]
  }
}
