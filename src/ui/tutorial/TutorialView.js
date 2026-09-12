import Phaser from 'phaser'
import { DEPTH } from '../../config/layout.js'
import { PAL } from '../../config/palette.js'
import { formatMoney } from '../../utils/format.js'
import { Spotlight } from './Spotlight.js'
import { TutorialCard, targetRect } from './TutorialOverlay.js'

// Связка «автомат шагов → подсветка + карточка». Отдельно от MainScene, потому
// что у неё и так шесть обязанностей, а обучение живёт своим циклом: оно
// пересчитывает подсветку каждый кадр (цель может ехать — карточка апгрейда
// стоит в скролле, строка статов пересобирается потоком).
export class TutorialView {
  constructor(scene, state) {
    this.scene = scene
    this.state = state
    this.tut = state.tutorial
    this.shown = null   // id показанного шага: перерисовываем только на смене

    this.spot = new Spotlight(scene, () => this.onTapOutside())
    this.card = new TutorialCard(scene, {
      onNext: () => this.next(),
      onSkip: () => this.skip(),
    })
    this.spot.setDepth(DEPTH.tutorial)
    this.card.setDepth(DEPTH.tutorial + 1)
    this.sync()
  }

  get active() { return !!this.tut.current }

  // Тап мимо подсветки листает шаг вперёд — но только листаемый. На шаге,
  // который ждёт действия, промах не должен засчитываться за выполнение:
  // иначе «нажми Upgrade» закрывается нажатием куда угодно, и обучение учит
  // ровно наоборот.
  onTapOutside() { if (!this.tut.current?.await) this.next() }

  next() {
    this.tut.advance()
    this.state.save()
    this.sync()
  }

  skip() {
    this.tut.finish()
    this.state.save()
    this.sync()
  }

  // Действие игрока пришло из сцены. Если шаг его ждал — идём дальше.
  onAction(action) {
    if (this.tut.onAction(action)) {
      this.state.save()
      this.sync()
    }
  }

  // Полная перерисовка при смене шага.
  sync() {
    const step = this.tut.current
    // Замок скролла снимается/ставится ЗДЕСЬ и только здесь: это единственное
    // место, которое видит смену шага, включая последнюю — выход из обучения.
    this.scene.syncLock?.()
    if (!step) {
      this.spot.setVisible(false)
      this.card.hide()
      this.shown = null
      return
    }
    // Ставка выдаётся ДО отрисовки: иначе кнопка «Upgrade» на своём же шаге
    // первые 200 мс остаётся серой (тяжёлый рефреш идёт 5 раз в секунду).
    const staked = this.tut.stake()
    if (staked > 0) {
      this.scene.refreshUI()
      this.scene.toasts?.show('Starter stake ' + formatMoney(staked), PAL.green)
    }
    this.shown = step.id
    this.spot.setVisible(true)
    this.draw(step)
  }

  draw(step) {
    const rect = targetRect(this.scene, step.target)
    this.spot.show(rect)
    this.card.show(this.tut.step, step, rect)
  }

  // Раз в кадр из MainScene.update: цель могла уехать. Перерисовываем только
  // геометрию подсветки, а не карточку — её текст не меняется внутри шага, а
  // пересборка графики каждый кадр стоит заметно дороже.
  update() {
    const step = this.tut.current
    if (!step) return
    if (step.id !== this.shown) { this.sync(); return }
    const rect = targetRect(this.scene, step.target)
    if (!rect) return
    if (this.lastRect && Phaser.Geom.Rectangle.Equals(this.lastRect, rect)) return
    this.lastRect = Phaser.Geom.Rectangle.Clone(rect)
    this.spot.show(rect)
  }
}
