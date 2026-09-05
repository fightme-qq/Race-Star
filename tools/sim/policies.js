// Политики закупки — чем игрок занимает деньги. Разные политики нужны, чтобы
// отличить «экономика не растёт» от «бот покупает не то».

import { ECONOMY, RACE, LEAGUES, SEASON } from '../../src/config/balance.js'
import { SKILLS } from '../../src/config/career.js'
import { canSpend, pointsFree, rankOf } from '../../src/systems/CareerSystem.js'
import { racerShape, placeDist } from '../../src/systems/RaceModel.js'

const buyableKeys = (state) =>
  state.clsDef.upgrades.filter((u) => u.currency === 'cash').map((u) => u.key)

// Покупка разрешена, только если после неё останется резерв на разблокировку
// класса (его выставляет tools/sim/classplan.js). Без резерва бот тратит всё в
// ноль каждую гонку, и цена класса набирается лишь тем единичным призом, что
// её перекрыл, — до пятого и шестого класса прогон не доходил вовсе.
const affordable = (state, key) =>
  state.canBuy(key) && state.cash - state.priceOf(key) >= (state.simReserve || 0)

// beatProb / placeDist переехали в src/systems/RaceModel.js: с Этапа 4 шанс
// зависит не только от суммы статов, но и от расклада между ними, и держать
// формулу отдельно от гонки значило бы подбирать баланс по чужой модели.

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
// В ключ входит и ПЕРЕКОС: две команды одной суммарной силы, но с разным
// раскладом, доезжают до разных лиг. Забыть tilt здесь — значит вернуть ровно
// ту слепоту, из-за которой защита считалась пустышкой.
const reachCache = new Map()
export const resetPolicyCache = () => reachCache.clear()

