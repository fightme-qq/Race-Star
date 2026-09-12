import Phaser from 'phaser'
import { PAL, RACER_COLORS } from '../config/palette.js'
import { RACE } from '../config/balance.js'

// [F] Лента прогресса над картой — отдельный элемент, а не подпись «LAP 1/8».
// На кадре это светлая полоса во всю ширину панели с точками участников и
// флажком в конце; рядов два (в Track Star — три, плотнее). Точка едет по
// ленте от старта к финишу по ДОЛЕ пройденной дистанции всей гонки, а не по
// положению на круге: на карте видно место в повороте, на ленте — насколько
// заезд пройден.
const ROWS = 2
const ROW_H = 17

export class LapRibbon extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w) {
    super(scene, x, y)
    this.boxW = w
    this.boxH = ROWS * ROW_H

    this.bg = scene.add.graphics()
    this.bg.fillStyle(PAL.ribbon, 1)
    this.bg.fillRect(0, 0, w, this.boxH)
    // Финишный флажок — шахматка в правом краю ленты.
    const fx = w - 14
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 2; c++) {
        this.bg.fillStyle((r + c) % 2 ? 0x151515 : 0xffffff, 1)
        this.bg.fillRect(fx + c * 6, r * (this.boxH / 8), 6, this.boxH / 8)
      }
    }

    this.dots = []
    for (let i = 0; i < RACE.racers; i++) {
      const d = scene.add.circle(0, 0, i === 0 ? 5 : 4, RACER_COLORS[i % RACER_COLORS.length])
      if (i === 0) d.setStrokeStyle(2, 0xffffff, 0.9)
      this.dots.push(d)
    }
    this.add([this.bg, ...this.dots])
    scene.add.existing(this)
  }

  // alpha — доля прожитого тика симуляции. Без неё точки на ленте ползли
  // ступеньками по 100 мс: тик 10 Гц, кадр 60 Гц.
  update(sim, alpha = 1) {
    const span = this.boxW - 30
    for (let i = 0; i < this.dots.length; i++) {
      const racer = sim.racers[i]
      if (!racer) continue
      const done = Phaser.Math.Clamp(sim.progressOf(racer, alpha), 0, 1)
      // Ряды чередуются по стартовому номеру — так на кадре и сделано,
      // иначе десять точек слипаются в одну кляксу на старте.
      this.dots[i].setPosition(8 + span * done, ROW_H * (i % ROWS) + ROW_H / 2)
    }
  }
}
