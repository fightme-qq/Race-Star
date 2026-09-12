import { PAL } from '../../config/palette.js'

// Отрисовка машин и боевых эффектов — один Graphics, перерисовывается каждый
// кадр. Десять машин со шлейфами и эффектами укладываются в один батч, поэтому
// это дешевле, чем держать по три-четыре игровых объекта на участника.
//
// Точка заменена на КУЗОВ, ориентированный по курсу. Причина не косметическая:
// у круга нет направления, и на карте было не видно ни перестроения, ни того,
// кто кого зажимает. Кузов 11x6 px на экране читается как точка, но при
// перестроении видно доворот.
const BODY_L = 11
const BODY_W = 6

export class CarPainter {
  constructor(scene) {
    this.g = scene.add.graphics()
  }

  get layer() { return this.g }

  draw(cars, time) {
    const g = this.g
    g.clear()
    // Порядок слоёв: шлейфы -> эффекты -> кузова. Иначе шлейф соседа лёг бы
    // поверх машины, и в плотной группе было бы не разобрать, кто едет.
    for (const c of cars) this.trail(g, c)
    for (const c of cars) this.fx(g, c, time)
    for (const c of cars) this.body(g, c)
  }

  trail(g, c) {
    const max = c.isPlayer ? c.trail.length : Math.min(6, c.trail.length)
    for (let i = 1; i < max; i++) {
      const a = c.trail[i - 1], b = c.trail[i]
      const k = 1 - i / max
      g.lineStyle(1 + k * (c.isPlayer ? 3 : 2), c.color, k * (c.isPlayer ? 0.5 : 0.28))
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
      g.strokePath()
    }
  }

  // Боевые эффекты. Каждый привязан к СОСТОЯНИЮ, посчитанному в RacerLayer:
  // ни один не проигрывается по таймеру, поэтому щит появляется ровно тогда,
  // когда машину реально догоняют.
  fx(g, c, time) {
    const bx = -c.dx, by = -c.dy          // назад по курсу
    const mx = -c.dy, my = c.dx           // поперёк курса

    // Защита — дуга щита с той стороны, откуда атакуют (сзади).
    if (c.defend > 0.04) {
      const back = Math.atan2(by, bx)
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.012)
      g.lineStyle(2.2, PAL.cyan, c.defend * 0.9 * pulse)
      g.beginPath()
      g.arc(c.x, c.y, 10, back - 0.95, back + 0.95)
      g.strokePath()
      g.lineStyle(1, PAL.cyan, c.defend * 0.45 * pulse)
      g.beginPath()
      g.arc(c.x, c.y, 13, back - 0.7, back + 0.7)
      g.strokePath()
    }

    // Атака — стрелки, убегающие назад: чем ближе к обгону, тем ярче.
    if (c.attack > 0.04) {
      const phase = (time * 0.006) % 1
      for (let i = 0; i < 3; i++) {
        const d = 7 + ((i + phase) % 3) * 5
        const a = 1 - ((i + phase) % 3) / 3
        const cx = c.x + bx * d, cy = c.y + by * d
        g.lineStyle(1.8, PAL.red, c.attack * a * 0.85)
        g.beginPath()
        g.moveTo(cx + mx * 3.4 - bx * 2.6, cy + my * 3.4 - by * 2.6)
        g.lineTo(cx, cy)
        g.lineTo(cx - mx * 3.4 - bx * 2.6, cy - my * 3.4 - by * 2.6)
        g.strokePath()
      }
    }

    // Слипстрим — короткая тяга вперёд, к кузову впереди идущего.
    if (c.draft > 0.04) {
      g.lineStyle(1.4, 0xffffff, c.draft * 0.3)
      g.beginPath()
      g.moveTo(c.x + c.dx * 7, c.y + c.dy * 7)
      g.lineTo(c.x + c.dx * 15, c.y + c.dy * 15)
      g.strokePath()
    }

    // Игрок — кольцо цветом РЕЖИМА заезда. Это единственное место, где видно,
    // чем решается конкретный заезд: атакой или удержанием.
    if (c.isPlayer) {
      const r = 10.5 + Math.sin(time * 0.007) * 1.2
      const col = c.mode === 'attack' ? PAL.red : PAL.cyan
      g.lineStyle(1.6, col, 0.55)
      g.strokeCircle(c.x, c.y, r)
      g.lineStyle(1, 0xffffff, 0.75)
      g.strokeCircle(c.x, c.y, 8.6)
    }
  }

  body(g, c) {
    const L = c.isPlayer ? BODY_L + 1 : BODY_L
    const W = c.isPlayer ? BODY_W + 0.6 : BODY_W
    const { x, y, dx, dy } = c
    const mx = -dy, my = dx
    // Кузов: сужение к носу, скос на хвосте. Считается в связанных осях
    // (курс, поперёк), поэтому работает под любым углом.
    const pt = (a, b) => ({ x: x + dx * a + mx * b, y: y + dy * a + my * b })
    const shape = [
      pt(L * 0.5, W * 0.26), pt(L * 0.34, W * 0.5), pt(-L * 0.4, W * 0.5),
      pt(-L * 0.5, W * 0.24), pt(-L * 0.5, -W * 0.24), pt(-L * 0.4, -W * 0.5),
      pt(L * 0.34, -W * 0.5), pt(L * 0.5, -W * 0.26),
    ]
    g.fillStyle(0x000000, 0.25)
    g.fillPoints(shape.map((p) => ({ x: p.x + 1, y: p.y + 1.5 })), true)
    g.fillStyle(c.color, 1)
    g.fillPoints(shape, true)
    g.lineStyle(1, c.isPlayer ? 0xffffff : 0x0b1220, c.isPlayer ? 0.95 : 0.45)
    g.strokePoints(shape, true, true)
    // Стекло — тёмный клин ближе к носу: даёт кузову «переднюю» сторону.
    g.fillStyle(0x0b1220, 0.42)
    g.fillPoints([pt(L * 0.22, W * 0.3), pt(L * 0.02, W * 0.36),
      pt(L * 0.02, -W * 0.36), pt(L * 0.22, -W * 0.3)], true)
  }
}
