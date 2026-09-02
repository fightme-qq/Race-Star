import { ECONOMY, SEASON, GEMS, LEAGUES } from '../config/balance.js'
import { CAREER } from '../config/career.js'

// Начисление за финиш — чистая функция от состояния и места.
// Вынесено из RaceController, чтобы балансный прогон (tools/sim) считал
// награды ТЕМ ЖЕ кодом, что и живая игра, а не своей копией формул.
export function applyRaceResult(state, position) {
  const idx = position - 1
  const fx = state.careerFx

  // Приз за место — в СЕКУНДАХ дохода [X]: так он не отстаёт от экономики на
  // порядки к середине игры. Поверх — плоские выплаты экономической ветки [F]:
  // Ticket Marketing и Parking платят за каждую гонку, Victory Celebrations
  // только за победу. Они не масштабируются ничем и намеренно: в оригинале это
  // ранняя игра (Parking Lv.8 = $120 за гонку при пассиве $60), к середине их
  // обгоняет доход от фанатов.
  const seconds = ECONOMY.prizeSeconds * ECONOMY.placePrize[idx]
  const prize = state.incomePerSec * seconds
    * Math.pow(ECONOMY.leaguePrizeMult, state.cls.league)
    * Math.max(0, 1 + fx.prizePct / 100)
  const flat = state.agg.cashPerRace + (position === 1 ? state.agg.cashPerWin : 0)
  state.addCash(prize + flat)

  // Фанаты — единственный источник роста дохода. Множитель класса сидит здесь
  // (на доходе его нет: свежий класс на кадре показывает $1/с при любом
  // прогрессе игрока), а вот лига — намеренно НЕ здесь, см. ECONOMY: она
  // умножает призовые, иначе экономика уходит в двойную экспоненту.
  const fans = Math.round(state.agg.fansPerRace
    * ECONOMY.placeFans[idx]
    * Math.pow(ECONOMY.classFanMult, state.clsDef.index)
    * Math.max(0, 1 + fx.fansPct / 100))
  state.cls.fans += fans

  // «Each race gives Career XP for that class» [F] — XP идёт активному классу
  // и зависит от места, чтобы карьера росла не просто по часам на стене.
  const careerXp = CAREER.xpPerRace * CAREER.xpPlace[idx]
  const careerLevels = state.gainCareerXp(careerXp)

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

  return { position, prize: prize + flat, fans, gems, seasonEnded, promoted, careerXp, careerLevels }
}
