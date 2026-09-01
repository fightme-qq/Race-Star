import { RaceSimulation } from './RaceSimulation.js'
import { ECONOMY, RACE, SEASON, GEMS, LEAGUES } from '../config/balance.js'
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
    const s = this.state
    const pos = this.sim.player.position
    const idx = pos - 1

    const prize = s.incomePerSec * ECONOMY.prizeSeconds * ECONOMY.placePrize[idx]
      + (pos === 1 ? s.agg.winBonus : 0)
    s.addCash(prize)

    const fans = Math.round((10 + s.agg.fansPerRace) * ECONOMY.placeFans[idx])
    s.cls.fans += fans

    let gems = 0
    if (pos === 1) {
      gems = s.addGems(GEMS.perWin)
      s.addTrophies(1)
      s.cls.seasonScore += SEASON.winPoints
    } else if (pos <= 3) {
      s.cls.seasonScore += SEASON.podiumPoints
    }

    s.cls.seasonRaces++
    let seasonEnded = false
    if (s.cls.seasonRaces >= SEASON.races) {
      seasonEnded = true
      // "Win the season to advance" — повышение при достаточном счёте.
      const need = SEASON.races * 1.4
      if (s.cls.seasonScore >= need && s.cls.league < LEAGUES.length - 1) s.cls.league++
      s.cls.season++
      s.cls.seasonRaces = 0
      s.cls.seasonScore = 0
    }

    s.save()
    this.onFinish({ position: pos, prize, fans, gems, seasonEnded })
  }
}
