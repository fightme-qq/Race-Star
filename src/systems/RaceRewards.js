import { ECONOMY, SEASON, GEMS, LEAGUES } from '../config/balance.js'

// Начисление за финиш — чистая функция от состояния и места.
// Вынесено из RaceController, чтобы балансный прогон (tools/sim) считал
// награды ТЕМ ЖЕ кодом, что и живая игра, а не своей копией формул.
export function applyRaceResult(state, position) {
  const idx = position - 1

  // Приз и бонус за победу — в СЕКУНДАХ дохода: так они не отстают от
  // экономики на порядки к середине игры.
  const seconds = ECONOMY.prizeSeconds * ECONOMY.placePrize[idx]
    + (position === 1 ? state.agg.winBonusSec : 0)
  const prize = state.incomePerSec * seconds
  state.addCash(prize)

  const fans = Math.round((ECONOMY.fansPerRace + state.agg.fansPerRace) * ECONOMY.placeFans[idx])
  state.cls.fans += fans

  let gems = 0
  if (position === 1) {
    gems = state.addGems(GEMS.perWin)
    state.addTrophies(1)
    state.cls.seasonScore += SEASON.winPoints
  } else if (position <= 3) {
    state.cls.seasonScore += SEASON.podiumPoints
  }

  state.cls.seasonRaces++
  let seasonEnded = false
  let promoted = false
  if (state.cls.seasonRaces >= SEASON.races) {
    seasonEnded = true
    // "Win the season to advance" — повышение при достаточном счёте.
    if (state.cls.seasonScore >= SEASON.races * SEASON.promoteRatio
        && state.cls.league < LEAGUES.length - 1) {
      state.cls.league++
      promoted = true
    }
    state.cls.season++
    state.cls.seasonRaces = 0
    state.cls.seasonScore = 0
  }

  return { position, prize, fans, gems, seasonEnded, promoted }
}
