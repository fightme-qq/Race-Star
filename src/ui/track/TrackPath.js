// Геометрия трассы: ЗАМКНУТАЯ центровая линия, параметризованная по ДЛИНЕ ДУГИ,
// плюс профиль скорости по кривизне.
//
// Зачем отдельный файл вместо Phaser.Curves.Spline — три причины, и каждая была
// видимым дефектом:
//
// 1. РАЗРЫВ НА ЛИНИИ СТАРТА. Сплайн собирался как Spline([...pts, pts[0], pts[1]]),
//    то есть getPoint(1) возвращал pts[1], а не pts[0]. Точка проезжала линию,
//    ехала ещё один сегмент и телепортировалась назад на 0.28 высоты бокса
//    (~44px) — это и читалось как «респавн на черте». Здесь кольцо честное:
//    catmull-rom по индексам mod n, последняя выборка стыкуется с нулевой.
//
// 2. РВАНАЯ СКОРОСТЬ. У сплайна параметр t раздаётся сегментам равными долями,
//    а сегменты SHAPE различаются по длине втрое. Точка ускорялась и тормозила
//    на ровном газу. Таблица здесь равномерна ПО ДУГЕ: равный шаг по u — равный
//    путь в пикселях.
//
// 3. МАШИНЫ НЕ ТОРМОЗЯТ В ПОВОРОТАХ. Это и делало их «тупо точками». Скорость
//    считается из кривизны, а обратная таблица uOfTau переводит долю ВРЕМЕНИ
//    круга в положение на дуге. Круг занимает ровно столько же времени, сколько
//    и раньше (таблица нормирована), но проходится с торможением на дугах и
//    разгоном на прямых. Ни один баланс не сдвинут: симуляция по-прежнему
//    считает прогресс, а не пиксели.
const SEG = 24                 // выборок на сегмент catmull-rom
const TABLE = 720              // разрешение таблиц (0.5° трассы на запись)

// Catmull-rom по четырём опорным точкам.
const cr = (a, b, c, d, t) => {
  const t2 = t * t
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2
    + (-a + 3 * b - 3 * c + d) * t2 * t)
}

