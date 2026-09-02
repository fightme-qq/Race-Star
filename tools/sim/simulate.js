import './headless.js'
import { clock } from './headless.js'
import { GameState } from '../../src/systems/GameState.js'
import { RaceController } from '../../src/systems/RaceController.js'
import { CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'
import { ratePerSec, expectedPlace, driverBot } from './policies.js'

const SAMPLE_EVERY_SEC = 300
// Тот же период, что DRIVER_EVERY=10 гонок в fastsim (10 x 60 с). Без этого
// полная симуляция шла БЕЗ драйверов, а быстрая — с ними, и строка «сверка
// моделей» показывала расхождение 19% против 30% побед на пустом месте.
const DRIVER_EVERY_SEC = 600

// Один прогон: hours игрового времени, шаг dt секунд, бот покупает каждый тик.
export function simulate({ hours = 24, dt = 1, policy, seed = 1 }) {
  clock.reset()
  localStorage.clear()
  Math.random = mulberry(seed)   // гонки должны быть воспроизводимы между прогонами

  const state = new GameState()
  state.roster.seed = seed * 7919 + 13
  const places = new Array(11).fill(0)
  const samples = []
  const milestones = {}
  let earned = 0
  let races = 0
  let purchases = 0

  const controller = new RaceController(state, {
    onEvent() {},
    onFinish(r) { races++; places[r.position]++; earned += r.prize },
  })

  const totalTicks = Math.round((hours * 3600) / dt)
  let prevCash = state.cash

  for (let tick = 0; tick < totalTicks; tick++) {
    controller.update(dt * 1000)
    clock.advance(dt * 1000)

    earned += Math.max(0, state.cash - prevCash)          // пассив за тик
    for (let i = 1; i < CLASS_UNLOCK_PRICES.length; i++) {
      const price = CLASS_UNLOCK_PRICES[i]
      if (!milestones[price] && earned >= price) milestones[price] = tick * dt
    }
    purchases += policy(state)
    if ((tick * dt) % DRIVER_EVERY_SEC === 0) driverBot(state)
    prevCash = state.cash

    if ((tick * dt) % SAMPLE_EVERY_SEC === 0) {
      samples.push({
        sec: tick * dt,
        cash: state.cash,
        earned,
        incomePerSec: state.incomePerSec,
        rate: ratePerSec(state),
        fans: state.cls.fans,
        power: state.teamPower,
        league: state.cls.league,
        expPlace: expectedPlace(state),
        levels: totalLevels(state),
      })
    }
  }

  return {
    hours, races, purchases, earned, places, samples, milestones,
    final: samples[samples.length - 1],
    state,
  }
}

const totalLevels = (state) =>
  Object.values(state.cls.levels).reduce((a, b) => a + b, 0)

// Свой ГПСЧ вместо Math.random — иначе прогоны политик несравнимы.
function mulberry(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
