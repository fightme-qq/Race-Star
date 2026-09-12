import './headless.js'
import { clock } from './headless.js'
import { GameState } from '../../src/systems/GameState.js'
import { applyRaceResult } from '../../src/systems/RaceRewards.js'
import { RACE, CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'
import { fastRace } from './fastrace.js'
import {
  driverBot, careerBot, rewardsBot, shopBot, gearBot, garageBot, competeBot, luckyBot,
  resetGachaValue, resetGemPlan, gemSplitReport, gachaPerGem, packPerGem,
} from './policies.js'
import { stayFirst } from './classplan.js'
import { SeededRandom } from '../../src/utils/rng.js'

const BUYS_PER_RACE = 6   // игрок докупает по ходу заезда, а не только на финише
// Драйверами игрок занимается не после каждой гонки: гем даётся за победу, а
// пак стоит 10 гемов — это в среднем один ролл на ~70 заездов. Реже дёргать
// дешевле по времени прогона, чаще — ничего не меняет.
const DRIVER_EVERY = 10

// Драйвер закреплён за классом («Assign your driver to a class» [F]), поэтому
// при переходе игрок забирает пятёрку с собой — иначе лучшие остаются работать
// на класс, в который он больше не зайдёт. Тем же кодом, что кнопка Auto в
// интерфейсе: до этого шага перестановка между классами была НЕВОЗМОЖНА и в
// игре тоже (`assign` отказывал занятому драйверу), то есть стенд играл бы в
// то, чего игроку не дают.
const takeSquad = (state, classId) =>
  state.roster.autoManage(classId, { reassign: true, seats: state.seats })

// Прогон на сотни игровых часов: заезд считается ранжированием формы
// (см. fastrace.js), награды — общим с игрой RaceRewards.
export function fastSim({
  hours = 24, policy, seed = 1, sampleEverySec = 600,
  career = careerBot, classPlan = stayFirst,
}) {
  clock.reset()
  localStorage.clear()
  // Измеренная ценность гачи — состояние ПРОГОНА, а не точки перебора: без
  // сброса среднее от cheapestFirst утекало бы в economyOnly, и две политики
  // отличались бы порогом магазина, а не тем, что они покупают.
  resetGachaValue()
  // Делитель гемов между тремя силовыми стоками — тоже состояние ПРОГОНА
  // (см. GEM_SHARES в policies.js), иначе доли одной политики утекают в другую.
  resetGemPlan()
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
  let claims = 0
  let deals = 0
  let shopCash = 0
  // Куда уходят гемы: в магазин или в гачу. Без этого разделения шаг 5
  // непроверяем — обе траты живут в одном кошельке, и «магазин съел вторую ось
  // силы» выглядит в отчёте ровно так же, как «магазин никому не нужен».
  let gemsShop = 0
  let gemsPacks = 0
  // Третий и четвёртый гемовые стоки (шаги 6-7). Считаем отдельно по той же
  // причине, что shop и packs: «гир съел гачу» и «гир никому не нужен» в общей
  // сумме выглядят одинаково.
  let gemsGear = 0
  let gearActs = 0
  let garageActs = 0
  let competeActs = 0
  let nextSample = 0
  // Когда и во что игрок переехал: без этого списка непонятно, чем именно
  // отличаются стратегии, — итоговая сумма показывает только «лучше/хуже».
  const switches = []

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
    // Переход СТРОГО до драйверов и карьеры: и то и другое работает с активным
    // классом, и на кадре перехода они обязаны обслуживать уже новый.
    if (classPlan(state, { race, totalRaces }, takeSquad)) {
      switches.push({
        sec, to: state.activeClass, earned,
        idx: state.clsDef.index, price: CLASS_UNLOCK_PRICES[state.clsDef.index],
      })
    }
    // Награды — СТРОГО до гачи: собранные гемы должны попасть в тот же заход,
    // иначе бот копит их лишний цикл и приток выглядит меньше, чем он есть.
    if (race % DRIVER_EVERY === 0) {
      // Соревнования — СТРОГО до наград: их выплаты приходят письмом [E], а
      // письма разбирает rewardsBot. Обратный порядок означал бы, что каждая
      // награда турнира лежит в почте лишний цикл.
      competeActs += competeBot(state)
      claims += rewardsBot(state)
      // Магазин — СТРОГО между наградами и гачей: собранные гемы должны дойти
      // до дневных лимитированных паков, а в гачу уходит только остаток.
      const cashBeforeShop = state.cash
      const shop = shopBot(state)
      deals += shop.deals
      shopCash += state.cash - cashBeforeShop
      // Расход гемов приходит из самого бота: магазин в том же заходе и выдаёт
      // бесплатные гемы, и тратит их, поэтому разность кошелька занижала бы
      // трату (подробности — в шапке shopBot).
      gemsShop += shop.gems
      // Заработанное магазином входит в `earned`: без этого разрыв стратегий
      // (DECISION_GAP в tune.js) мерился бы по неполным деньгам.
      earned += state.cash - cashBeforeShop
      // Гир и гараж — СТРОГО до гачи драйверов и в этом порядке: обе траты
      // берут долю от ТЕКУЩЕГО кошелька (GEM_SPLIT в policies.js), а гача
      // сливает остаток в ноль. Поставить её раньше значило бы, что долей
      // никогда ничего не достаётся, и две новые оси силы мертвы.
      const gemsBeforeGear = state.gems
      gearActs += gearBot(state)
      garageActs += garageBot(state)
      garageActs += luckyBot(state)
      gemsGear += Math.max(0, gemsBeforeGear - state.gems)
      const gemsBeforeDraw = state.gems
      draws += driverBot(state)
      gemsPacks += Math.max(0, gemsBeforeDraw - state.gems)
      skills += career(state)
    }

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
        cls: state.clsDef.index,
        levels: Object.values(state.cls.levels).reduce((a, b) => a + b, 0),
        // Оба курса магазина — см. gachaPerGem() в policies.js.
        packPerGem: packPerGem(state), gachaPerGem: gachaPerGem(),
      })
    }
  }

  return {
    hours, races: totalRaces, purchases, draws, skills, claims, earned,
    deals, shopCash, gemsShop, gemsPacks, gemsGear, gearActs, garageActs,
    gemSplit: gemSplitReport(), competeActs,
    places, samples, milestones, switches, state,
  }
}