export class TrackPath {
  // cornerK — насколько кривизна режет скорость; minPace — пол, чтобы
  // шпилька не превращалась в стоянку.
  constructor(w, h, shape, { cornerK = 13, minPace = 0.52 } = {}) {
    const p = shape.map(([x, y]) => ({ x: x * w, y: y * h }))
    const n = p.length

    // Плотная выборка кольца.
    const raw = []
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], d = p[(i + 2) % n]
      for (let s = 0; s < SEG; s++) {
        const t = s / SEG
        raw.push({ x: cr(a.x, b.x, c.x, d.x, t), y: cr(a.y, b.y, c.y, d.y, t) })
      }
    }
    raw.push(raw[0])

    const cum = [0]
    for (let i = 1; i < raw.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y))
    }
    this.length = cum[cum.length - 1]

    // --- равномерно по дуге ---
    this.xs = new Float32Array(TABLE)
    this.ys = new Float32Array(TABLE)
    let k = 1
    for (let j = 0; j < TABLE; j++) {
      const s = (j / TABLE) * this.length
      while (k < cum.length - 1 && cum[k] < s) k++
      const span = Math.max(1e-6, cum[k] - cum[k - 1])
      const t = (s - cum[k - 1]) / span
      this.xs[j] = raw[k - 1].x + (raw[k].x - raw[k - 1].x) * t
      this.ys[j] = raw[k - 1].y + (raw[k].y - raw[k - 1].y) * t
    }

    // --- тангенс, кривизна, сторона апекса ---
    this.tx = new Float32Array(TABLE)
    this.ty = new Float32Array(TABLE)
    this.cv = new Float32Array(TABLE)      // |кривизна|, 1/px
    this.apex = new Float32Array(TABLE)    // -1..1: куда вести по внутренней
    const ds = this.length / TABLE
    for (let j = 0; j < TABLE; j++) {
      const a = (j - 1 + TABLE) % TABLE, b = (j + 1) % TABLE
      let dx = this.xs[b] - this.xs[a], dy = this.ys[b] - this.ys[a]
      const L = Math.hypot(dx, dy) || 1
      this.tx[j] = dx / L
      this.ty[j] = dy / L
    }
    for (let j = 0; j < TABLE; j++) {
      const b = (j + 1) % TABLE
      // dt/ds смотрит В ЦЕНТР кривизны — то есть на внутреннюю кромку.
      const ix = this.tx[b] - this.tx[j], iy = this.ty[b] - this.ty[j]
      const mag = Math.hypot(ix, iy)
      this.cv[j] = mag / ds
      // Нормаль n = (-ty, tx). Знак проекции даёт сторону апекса, величина —
      // насколько поворот крут (1 при радиусе <= ~35px).
      const side = (ix * -this.ty[j] + iy * this.tx[j]) >= 0 ? 1 : -1
      this.apex[j] = side * Math.min(1, this.cv[j] * 35)
    }

    // --- профиль скорости -> обратная таблица «доля времени круга -> дуга» ---
    const cumT = new Float32Array(TABLE + 1)
    for (let j = 0; j < TABLE; j++) {
      const pace = Math.max(minPace, 1 / (1 + cornerK * this.cv[j]))
      cumT[j + 1] = cumT[j] + ds / pace
    }
    const total = cumT[TABLE]
    this.uOfTau = new Float32Array(TABLE)
    let m = 1
    for (let j = 0; j < TABLE; j++) {
      const want = (j / TABLE) * total
      while (m < TABLE && cumT[m] < want) m++
      const span = Math.max(1e-6, cumT[m] - cumT[m - 1])
      this.uOfTau[j] = ((m - 1) + (want - cumT[m - 1]) / span) / TABLE
    }
  }

  // Кадр в точке с нормированной дугой u ∈ [0,1): позиция, тангенс, нормаль,
  // сторона апекса. Таблица равномерна по дуге, поэтому линейная интерполяция
  // между записями не даёт ни рывка, ни изменения темпа.
  at(u) {
    const f = (u - Math.floor(u)) * TABLE
    const i = Math.floor(f) % TABLE
    const j = (i + 1) % TABLE
    const t = f - Math.floor(f)
    const tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t
    const ty = this.ty[i] + (this.ty[j] - this.ty[i]) * t
    const L = Math.hypot(tx, ty) || 1
    return {
      x: this.xs[i] + (this.xs[j] - this.xs[i]) * t,
      y: this.ys[i] + (this.ys[j] - this.ys[i]) * t,
      tx: tx / L, ty: ty / L,
      nx: -ty / L, ny: tx / L,
      apex: this.apex[i],
      curv: this.cv[i],
    }
  }

  // tau — доля ВРЕМЕНИ круга. Через uOfTau она превращается в дугу, и точка
  // сама тормозит в поворотах. Стык таблицы (j=TABLE-1 -> 0) интерполируется
  // с добавленной единицей, иначе ровно на линии старта был бы скачок назад —
  // тот самый дефект, только меньшего масштаба.
  atLapTime(tau) {
    const f = (tau - Math.floor(tau)) * TABLE
    const i = Math.floor(f) % TABLE
    const j = (i + 1) % TABLE
    const t = f - Math.floor(f)
    let a = this.uOfTau[i], b = this.uOfTau[j]
    if (b < a) b += 1
    return this.at(a + (b - a) * t)
  }

  // Расстояние от точки до полотна — нужно, чтобы не сажать деревья на асфальт.
  distTo(x, y) {
    let best = 1e9
    for (let j = 0; j < TABLE; j += 3) {
      const d = Math.hypot(x - this.xs[j], y - this.ys[j])
      if (d < best) best = d
    }
    return best
  }

  // Точки полотна для обводки графикой.
  outline(step = 2) {
    const out = []
    for (let j = 0; j < TABLE; j += step) out.push({ x: this.xs[j], y: this.ys[j] })
    return out
  }
}
