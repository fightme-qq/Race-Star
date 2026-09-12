// Политики закупки — чем игрок занимает деньги. Разные политики нужны, чтобы
// отличить «экономика не растёт» от «бот покупает не то».

import { ECONOMY, RACE, LEAGUES, SEASON } from '../../src/config/balance.js'
import { SKILLS } from '../../src/config/career.js'
import { canSpend, pointsFree, rankOf } from '../../src/systems/CareerSystem.js'
import { racerShape, placeDist } from '../../src/systems/RaceModel.js'
import { GEAR_PACKS } from '../../src/config/gear.js'
import { PART_PACKS } from '../../src/config/garage.js'

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
export const resetPolicyCache = () => { reachCache.clear(); gacha.perGem = null }

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

// Курс двух гемовых стоков в долларах на гем — ТОЛЬКО ДЛЯ ОТЧЁТА. Решений по
// нему бот не принимает, и это сознательно.
//
// Первая версия шага 5 сравнения не делала вовсе: магазин скупал паки до
// дневного лимита при любом курсе, а в гачу уходил остаток. Доля гемов из-за
// этого держалась на 57% и при cashRateMult 1.0, и при 0.85 — то есть штраф
// SHOP_SHARE в переборе был вне досягаемости его единственной координаты.
//
// Порог напрашивался сам собой, и он ОКАЗАЛСЯ НЕВЕРНЫМ. Обе стороны честно
// приводятся к общему масштабу: пак даёт `rate` секунд дохода за гем, гача —
// прибавку к `ratePerSec` через тот же горизонт, по которому бот покупает
// боевые слоты. По этой мерке пак выгоднее ролла в 10-240 раз. Прямой замер
// (tools/sim/sinks.js) говорит обратное: «только гача» $25.8B против $23.3B у
// смешанной игры при курсе 1.0.
// Причина — заход из десяти роллов чаще всего НЕ МЕНЯЕТ состав: он копит pity
// и дубликаты, которые платят потом, при слиянии. Мгновенная прибавка к доходу
// этого не видит, и оценка гачи занижена систематически. Та же слепота, что
// была с Grandstands и Crowd Work.
// Поэтому баланс двух стоков проверяется прогоном с выключенным стоком, а не
// порогом внутри бота; оба курса печатаются в отчёте как объяснение доли.
const HORIZON_SEC = HORIZON_RACES * RACE.durationSec
const gacha = { perGem: null }

export const resetGachaValue = () => { gacha.perGem = null }

export const gachaPerGem = () => gacha.perGem
export const packPerGem = (state) => {
  const row = state.cashPacks.filter((r) => r.left > 0)
    .sort((a, b) => b.rate - a.rate)[0]
  return row ? row.rate * ratePerSec(state) : 0
}

// Вкладка 6 глазами игрока. Порядок внутри не произволен и держит весь смысл
// шага 5: сперва БЕСПЛАТНОЕ (гемы за день и за рекламу), потом ДНЕВНЫЕ
// ЛИМИТИРОВАННЫЕ паки «деньги за гемы», и только потом остаток уходит в гачу
// (driverBot вызывается следом). Обратный порядок означал бы, что игрок сначала
// спускает всё в паки драйверов, а магазин видит пустой кошелёк, — и лимиты,
// ради которых конструкция и сделана, никогда бы не связывали.
//
// Паки берём от лучшего курса к худшему: `Cash Vault` даёт больше секунд за гем,
// чем `Instant Cash`, и при нехватке гемов правильный отказ — от дешёвого.
// Расход гемов считается ВОКРУГ КАЖДОЙ ТРАТЫ, а не разностью кошелька до и
// после. Первая версия мерила именно разность — и молча занижала долю магазина,
// потому что он в том же заходе ВЫДАЁТ бесплатные гемы: 100 на входе, +35
// бесплатных, −60 в паки, 75 на выходе, и разность показывает трату 25 вместо
// 60. Метрика, ради которой всё это заведено (правило 26b), врала бы вдвое.
export function shopBot(state) {
  let deals = 0
  let cash = 0
  let gems = 0
  const spend = (fn) => {
    const before = state.gems
    if (!fn()) return false
    gems += Math.max(0, before - state.gems)
    deals++
    return true
  }

  if (state.claimDailyGems()) deals++
  while (state.watchShopAd()) deals++
  // Rookie Pass — единственная покупка магазина за гемы кроме паков. Берём его
  // раньше денежных паков: премиум-ветка живёт один сезон пасса и не переносится,
  // а деньги за гемы можно купить и завтра.
  spend(() => state.buyRookiePass())
  for (;;) {
    const rows = state.cashPacks.filter((r) => r.available)
    if (!rows.length) break
    rows.sort((a, b) => b.rate - a.rate)
    let got = 0
    if (!spend(() => (got = state.buyCashPack(rows[0].pack.id)))) break
    cash += got
  }
  return { deals, cash, gems }
}

