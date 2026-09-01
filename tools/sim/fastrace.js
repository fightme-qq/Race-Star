// Быстрая модель заезда для подбора баланса.
//
// Это НЕ упрощение — это та же математика без визуального слоя. В
// RaceSimulation итоговый прогресс = baseSpeed * form * (1 + шум), где шум
// разыгрывается 600 раз и усредняется до ±0.3% при разбросе соперников ~5%.
// Значит место определяется ранжированием power^0.45 * form. Один заезд =
// 10 логнормальных чисел вместо 6000 шагов симуляции.
// Совпадение с полной симуляцией проверяется `node tools/sim/fastrace.js`.

import { RACE } from '../../src/config/balance.js'

const OPPONENT_SPREAD = [0.72, 0.80, 0.87, 0.93, 1.0, 1.06, 1.13, 1.21, 1.32]

export function fastRace(playerPower, leaguePower, rng) {
  const form = () => Math.exp(rng.gauss(0, RACE.formSigma))
  const mine = Math.pow(playerPower, 0.45) * form()
  let ahead = 0
  for (const spread of OPPONENT_SPREAD) {
    const power = leaguePower * spread * rng.float(0.94, 1.06)
    if (Math.pow(power, 0.45) * form() > mine) ahead++
  }
  return ahead + 1
}

// --- Сверка с полной симуляцией -----------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { RaceSimulation } = await import('../../src/systems/RaceSimulation.js')
  const { SeededRandom } = await import('../../src/utils/rng.js')

  const N = 3000
  console.log('доля мест, полная симуляция vs быстрая модель\n')
  for (const ratio of [0.7, 1.0, 1.3, 1.8, 2.5]) {
    const league = 400
    const power = league * ratio
    const full = new Array(11).fill(0)
    const fast = new Array(11).fill(0)
    const rng = new SeededRandom(12345)

    for (let i = 0; i < N; i++) {
      const sim = new RaceSimulation({
        playerOffense: power / 2, playerDefense: power / 2,
        leaguePower: league, seed: i * 7919 + 13,
      })
      while (!sim.finished) sim.step(1 / RACE.tickHz)
      full[sim.player.position]++
      fast[fastRace(power, league, rng)]++
    }

    const pct = (a) => a.slice(1).map((v) => String(Math.round(100 * v / N)).padStart(3)).join('')
    console.log(`  сила/лига ${ratio.toFixed(1)}`)
    console.log(`    полная  ${pct(full)}   P1 ${(100 * full[1] / N).toFixed(1)}%`)
    console.log(`    быстрая ${pct(fast)}   P1 ${(100 * fast[1] / N).toFixed(1)}%`)
  }
}
