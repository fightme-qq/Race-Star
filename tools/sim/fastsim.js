import './headless.js'
import { clock } from './headless.js'
import { GameState } from '../../src/systems/GameState.js'
import { applyRaceResult } from '../../src/systems/RaceRewards.js'
import { RACE, CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'
import { fastRace } from './fastrace.js'
import { driverBot, careerBot } from './policies.js'
import { SeededRandom } from '../../src/utils/rng.js'

const BUYS_PER_RACE = 6   // игрок докупает по ходу заезда, а не только на финише
// Драйверами игрок занимается не после каждой гонки: гем даётся за победу, а
// пак стоит 10 гемов — это в среднем один ролл на ~70 заездов. Реже дёргать
// дешевле по времени прогона, чаще — ничего не меняет.
const DRIVER_EVERY = 10

// Прогон на сотни игровых часов: заезд считается ранжированием формы
// (см. fastrace.js), награды — общим с игрой RaceRewards.
export function fastSim({ hours = 24, policy, seed = 1, sampleEverySec = 600, career = careerBot }) {
  clock.reset()
  localStorage.clear()
  const rng = new SeededRandom(seed)
  const state = new GameState()
  // Гача берёт сид из Roster, а тот при первом запуске тянет randomSeed().
  // Для стенда это недопустимо: подбор коэффициентов сравнивал бы прогоны с
  // разными выпадениями драйверов. Прибиваем сид к сиду прогона.
  state.roster.seed = seed * 7919 + 13

  const places = new Array(11).fill(0)
  const samples = []
  const milestones = {}
  const chunk = RACE.durationSec / BUYS_PER_RACE
  const totalRaces = Math.round((hours * 3600) / RACE.durationSec)
  let earned = 0
  let purchases = 0
  let draws = 0
  let skills = 0
  let nextSample = 0

  for (let race = 0; race < totalRaces; race++) {
    const sec = race * RACE.durationSec

    for (let i = 0; i < BUYS_PER_RACE; i++) {
      const gain = state.incomePerSec * chunk
      state.addCash(gain)
      earned += gain
      clock.advance(chunk * 1000)
      purchases += policy(state)
    }

    const pw = state.power
    const position = fastRace(pw.off, pw.def, state.league.power, rng)
    const cashBefore = state.cash
    applyRaceResult(state, position)
    earned += state.cash - cashBefore
    places[position]++
    purchases += policy(state)
    if (race % DRIVER_EVERY === 0) { draws += driverBot(state); skills += career(state) }

    for (const price of CLASS_UNLOCK_PRICES) {
      if (price && !milestones[price] && earned >= price) milestones[price] = sec
    }
    if (sec >= nextSample) {
      nextSample += sampleEverySec
      const sq = state.squadStats
      samples.push({
        sec, earned, incomePerSec: state.incomePerSec, fans: state.cls.fans,
        power: state.teamPower, league: state.cls.league,
        squad: sq.off + sq.def, draws, skills, career: state.career.level,
        levels: Object.values(state.cls.levels).reduce((a, b) => a + b, 0),
      })
    }
  }

  return { hours, races: totalRaces, purchases, draws, skills, earned, places, samples, milestones, state }
}