export function driverBot(state) {
  const squad = state.roster.squad(state.activeClass)
  const weakest = squad.reduce((m, d) => Math.min(m, (d.off + d.def) / 2), Infinity)
  const packId = weakest >= ALLSTAR_SWITCH_RATING ? 'allstar' : 'pro'
  let draws = 0
  const gemsBefore = state.gems
  const rateBefore = ratePerSec(state)
  // Доля гачи в общем гемовом притоке — та же конструкция, что у гира и частей
  // (см. GEM_SHARES): без неё самый дешёвый сток забирает весь кошелёк.
  while (state.canDraw(packId) && underweight('drivers') && draws < 500) {
    const cost = state.packPrice(packId, 1)
    if (!state.drawPack(packId)) break
    noteGems('drivers', cost)
    draws++
  }
  state.roster.autoManage(state.activeClass, { seats: state.seats })
  // Замер после autoManage: гача полезна ровно настолько, насколько выпавшее
  // попало в состав. Скользящее среднее, а не последний заход: гача случайна,
  // и на одиночном заходе без легендарки порог обнулялся бы до нуля.
  const spentGems = gemsBefore - state.gems
  if (spentGems > 0) {
    const gain = Math.max(0, ratePerSec(state) - rateBefore) * HORIZON_SEC / spentGems
    gacha.perGem = gacha.perGem === null ? gain : 0.7 * gacha.perGem + 0.3 * gain
  }
  return draws
}

// --- Гир драйверов и гараж (шаги 6-7) ------------------------------------
// Гемы стали кошельком ЧЕТЫРЁХ трат: паки драйверов, паки гира, части машины и
// денежные паки магазина. Это ровно та конструкция, которая на шаге 5 чуть не
// убила вторую ось силы (правило 26b), только теперь стоков вдвое больше.
//
// Бот НЕ выбирает между стоками по курсу, и это сознательно — та же причина,
// по которой порог выкинут из shopBot: заход из десяти роллов чаще всего не
// меняет ни состав, ни надетое, он копит pity и дубликаты, которые платят
// потом, при merge. Мгновенная прибавка к ratePerSec этого не видит и занижает
// ценность любой гачи систематически.
//
// Поэтому доли — ПАРАМЕТР БОТА, а не игры: игрок держит все оси, вкладывая в
// каждую примерно постоянную часть притока. Требование «ни один сток в
// одиночку не обыгрывает смешанную игру» проверяется прогоном с выключенным
// стоком (tools/sim/sinks.js), а не этими числами.
// Гемы делятся между ТРЕМЯ силовыми стоками: паки гира, части машины и гача
// драйверов. (Четвёртый, денежные паки магазина, живёт отдельно — он ограничен
// дневным лимитом и расходует остаток по правилу 26b.)
//
// Делитель пришлось переписать ДВА РАЗА, и оба провала стоит держать здесь,
// потому что оба выглядели правдоподобно.
//
// Версия 1 — «доля от кошелька на каждом заходе». Гир получил 12 гемов против
// 460 у гачи, частей ноль. Причина арифметическая: пак гира стоит 12 гемов,
// частей 20, ролл гачи 10, и при кошельке в 30 гемов доля 0.30 даёт 9 — ни на
// что. Самый ДЕШЁВЫЙ сток забирает всё, в каком бы порядке ни стоял.
//
// Версия 2 — «гача оставляет резерв на одно открытие каждого нового стока».
// Маятник качнулся ровно наоборот: гир и части съели весь приток, гача получила
// НОЛЬ. Резерв не ограничивает того, кто стоит первым.
//
// Версия 3 (эта) — водоналивной делитель по НАКОПЛЕННЫМ долям. Сток тратит,
// пока его доля в сумме потраченного не дотянула до целевой, и останавливается,
// когда перебрал. Тогда дорогой пак достижим (гемы копятся, пока перевес у
// других), а дешёвый не выгребает кошелёк (он быстро становится перевешенным).
// Доли — ПАРАМЕТР БОТА, а не игры: «ни один сток не лишний» проверяется
// прогоном с выключенным стоком (tools/sim/sinks.js), а не этими числами.
// Lucky Draw (шаг 9) — четвёртый силовой сток того же кошелька: в сетке лежат
// осколки обеих осей, ядра Unique и легендарная машина [F]. Доли пересчитаны, а
// не дописаны: сумма обязана остаться единицей, иначе делитель перестаёт делить.
const GEM_SHARES = { gear: 0.26, parts: 0.20, drivers: 0.42, lucky: 0.12 }

