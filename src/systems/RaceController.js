import { RaceSimulation } from './RaceSimulation.js'
import { applyRaceResult } from './RaceRewards.js'
import { RACE } from '../config/balance.js'
import { randomSeed } from '../utils/rng.js'

// Жизненный цикл гонок: старт -> тики -> награды -> сразу следующая гонка.
// Кулдауна между заездами нет [F].
export class RaceController {
  constructor(state, { onEvent, onFinish }) {
    this.state = state
    this.onEvent = onEvent
    this.onFinish = onFinish
    this.sim = null
    this.accumulator = 0
    this.start()
  }

  start() {
    const s = this.state
    this.sim = new RaceSimulation({
      playerOffense: s.offense,
      playerDefense: s.defense,
      leaguePower: s.league.power,
      seed: randomSeed(),
    })
    this.lastLapAnnounced = false
  }

  update(deltaMs) {
    const dt = deltaMs / 1000
    const s = this.state

    // Пассивный доход идёт всегда, независимо от гонки.
    s.addCash(s.incomePerSec * dt)

    if (!this.sim) return
    const stepSize = 1 / RACE.tickHz
    this.accumulator += dt
    while (this.accumulator >= stepSize && !this.sim.finished) {
      this.sim.step(stepSize)
      this.accumulator -= stepSize
    }

    for (const ev of this.sim.drainEvents()) this.onEvent(ev)
    if (this.sim.isLastLap && !this.lastLapAnnounced && this.sim.player.position <= 3) {
      this.lastLapAnnounced = true
      this.onEvent({ type: 'lastlap', text: 'Last-Lap Pass!' })
    }

    if (this.sim.finished) {
      this.finish()
      this.start()
    }
  }

  finish() {
    const result = applyRaceResult(this.state, this.sim.player.position)
    this.state.save()
    this.onFinish(result)
  }
}
