// Политики закупки — чем игрок занимает деньги. Разные политики нужны, чтобы
// отличить «экономика не растёт» от «бот покупает не то».

import { ECONOMY, RACE, LEAGUES, SEASON } from '../../src/config/balance.js'

const buyableKeys = (state) =>
  state.clsDef.upgrades.filter((u) => u.currency === 'cash').map((u) => u.key)

// Соперники расставлены по leaguePower * spread — как в fastRace.
const SPREAD = [0.72, 0.80, 0.87, 0.93, 1.0, 1.06, 1.13, 1.21, 1.32]

// Вероятность обогнать соперника. В fastRace обе формы логнормальны с одной и
// той же сигмой, значит разность логарифмов нормальна с sigma*sqrt(2), а шанс
// = Ф(0.45 * ln(своя/чужая) / (sigma*sqrt(2))).
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x >= 0 ? y : -y
}
// Ф(z) = 0.5*(1+erf(z/sqrt(2))), поэтому делители sqrt(2) сокращаются в 2*sigma.
const beatProb = (mine, theirs) =>
  0.5 * (1 + erf(0.45 * Math.log(mine / theirs) / (2 * RACE.formSigma)))

// Точное распределение мест — свёртка девяти независимых исходов
// (Пуассон-биномиальное). dist[k] = вероятность проиграть ровно k соперникам.
function placeDist(power, leaguePower) {
  let dist = [1]
  for (const s of SPREAD) {
    const w = beatProb(power, leaguePower * s)
    const next = new Array(dist.length + 1).fill(0)
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * w
      next[k + 1] += dist[k] * (1 - w)
    }
    dist = next
  }
  return dist
}

const seasonPoints = (dist) =>
  SEASON.winPoints * dist[0] + SEASON.podiumPoints * (dist[1] + dist[2])

// Ключевая правка. Раньше оценщик мерил только текущее место и потому не видел
// главного: боевые апгрейды окупаются не призом, а ПОВЫШЕНИЕМ В ЛИГЕ, а это
// x1.585 к доходу навсегда. Из-за этой слепоты roiGreedy не покупал бой вовсе,
// сидел в ROOKIE все 700ч и проигрывал наивному боту в 61 раз по деньгам.
//
// Считаем, докуда дотянет текущая сила: лига засчитывается, если ожидаемые
// очки за гонку не ниже порога повышения. Порог мягкий (сигмоида) — при
// жёстком ценность прыгает ступенькой, и жадный поиск её не перешагнёт.
// Кэш по силе. Перебор в tune.js правит силу лиг на месте, поэтому между
// прогонами его обязательно сбрасывать — иначе оценщик считает по прошлому
// конфигу и подбор сходится не туда.
const reachCache = new Map()
export const resetPolicyCache = () => reachCache.clear()

function reachableLeague(power) {
  const key = Math.round(power * 4)
  let hit = reachCache.get(key)
  if (hit === undefined) {
    hit = 0
    for (const l of LEAGUES) {
      const pts = seasonPoints(placeDist(power, l.power))
      hit += 1 / (1 + Math.exp(-(pts - SEASON.promoteRatio) / 0.12))
    }
    reachCache.set(key, hit)
  }
  return hit
}

// Оценка суммарного $/с: пассив + приз, размазанный по длине гонки. Доход
// нормируем на нулевую лигу и заново поднимаем до достижимой — так покупка
// боевого слота оценивается по тому, куда она доведёт, а не где игрок сейчас.
// Горизонт планирования бота в гонках (~14 игровых часов). Это параметр
// ОЦЕНЩИКА, не игры: Grandstands не даёт денег в момент покупки, он поднимает
// приток фанатов, а фанаты — множитель дохода. Без горизонта прирост от него
// ровно нулевой, и жадный бот не покупает ветку фанатов вовсе (та же слепота,
// что была с лигами). Берём средний множитель за горизонт — отсюда H/2.
const HORIZON_RACES = 850

