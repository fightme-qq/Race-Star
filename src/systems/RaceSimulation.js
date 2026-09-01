import { RACE } from '../config/balance.js'
import { SeededRandom, randomSeed } from '../utils/rng.js'

// Гонка — чистая симуляция чисел (в оригинале нет ни одного класса вождения).
// Модель [X], форма подтверждена слоем D:
//   Offense -> прибавка к базовой скорости (способность обгонять)
//   Defense -> гасит отрицательный шум (удержание позиции)
// Победитель НЕ предопределён: позиция считается из накопленного прогресса.

const OPPONENT_SPREAD = [0.72, 0.80, 0.87, 0.93, 1.0, 1.06, 1.13, 1.21, 1.32]

export class RaceSimulation {
  constructor({ playerOffense, playerDefense, leaguePower, seed = randomSeed() }) {
    this.seed = seed
    this.rng = new SeededRandom(seed)
    this.duration = RACE.durationSec
    this.elapsed = 0
    this.finished = false
    this.events = []

    const playerPower = playerOffense + playerDefense
    this.racers = [{
      id: 0, isPlayer: true, progress: 0, position: 1,
      offense: playerOffense, defense: playerDefense, power: playerPower,
      speed: 1, wobble: this.rng.float(0, Math.PI * 2),
    }]

    for (let i = 0; i < RACE.racers - 1; i++) {
      const power = leaguePower * OPPONENT_SPREAD[i] * this.rng.float(0.94, 1.06)
      this.racers.push({
        id: i + 1, isPlayer: false, progress: 0, position: i + 2,
        offense: power * 0.5, defense: power * 0.5, power,
        speed: 1, wobble: this.rng.float(0, Math.PI * 2),
      })
    }

    this.meanPower = this.racers.reduce((s, r) => s + r.power, 0) / this.racers.length
    this.lastPlayerPos = 1
  }

  // Базовая скорость от соотношения силы; сжата корнем, чтобы отставший
  // не терял круг за 10 секунд, а разрыв читался как борьба.
  baseSpeedOf(racer) {
    return Math.pow(racer.power / this.meanPower, 0.45)
  }

  step(dt) {
    if (this.finished) return
    const remain = Math.max(0, this.duration - this.elapsed)
    const step = Math.min(dt, remain)
    this.elapsed += step

    for (const r of this.racers) {
      const defShare = r.defense / Math.max(1, r.offense + r.defense)
      const sigma = 0.30 * (1 - defShare * 0.45)
      const noise = this.rng.gauss(0, sigma)
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
