import Phaser from 'phaser'
import { PAL } from '../config/palette.js'
import { RACE } from '../config/balance.js'
import { TrackPath } from './track/TrackPath.js'
import { TrackScenery } from './track/TrackScenery.js'
import { RacerLayer } from './track/RacerLayer.js'
import { CarPainter } from './track/CarPainter.js'
import { RaceFx } from './track/RaceFx.js'
import { SHAPE } from './track/shape.js'

// Карта трассы — вид сверху. Сборка четырёх слоёв, вся работа в src/ui/track/:
//   TrackPath    — замкнутая геометрия, параметризация по дуге, профиль скорости
//   TrackScenery — статика: поле, полотно, поребрик, стартовая клетка
//   RacerLayer   — поведение машин (непрерывная дистанция, траектория, борьба)
//   CarPainter   — кузова, шлейфы, эффекты атаки и защиты
//   RaceFx       — искры, вспышка линии, подписи
//
// Прежняя версия держала всё в одном файле и рисовала участников кругами,
// позиция которых бралась напрямую из сплайна. Оттуда шли три дефекта: разрыв
// кривой на линии старт/финиш, неравномерный темп из-за параметра сплайна и
// сброс позиций при смене заезда. Все три лечились только заменой геометрии,
// поэтому она вынесена отдельно и покрыта прогоном tools/sim/track.js.

export class TrackView extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, state = null) {
    super(scene, x, y)
    this.boxW = w
    this.boxH = h
    // Состояние нужно ровно для одного: цвета машины игрока из гаража (шаг 7).
    this.state = state

    this.path = new TrackPath(w, h, SHAPE)
    this.scenery = new TrackScenery(scene, this.path, w, h)
    this.fx = new RaceFx(scene, this.path)
    this.racers = new RacerLayer(this.path, (ev) => this.onCarEvent(ev))
    this.painter = new CarPainter(scene)

    this.add([...this.scenery.layers, this.painter.layer, ...this.fx.layers])
    scene.add.existing(this)
  }

  get player() { return this.racers.cars[0] }

  onCarEvent(ev) {
    const c = ev.car
    if (ev.type === 'pass') {
      this.fx.burst(c.x, c.y, c.dx, c.dy, c.color, c.isPlayer ? 10 : 5)
      if (c.isPlayer) this.fx.label(c.x, c.y, `P${c.pos}`, '#ffffff')
    } else if (ev.type === 'lap') {
      // Последний круг отмечается золотом — тот же сигнал, что и в тостах.
      const last = c.lap >= RACE.laps
      this.fx.flashLine(last ? PAL.gold : 0xffffff)
    }
  }

  // dt приходит из сцены, а не берётся из game.loop: refreshUI дёргает панель
  // вне кадра обновления (например, сразу после покупки), и на game.loop.delta
  // машины успевали бы шагнуть дважды за один кадр.
  update(sim, alpha, dt) {
    // Цвет машины игрока берётся из гаража каждый кадр, а не при создании:
    // краску меняют при открытом окне, и трасса под ним продолжает ехать.
    this.racers.setPlayerColor(this.state?.paintColor ?? null)
    this.racers.update(sim, alpha, dt)
    this.painter.draw(this.racers.cars, this.scene.time.now)
    this.fx.update(Math.min(0.05, dt))
  }

  // Заезд кончился: клетчатая вспышка и место игрока прямо на карте.
  finish(place) {
    this.fx.finish(this.player, place)
  }
}