export function ratePerSec(state) {
  const dist = placeDist(state.teamPower, state.league.power)
  let prizeShare = 0
  let fanPlace = 0
  for (let k = 0; k < 10; k++) {
    prizeShare += dist[k] * ECONOMY.placePrize[k]
    fanPlace += dist[k] * ECONOMY.placeFans[k]
  }
  prizeShare *= ECONOMY.prizeSeconds / RACE.durationSec

  const fansPerRace = (ECONOMY.fansPerRace + state.agg.fansPerRace) * fanPlace
  const projFans = state.cls.fans + fansPerRace * HORIZON_RACES / 2
  const fanScale = (1 + projFans / ECONOMY.fansPerFanBonus) / state.fanMultiplier

  const atLeagueZero = state.incomePerSec / state.leagueMultiplier
  const reach = Math.max(state.cls.league, reachableLeague(state.teamPower))
  return atLeagueZero * fanScale * Math.pow(ECONOMY.leagueIncomeMult, reach) * (1 + prizeShare)
}

export function expectedPlace(state) {
  const dist = placeDist(state.teamPower, state.league.power)
  return dist.reduce((acc, p, k) => acc + p * (k + 1), 0)
}

// Предохранитель: при заведомо сломанном конфиге (доход обгоняет цену) бот
// может скупать бесконечно. Перебор коэффициентов не должен от этого вешаться.
const MAX_BUYS_PER_CALL = 2000

// Всё подряд, начиная с самого дешёвого — так играет большинство.
export const cheapestFirst = (state) => {
  let bought = 0
  while (bought < MAX_BUYS_PER_CALL) {
    const keys = buyableKeys(state).filter((k) => state.canBuy(k))
    if (!keys.length) break
    keys.sort((a, b) => state.priceOf(a) - state.priceOf(b))
    state.buy(keys[0]); bought++
  }
  return bought
}

// Только экономическая ветка — верхняя граница по деньгам.
export const economyOnly = (state) => {
  let bought = 0
  while (bought < MAX_BUYS_PER_CALL) {
    const keys = buyableKeys(state).filter((k) => k[0] === 'e' && state.canBuy(k))
    if (!keys.length) break
    keys.sort((a, b) => state.priceOf(a) - state.priceOf(b))
    state.buy(keys[0]); bought++
  }
  return bought
}

// ROI: покупаем то, что даёт больший прирост $/с на доллар. Прирост меряем
// честно — временно поднимаем уровень и пересчитываем ставку.
export const roiGreedy = (state) => {
  let bought = 0
  while (bought < MAX_BUYS_PER_CALL) {
    const before = ratePerSec(state)
    let best = null
    for (const key of buyableKeys(state)) {
      if (!state.canBuy(key)) continue
      const price = state.priceOf(key)
      const lv = state.levelOf(key)
      state.cls.levels[key] = lv + 1
      const gain = ratePerSec(state) - before
      state.cls.levels[key] = lv
      const score = gain / Math.max(1, price)
      if (score > 0 && (!best || score > best.score)) best = { key, score }
    }
    if (!best) break
    state.buy(best.key); bought++
  }
  return bought
}

export const POLICIES = { cheapestFirst, economyOnly, roiGreedy }

// --- Драйверы ------------------------------------------------------------
// Вторая ось силы качается за гемы, а не за деньги, поэтому не входит в
// политики закупки и применяется во всех трёх одинаково.
// Порог перехода на дорогой пак: пока состав слабее All-Star, дешёвый PRO
// PACK выгоднее по рейтингу на гем (в среднем ~3.5 против ~2.4), но как
// только пятёрка набрана All-Star'ами, его выпадения перестают попадать в
// состав вовсе и остаются только кормом.
const ALLSTAR_SWITCH_RATING = 66

export function driverBot(state) {
  const squad = state.roster.squad(state.activeClass)
  const weakest = squad.reduce((m, d) => Math.min(m, (d.off + d.def) / 2), Infinity)
  const packId = weakest >= ALLSTAR_SWITCH_RATING ? 'allstar' : 'pro'
  let draws = 0
  while (state.canDraw(packId) && draws < 500) { state.drawPack(packId); draws++ }
  state.roster.autoManage(state.activeClass)
  return draws
}
