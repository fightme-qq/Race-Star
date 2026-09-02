// Быстрая модель заезда для подбора баланса.
//
// Это НЕ упрощение — это та же математика без визуального слоя. Обе стороны
// берут форму из RaceModel.js: в RaceSimulation итоговый прогресс =
// power^0.45 * pace * form * (1 + шум), где шум разыгрывается 600 раз и
// усредняется до ±0.3%. Значит место определяется ранжированием
// power^0.45 * pace * form. Один заезд = 10 логнормальных чисел вместо 6000
// шагов симуляции. Совпадение проверяется `node tools/sim/fastrace.js`.

import { RACE } from '../../src/config/balance.js'
import { racerShape, opponentShape, drawScore, OPPONENT_SPREAD } from '../../src/systems/RaceModel.js'

export function fastRace(playerOff, playerDef, leaguePower, rng) {
  const mine = drawScore(racerShape(playerOff, playerDef), rng)
  let ahead = 0
  for (const spread of OPPONENT_SPREAD) {
    const power = leaguePower * spread * rng.float(0.94, 1.06)
    if (drawScore(opponentShape(power), rng) > mine) ahead++
  }
  return ahead + 1
}

// --- Сверка трёх моделей -------------------------------------------------
// Потребителей у гонки три, и разъехаться может любой: визуальная симуляция,
// быстрая модель стенда и АНАЛИТИКА (placeDist), по которой бот решает, что
// покупать. Третью строку добавили не зря: свёртка независимых beatProb давала
// 7% побед там, где симуляция показывала 26%.
// Гоняем не только по силе, но и по РАСКЛАДУ: расхождение могло бы прятаться
// именно в перекосе, ради которого правка и делалась.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { RaceSimulation } = await import('../../src/systems/RaceSimulation.js')
  const { SeededRandom } = await import('../../src/utils/rng.js')
  const { placeDistOf } = await import('../../src/systems/RaceModel.js')

  const N = 3000
  console.log('доля мест, полная симуляция vs быстрая модель\n')
  for (const ratio of [0.7, 1.0, 1.3, 1.8, 2.5]) {
    for (const offShare of [0.5, 0.25, 0.75]) {
      const league = 400
      const power = league * ratio
      const off = power * offShare
      const def = power * (1 - offShare)
      const full = new Array(11).fill(0)
      const fast = new Array(11).fill(0)
      const rng = new SeededRandom(12345)

      for (let i = 0; i < N; i++) {
        const sim = new RaceSimulation({
          playerOffense: off, playerDefense: def,
          leaguePower: league, seed: i * 7919 + 13,
        })
        while (!sim.finished) sim.step(1 / RACE.tickHz)
        full[sim.player.position]++
        fast[fastRace(off, def, league, rng)]++
      }

      const dist = placeDistOf(off, def, league)
      const pct = (a) => a.slice(1).map((v) => String(Math.round(100 * v / N)).padStart(3)).join('')
      const pctA = (a) => a.map((v) => String(Math.round(100 * v)).padStart(3)).join('')
      console.log(`  сила/лига ${ratio.toFixed(1)}  атака ${(100 * offShare).toFixed(0)}%`)
      console.log(`    полная   ${pct(full)}   P1 ${(100 * full[1] / N).toFixed(1)}%`)
      console.log(`    быстрая  ${pct(fast)}   P1 ${(100 * fast[1] / N).toFixed(1)}%`)
      console.log(`    аналитика${pctA(dist)}   P1 ${(100 * dist[0]).toFixed(1)}%`)
    }
  }
}