const gemSpent = { gear: 0, parts: 0, drivers: 0, lucky: 0 }

// Сбрасывается на каждый прогон — как и измеренная ценность гачи: иначе доли,
// набранные одной политикой, утекают в следующую, и две политики отличаются
// историей делителя, а не тем, что они покупают.
export const resetGemPlan = () => {
  gemSpent.gear = 0; gemSpent.parts = 0; gemSpent.drivers = 0; gemSpent.lucky = 0
}

export const gemSplitReport = () => ({ ...gemSpent })

const underweight = (sink) => {
  const total = Object.values(gemSpent).reduce((a, b) => a + b, 0)
  return gemSpent[sink] <= GEM_SHARES[sink] * total
}

const noteGems = (sink, amount) => { gemSpent[sink] += amount }

// Осколки вкладываются только в НАДЕТОЕ (bestUpgrade), иначе бот прокачивал бы
// предмет в сумке и силы бы это не давало — правило 15 в чистом виде.
const sinkShards = (bag, owner, upgrade, cap = 40) => {
  let n = 0
  for (; n < cap; n++) {
    const best = bag.bestUpgrade(owner)
    if (!best || !upgrade(best.it.uid)) break
  }
  return n
}

// Общий ход «открыть паков на свою долю»: от дорогого к дешёвому (у дорогого
// гарантия приходит за меньшее число открытий, то есть ступень редкости стоит
// дешевле), x10 раньше x1 (та же цена за открытие, но pity копится быстрее).
function drawWithin(state, sink, rows, price, draw) {
  let acts = 0
  for (const row of [...rows].reverse()) {
    for (const count of [10, 1]) {
      for (;;) {
        if (!underweight(sink)) return acts
        const cost = price(row.pack.id, count)
        if (state.gems < cost || !draw(row.pack.id, count)) break
        noteGems(sink, cost)
        acts++
      }
    }
  }
  return acts
}

export function gearBot(state) {
  let acts = 0
  // Бесплатное первым: реклама [E] и купоны идут мимо гемов вообще.
  while (state.watchGearAd()) acts++
  for (const row of state.gearPacks) {
    while (row.coupons > 0 && state.drawGear(row.pack.id, 1, true)) { acts++; break }
  }
  acts += drawWithin(state, 'gear', state.gearPacks,
    (id, n) => state.gearPackPrice(id, n), (id, n) => state.drawGear(id, n))
  acts += state.autoGear()
  acts += sinkShards(state.gear, state.activeClass, (uid) => state.upgradeGear(uid))
  return acts
}

export function garageBot(state) {
  let acts = 0
  // Машина за гемы — разовая покупка, и она идёт ПЕРЕД частями: части носит
  // машина (partOwner), и купленные под слабую машину они никуда не деваются,
  // но уровень у слабой машины оплачивается деньгами зря.
  for (const row of state.carsOfClass()) {
    if (!row.owned && row.def.unlock === 'gems' && state.buyCar(row.def.id)) acts++
  }
  acts += drawWithin(state, 'parts', state.partPacks,
    (id, n) => state.partPackPrice(id, n), (id, n) => state.drawParts(id, n))
  acts += state.autoGarage()
  const car = state.car
  if (car) {
    acts += sinkShards(state.parts, `car:${car.id}`, (uid) => state.upgradePart(uid))
    // Уровень машины стоит ДЕНЕГ (секунды дохода), то есть конкурирует с
    // апгрейдами. Берём не больше одного за заход: иначе бот выкупает всю
    // лестницу уровней в тот момент, когда доход впервые её перекрыл, и
    // сравнение с политиками закупки теряет смысл.
    if (state.upgradeActiveCar()) acts++
  }
  return acts
}

