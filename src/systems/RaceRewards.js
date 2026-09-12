import { ECONOMY, SEASON, GEMS, LEAGUES } from '../config/balance.js'
import { CAREER } from '../config/career.js'
import { MAIL } from '../config/rewards.js'
import { recordRivals, archiveSeason } from './SeasonSystem.js'

// Начисление за финиш — чистая функция от состояния и места.
// Вынесено из RaceController, чтобы балансный прогон (tools/sim) считал
// награды ТЕМ ЖЕ кодом, что и живая игра, а не своей копией формул.
//
// `order` — места девяти соперников (order[i] для соперника с индексом i).
// Нужен только таблице лиги; стенд его не передаёт и таблицу не ведёт. Ведение
// таблицы стоит здесь, а не в контроллере, намеренно: сброс сезона живёт в этой
// функции, и таблица обязана обнуляться ровно в тот же момент, что счёт.
export function applyRaceResult(state, position, order = null) {
  const idx = position - 1
  const fx = state.careerFx

  // Приз за место — в СЕКУНДАХ дохода [X]: так он не отстаёт от экономики на
  // порядки к середине игры. Поверх — плоские выплаты экономической ветки [F]:
  // Ticket Marketing и Parking платят за каждую гонку, Victory Celebrations
  // только за победу. Они не масштабируются ничем и намеренно: в оригинале это
  // ранняя игра (Parking Lv.8 = $120 за гонку при пассиве $60), к середине их
  // обгоняет доход от фанатов.
  // Приз считается от дохода АКТИВНОГО класса, а не от суммарного: с шагом
  // «параллельный доход» открытые классы капают фоном, и общий доход у игрока
  // на шестом классе почти весь чужой. Взять его сюда значило бы раздавать за
  // заезд в свежем классе призы по накопленному пятому — и заодно вернуть
  // двойную экспоненту (приз растит фанатов, фанаты растят приз).
  const seconds = ECONOMY.prizeSeconds * ECONOMY.placePrize[idx]
  const prize = state.activeIncomePerSec * seconds
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

  // Счётчики задач вкладки 5 [F]: `finish race 54/100`, `win race 4/5`.
  // Считает их тот же код, что раздаёт награды за финиш (правило 7), — иначе
  // балансный стенд играл бы в игру без задач, а игрок с задачами.
  state.track?.('raceFinish')
  if (position === 1) state.track?.('raceWin')

  // Пробег класса за всю игру: от него открываются слоты гира [E] `Play {0}
  // races to unlock`. Считается здесь, а не в контроллере гонки, по правилу 7 —
  // иначе у стенда слоты не открывались бы вовсе, и третья ось силы
  // подбиралась бы по игре, в которую игрок не играет (правило 20).
  state.cls.races = (state.cls.races || 0) + 1

  let gems = 0
  if (position === 1) {
    gems = state.addGems(GEMS.perWin)
    state.addTrophies(1)
    state.cls.seasonScore += SEASON.winPoints
    state.cls.seasonWins = (state.cls.seasonWins || 0) + 1
  } else if (position <= 3) {
    state.cls.seasonScore += SEASON.podiumPoints
  }
  recordRivals(state.cls, order)

  state.cls.seasonRaces++
  let seasonEnded = false
  let promoted = false
  if (state.cls.seasonRaces >= SEASON.races) {
    seasonEnded = true
    // "Win the season to advance" — повышение при достаточном счёте.
    promoted = state.cls.seasonScore >= SEASON.races * SEASON.promoteRatio
      && state.cls.league < LEAGUES.length - 1
    // Строку в историю пишем ДО повышения: в ней стоит лига, в которой сезон
    // отъезжен, иначе игрок увидит, что выиграл лигу, в которую только попал.
    if (order) {
      archiveSeason(state.cls, state.teamName, state.activeClass, promoted,
        state.relativePowerOf(state.activeClass))
    }
    if (promoted) state.cls.league++
    // Почта [E] — доставка того, что случилось, пока игрок смотрел в другую
    // вкладку. Письмо пишем ПОСЛЕ повышения: в нём стоит лига, куда игрок
    // попал, а в истории сезонов — та, где отъездил.
    state.track?.('seasonFinish')
    state.mail?.(
      promoted ? 'Promoted!' : `Season ${state.cls.season} complete`,
      promoted
        ? `${state.teamName} moves up to ${LEAGUES[state.cls.league].name}.`
        : `${state.teamName} finished the season in ${LEAGUES[state.cls.league].name}.`,
      promoted ? MAIL.promoReward : MAIL.seasonReward,
    )
    state.cls.season++
    state.cls.seasonRaces = 0
    state.cls.seasonScore = 0
  }

  // Раунды турнирной сетки (шаг 8) открываются по пробегу класса, и двигать их
  // обязан тот же код, что раздаёт награды за финиш (правило 7). Иначе стенд
  // играет в игру без турниров, а игрок — с турнирами, и приток гемов у них
  // расходится (та же причина, по которой здесь же стоят счётчики задач).
  const brackets = state.tickBrackets ? state.tickBrackets() : []

  // Пак коллекции [E] «Packs can be earned by playing the game» — здесь же, по
  // правилу 7: это единственный источник паков (гемами они не продаются), и
  // считать его вне общего кода значило бы, что у стенда коллекций нет.
  const collectionPack = state.trackCollection ? state.trackCollection() : false

  return {
    position, prize: prize + flat, fans, gems, seasonEnded, promoted,
    careerXp, careerLevels, brackets, collectionPack,
  }
}
