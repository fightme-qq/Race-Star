import { RACE } from '../config/balance.js'
import { racerShape, opponentShape, OPPONENT_SPREAD } from './RaceModel.js'
import { SeededRandom, randomSeed } from '../utils/rng.js'

// Гонка — чистая симуляция чисел (в оригинале нет ни одного класса вождения).
// Вся математика исхода живёт в RaceModel.js, здесь только её раскатка во
// времени: точки должны ехать 60 секунд и приезжать ровно туда, куда велит
// разыгранная форма. Победитель НЕ предопределён: позиция считается из
// накопленного прогресса.

export class RaceSimulation {
  constructor({ playerOffense, playerDefense, leaguePower, seed = randomSeed() }) {
    this.seed = seed
    this.rng = new SeededRandom(seed)
    this.duration = RACE.durationSec
    this.elapsed = 0
    this.finished = false
    this.events = []

    this.racers = [this.makeRacer(0, racerShape(playerOffense, playerDefense), true)]
    for (let i = 0; i < RACE.racers - 1; i++) {
      const power = leaguePower * OPPONENT_SPREAD[i] * this.rng.float(0.94, 1.06)
      this.racers.push(this.makeRacer(i + 1, opponentShape(power), false))
    }

    this.meanStat = this.racers.reduce((s, r) => s + r.stat, 0) / this.racers.length
    this.lastPlayerPos = 1
  }

  // Всё, что решает исход, разыгрывается ОДИН раз на старте и держится все 60
  // секунд: покадровый шум за 600 тиков усредняется почти в ноль. Здесь два
  // броска — какой стороной подготовки решится заезд (обгон или удержание) и
  // форма на этот заезд.
  makeRacer(id, shape, isPlayer) {
    const attacking = this.rng.next() < RACE.attackWeight
    return {
      id, isPlayer, shape, attacking, progress: 0, position: id + 1,
      stat: attacking ? shape.attack : shape.hold,
      form: Math.exp(this.rng.gauss(0, shape.sigma)),
      speed: 1, wobble: this.rng.float(0, Math.PI * 2),
    }
  }

  // Базовая скорость от соотношения силы; сжата корнем, чтобы отставший
  // не терял круг за 10 секунд, а разрыв читался как борьба.
  baseSpeedOf(racer) {
    return Math.pow(racer.stat / this.meanStat, 0.45) * racer.form
  }

  step(dt) {
    if (this.finished) return
    const remain = Math.max(0, this.duration - this.elapsed)
    const step = Math.min(dt, remain)
    this.elapsed += step

    for (const r of this.racers) {
      // Покадровая тряска — ТОЛЬКО картинка. За 600 тиков она усредняется в
      // ноль и на финиш не влияет; именно попытка повесить на неё защиту и
      // делала деление слотов косметическим. Защита теперь в r.shape.sigma.
      const noise = this.rng.gauss(0, RACE.stepNoise)
      // Плавная составляющая — чтобы точки не дёргались покадрово.
      r.wobble += step * 1.7
      const drift = Math.sin(r.wobble) * 0.06
      r.speed = Math.max(0.25, this.baseSpeedOf(r) * (1 + noise * 0.35 + drift))
      r.progress += r.speed * step / this.duration
    }

    this.updatePositions()
    if (this.elapsed >= this.duration) this.finished = true
  }

  updatePositions() {
    const sorted = [...this.racers].sort((a, b) => b.progress - a.progress)
    sorted.forEach((r, i) => { r.position = i + 1 })
    const player = this.racers[0]
    if (player.position !== this.lastPlayerPos) {
      // Тостим только значимые смены позиции, иначе плашки спамят каждый тик.
      if (player.position === 1 && this.lastPlayerPos > 1) {
        this.events.push({ type: 'lead', text: 'Your Team takes the lead!' })
      } else if (player.position <= 3 && this.lastPlayerPos > 3) {
        this.events.push({ type: 'gain', text: `Overtake! P${player.position}` })
      }
      this.lastPlayerPos = player.position
    }
  }

  get player() { return this.racers[0] }
  get timeLeft() { return Math.max(0, this.duration - this.elapsed) }
  get isLastLap() { return this.elapsed / this.duration > 0.85 }

  drainEvents() {
    const out = this.events
    this.events = []
    return out
  }

  // Позиция точки на трассе: доля круга + номер круга.
  lapPositionOf(racer) {
    const total = racer.progress * RACE.laps
    return { lap: Math.floor(total) + 1, t: total % 1 }
  }
}