export function reachableLeague(shape) {
  const key = Math.round(shape.power * 4) + ':' + Math.round(shape.tilt * 200)
  let hit = reachCache.get(key)
  if (hit === undefined) {
    hit = 0
    for (const l of LEAGUES) {
      const pts = seasonPoints(placeDist(shape, l.power))
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

// Горизонт карьерных решений на порядок длиннее. Очко навыка не покупается за
// деньги и не обесценивается — оно вкладывается НАВСЕГДА, поэтому меряется
// остатком игры, а не ближайшими четырнадцатью часами, как апгрейд за $25.
// Проверено прогоном: с горизонтом 850 бот не брал Crowd Work вовсе, а ручная
// раскладка «фанаты вперёд» обыгрывала его на 63% ($135B против $83B).
const CAREER_HORIZON_RACES = 25000

// Оценщик пересобран на шаге 2 вместе с экономикой. Раньше он делил доход на
// множитель лиги и поднимал обратно до достижимой — теперь ни лига, ни класс
// на доходе не сидят, они умножают ПРИТОК ФАНАТОВ. Значит и ценность боевого
// слота меряется иначе: он поднимает не доход напрямую, а скорость набора
// фанатов — и через горизонт превращается в доход.
export function ratePerSec(state, horizonRaces = HORIZON_RACES) {
  const p = state.power
  const shape = racerShape(p.off, p.def)
  const dist = placeDist(shape, state.league.power)
  const fx = state.careerFx
  let prizeShare = 0
  let fanPlace = 0
  let winShare = 0
  for (let k = 0; k < 10; k++) {
    prizeShare += dist[k] * ECONOMY.placePrize[k]
    fanPlace += dist[k] * ECONOMY.placeFans[k]
  }
  winShare = dist[0]
  // Проценты карьерных скиллов к призу и фанатам — здесь же. Оценщик, который
  // их не видит, объявил бы Prize Hunter и Crowd Work бесполезными: ровно та
  // слепота, из-за которой roiGreedy когда-то не покупал бой и лиги.
  // Лига засчитывается достижимая, а не текущая: боевой апгрейд окупается тем,
  // куда он доведёт по лестнице, а ступенька приходит через сезон. Множитель
  // лиги сидит на призовых (см. ECONOMY), поэтому и здесь он множит их.
  const reach = Math.max(state.cls.league, reachableLeague(shape))
  prizeShare *= (ECONOMY.prizeSeconds / RACE.durationSec)
    * Math.pow(ECONOMY.leaguePrizeMult, reach) * (1 + fx.prizePct / 100)

  const fansPerRace = state.agg.fansPerRace * fanPlace
    * Math.pow(ECONOMY.classFanMult, state.clsDef.index)
    * (1 + fx.fansPct / 100)
  // Средний доход за горизонт: фанаты копятся линейно, отсюда H/2.
  const projFans = state.cls.fans + fansPerRace * horizonRaces / 2
  const career = Math.max(0.05, 1 + fx.incomePct / 100)
  const income = Math.max(ECONOMY.baseIncomePerSec, projFans / ECONOMY.fansPerDollar) * career

  // Плоские выплаты ветки — деньги за гонку, приводим к секунде.
  const flat = (state.agg.cashPerRace + winShare * state.agg.cashPerWin) / RACE.durationSec
  return income * (1 + prizeShare) + flat
}

export function expectedPlace(state) {
  const p = state.power
  const dist = placeDist(racerShape(p.off, p.def), state.league.power)
  return dist.reduce((acc, prob, k) => acc + prob * (k + 1), 0)
}

// Предохранитель: при заведомо сломанном конфиге (доход обгоняет цену) бот
// может скупать бесконечно. Перебор коэффициентов не должен от этого вешаться.
const MAX_BUYS_PER_CALL = 2000

// Всё подряд, начиная с самого дешёвого — так играет большинство.
export const cheapestFirst = (state) => {
  let bought = 0
  while (bought < MAX_BUYS_PER_CALL) {
    const keys = buyableKeys(state).filter((k) => affordable(state, k))
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
    const keys = buyableKeys(state).filter((k) => k[0] === 'e' && affordable(state, k))
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
      if (!affordable(state, key)) continue
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

// --- Карьерный драйвер ---------------------------------------------------
// Очки навыка не покупаются, они капают за гонки, поэтому карьера тоже вне
// политик закупки. Раскладываем очки жадно по ratePerSec — тем же оценщиком,
// что и апгрейды, иначе ветка с трейд-оффами оценивалась бы по другой шкале.
// Половина узлов даёт минус (Glass Cannon: −7% защиты за ранг), и в ярусе
// может не найтись ни одного плюсового хода — берём лучший из имеющихся, а не
// «только положительный»: очки всё равно нужно вложить, чтобы открыть ярус.
export function careerBot(state) {
  const career = state.cls.career
  let spent = 0
  while (pointsFree(career) > 0 && spent < 200) {
    const before = ratePerSec(state, CAREER_HORIZON_RACES)
    let best = null
    for (const skill of SKILLS) {
      if (!canSpend(career, skill)) continue
      career.spent[skill.id] = rankOf(career, skill.id) + 1
      state.invalidateCareer()
      const gain = ratePerSec(state, CAREER_HORIZON_RACES) - before
      career.spent[skill.id] -= 1
      state.invalidateCareer()
      if (!best || gain > best.gain) best = { id: skill.id, gain }
    }
    if (!best || !state.spendSkill(best.id)) break
    spent++
  }
  return spent
}

// Вкладка 5 глазами игрока: забрать всё, что забирается. Стенд обязан играть
// во ВСЮ игру (правило 20), а награды — источник гемов помимо побед, то есть
// они кормят гачу, а гача — вторую ось силы. Не собирать их значило бы
// подбирать баланс по игроку, который не открывает половину экрана.
//
// Реклама здесь же: `Activate 2x` бесплатен и закрывает дневную задачу
// `Watch an ad` [F]. Лимит 6 на класс [F] делает эту задачу выполнимой всего
// 36 раз за прогон — расхождение с оригиналом, где рекламу смотрят и вне
// буста; записано в FINDINGS.
export function rewardsBot(state) {
  let claims = 0
  while (state.activateAdBoost()) claims++
  if (state.claimAllTaskRewards()) claims++
  for (const row of state.passRows) {
    if (row.free.claimable && state.claimPassReward(row.level, false)) claims++
  }
  if (state.claimLoginReward().length) claims++
  for (const msg of [...state.mailList]) {
    if (!msg.claimed && msg.reward && state.claimMailReward(msg.id)) claims++
  }
  return claims
}

export function driverBot(state) {
  const squad = state.roster.squad(state.activeClass)
  const weakest = squad.reduce((m, d) => Math.min(m, (d.off + d.def) / 2), Infinity)
  const packId = weakest >= ALLSTAR_SWITCH_RATING ? 'allstar' : 'pro'
  let draws = 0
  while (state.canDraw(packId) && draws < 500) { state.drawPack(packId); draws++ }
  state.roster.autoManage(state.activeClass)
  return draws
}