// --- Соревнования (шаг 8) ------------------------------------------------
// Отдельный контур наград: арена, турниры, кубок и клуб платят гемами,
// осколками и купонами. Кривую дохода они не трогают, но КОРМЯТ две оси силы,
// подобранные на шагах 6-7, — значит прогон без них мерил бы другую игру
// (правило 20). Писем это тоже касается: награды приходят почтой [E], а её
// разбирает rewardsBot, то есть порядок вызова важен — компетишн ДО наград.
export function competeBot(state) {
  let acts = 0
  // Регистрация во всё, куда пускают. Отказы содержательные (недельный турнир
  // идёт классом недели, ступень кубка открывается лигой), и бот их не
  // обходит — иначе стенд получал бы награды, недоступные игроку.
  for (const kind of ['league', 'weekly', 'cup']) {
    if (state.registerBracketFor(kind)) acts++
  }
  // Арена: тикеты всё равно сгорают на сбросе в 05:00 UTC [E], поэтому играть
  // надо всегда, и выбор соперника — единственное решение. Берём самого
  // сильного из тех, кого обыгрываем с запасом: медали за проигрыш есть, но
  // втрое меньше.
  for (let guard = 0; guard < 10; guard++) {
    const opps = state.arenaOpponents
    if (!opps.length) break
    const scored = opps.map((o, i) => ({ i, chance: state.arenaChance(o) }))
      .sort((a, b) => b.chance - a.chance)
    const pick = scored.find((s) => s.chance >= 0.5) ?? scored[0]
    if (!state.playArena(pick.i)) break
    acts++
  }
  // Клуб: вступаем в самый сильный из доступных (порог силы [E]) и держим
  // событие запущенным. Захватываем позиции, пока есть вызовы: верхние дороже
  // по очкам [E], поэтому идём сверху.
  if (state.club.joined === null) {
    const rows = state.clubRows.filter((r) => r.canJoin)
    if (rows.length && state.joinClub(rows.at(-1).index)) acts++
  }
  if (state.club.joined !== null) {
    if (!state.clashOn) { if (state.startClash()) acts++ }
    if (state.clashOn) {
      for (let i = 0; i < 8 && state.clubChallengesLeft > 0; i++) {
        if (state.capturePosition(i).ok) { acts++; break }
      }
    }
  }
  return acts
}

// Lucky Draw глазами игрока: сетка вычерпывается [E], поэтому крутить её надо до
// конца — последние ячейки дороже по ожиданию, но в них лежит главный приз.
// Доля та же конструкция, что у остальных стоков (GEM_SHARES).
export function luckyBot(state) {
  let acts = 0
  for (let i = 0; i < 20; i++) {
    if (!underweight('lucky') || state.luckyLeftNow <= 0) break
    const cost = state.luckyPrice
    if (state.gems < cost || !state.playLucky()) break
    noteGems('lucky', cost)
    acts++
  }
  // Коллекции: паки приходят за заезды (не за гемы), но открывать их и забирать
  // награды альбомов — часть игры. Не делать этого значило бы подбирать баланс
  // по игроку, который не открывает половину экрана (правило 25).
  while (state.collectionState.packs > 0 && state.openCollectionPack()) acts++
  for (const row of state.starShop) {
    while (state.buyStarPackFor(row.id)) acts++
  }
  while (state.collectionState.packs > 0 && state.openCollectionPack()) acts++
  for (const al of state.albums) {
    if (al.complete && !al.claimed && state.claimAlbumReward(al.index).length) acts++
  }
  if (state.claimUltimateReward().length) acts++
  // Ядра Unique: жертва — слабейший из резерва, как при merge [E].
  for (const d of state.roster.drivers) {
    if (!state.canCoreUp(d.uid)) continue
    const victim = state.roster.sortedReserves().at(-1)
    if (victim && state.coreUp(d.uid, victim.uid)) acts++
  }
  return acts
}
