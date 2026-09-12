import { RACE_CLASSES, CLASS_BY_ID, getUpgrade } from '../config/classes.js'
import { ECONOMY, LEAGUES, GEMS, SEASON, CLASS_UNLOCK_PRICES, AD_BOOST } from '../config/balance.js'
import { PACK_BY_ID, RARITY_BY_ID } from '../config/drivers.js'
import { CAREER } from '../config/career.js'
import { aggregateClass, upgradePrice, isUpgradeLocked } from './UpgradeSystem.js'
import { Roster } from './Roster.js'
import { placeDistOf } from './RaceModel.js'
import {
  freshStandings, standingsRows, playerRank, promotionTarget, archiveSeason,
} from './SeasonSystem.js'
import { SaveSystem } from './SaveSystem.js'
import { formatMoney } from '../utils/format.js'
import {
  freshCareer, careerEffects, careerStats, addCareerXp,
  spendPoint, resetSkills, pointsFree, pointsSpent,
} from './CareerSystem.js'
import {
  freshRewards, rollover, trackMetric, claimTask, claimAllTasks, tasksOf,
  claimLogin, claimMail, pushMail, loginState, mailUnread, resetInSec,
} from './RewardsSystem.js'
import { claimPass, passProgress, passRows, passClaimable, passLeftMs } from './SeasonPass.js'
import {
  cashPackRows, takeCashPack, freeState, takeDailyGems, takeAdGems,
  rookiePassState, takeRookiePass,
} from './ShopSystem.js'
import { newGearBag, slotRows, slotOpen, openSlotCount, packRows } from './GearSystem.js'
import { GEAR_PACK_BY_ID, GEAR } from '../config/gear.js'
import {
  PART_PACK_BY_ID, PAINT_PRICE_SECONDS, PAINTS, DECALS, CAR_BY_ID,
} from '../config/garage.js'
import {
  newPartBag, freshGarage, ensureStarterCar, activeCar, garageStats, carRows,
  carStats, selectCar, upgradeCar, grantCar, autoGarage, partOwner, partPackRows,
  slotRowsFor, buyPaint, buyDecal,
} from './GarageSystem.js'
import { seatCount } from '../config/drivers.js'
import { CLUB, CUP, WEEKLY, BRACKET } from '../config/compete.js'
import {
  freshArena, arenaRollover, arenaOpponents, arenaMatch, arenaRefresh,
  arenaRank, arenaLeague, arenaNextLeague, arenaRankings, arenaResetInSec,
  arenaWinChance,
} from './ArenaSystem.js'
import {
  freshBracket, freshCup, bracketField, registerBracket, advanceBracket,
  bracketReady, roundOpponent, roundName, rewardsForPlace, cupTierOpen,
  cupTierName, cupTaken, cupFailed,
} from './BracketSystem.js'
import {
  freshClub, clubList, clubRollover, challengesLeft, startClash, clashActive,
  accrueClash, capture, settleClash, predictedRewards,
} from './ClubSystem.js'
import { rivalNames } from '../config/rivals.js'
import { LUCKY, CORES, COLLECTION } from '../config/extras.js'
import {
  freshExtras, outfitRows, outfitEffects, grantOutfit, equipOutfit,
  canCore, applyCore, luckyRollover, luckyRows, luckyLeft, luckyDraw,
  redeemCode, avatarRows, setAvatar, addFrame, setFrame,
} from './ExtrasSystem.js'
import {
  freshCollection, collectionRollover, albumRows, openPack, buyStarPack,
  useWild, claimAlbum, claimUltimate, trackRace as trackCollectionRace,
  seasonAlbums,
} from './CollectionSystem.js'
import { CARS as ALL_CARS } from '../config/garage.js'

const todayKey = () => new Date().toISOString().slice(0, 10)

// [F] Имя команды у каждого класса СВОЁ: на кадре карточки классов у Racing
// «Racing Reds», у Rally «BootNRally». До шага 1 оно у нас было одно на всю
// игру. Названия наши [X] — чужие переносить нельзя.
const TEAM_NAMES = ['Red Racers', 'Iron Stocks', 'Dust Devils', 'Night Riders', 'Blue Streak', 'Big Foot Crew']

const freshClass = (index) => ({
  unlocked: index === 0,
  teamName: TEAM_NAMES[index] || 'Your Team',
  levels: {},
  fans: 0,
  // Пробег класса за всю игру. Нужен слотам гира [E] `Play {0} races to
  // unlock`: seasonRaces для этого не годится — он обнуляется каждый сезон, и
  // слоты открывались бы и закрывались обратно.
  races: 0,
  league: 0,
  season: 1,
  seasonScore: 0,
  seasonRaces: 0,
  seasonWins: 0,
  standings: freshStandings(),   // таблица лиги: очки и победы девяти соперников
  history: [],                   // `Season History` [E], последние 8 сезонов
  adBoostsUsed: 0,
  career: freshCareer(),   // карьерный драйвер у каждого класса свой [F]
})

export class GameState {
  constructor() {
    const saved = SaveSystem.load()
    this.cash = saved?.cash ?? 0
    this.gems = saved?.gems ?? 0
    this.trophies = saved?.trophies ?? 0
    this.trophiesEarned = saved?.trophiesEarned ?? 0
    this.activeClass = saved?.activeClass ?? 'racing'
    this.gemsDay = saved?.gemsDay ?? todayKey()
    this.gemsToday = saved?.gemsDay === todayKey() ? (saved?.gemsToday ?? 0) : 0
    this.adBoostUntil = 0
    this.classes = {}
    for (const c of RACE_CLASSES) {
      this.classes[c.id] = { ...freshClass(c.index), ...(saved?.classes?.[c.id] ?? {}) }
    }
    // Пятёрка стартовых выдаётся при открытии класса [F: «STARTERS (5)»].
    this.roster = new Roster(saved?.roster)
    for (const c of RACE_CLASSES) {
      if (this.classes[c.id].unlocked) this.roster.ensureStarters(c.id, c.index)
    }
    this.rewards = { ...freshRewards(), ...(saved?.rewards ?? {}) }
    rollover(this.rewards)
    // Третья и четвёртая оси силы: гир драйверов (вкладка 2) и гараж (шаг 7).
    // Мешки предметов — один класс на два домена (см. GearBag.js).
    this.gear = newGearBag(saved?.gear)
    this.garage = { ...freshGarage(), ...(saved?.garage ?? {}) }
    this.parts = newPartBag(this.garage.parts)
    for (const c of RACE_CLASSES) {
      if (this.classes[c.id].unlocked) ensureStarterCar(this.garage, c.id)
    }
    // Соревнования (шаг 8). Отдельный блок, а не поле класса: арена и клуб
    // общие для всех классов [E] («compete across multiple classes»), а турнир
    // лиги и кубок привязаны к классу через свой ключ периода.
    this.compete = {
      arena: freshArena(),
      league: freshBracket(),
      weekly: freshBracket(),
      cup: freshCup(),
      club: freshClub(),
      ...(saved?.compete ?? {}),
    }
    // Доборы шага 9: аутфиты, ядра, Lucky Draw, коды, косметика + коллекции.
    this.extras = { ...freshExtras(), ...(saved?.extras ?? {}) }
    this.collection = { ...freshCollection(), ...(saved?.collection ?? {}) }
    this.lastSeen = saved?.lastSeen ?? Date.now()
  }

  // --- Награды (вкладка 5) -----------------------------------------------
  // Единая точка входа: сброс периодов проверяется при КАЖДОМ обращении, а не
  // при запуске. Сутки могут наступить при открытой вкладке — гонки идут по
  // минуте и игрок сидит в ней подолгу.
  get rw() { rollover(this.rewards); return this.rewards }

  track(metric, amount = 1) { trackMetric(this.rw, metric, amount) }

  // Выдаёт награду и возвращает строку для тоста. `cashSec` меряется в
  // секундах СУММАРНОГО дохода: награда не привязана к классу, в отличие от
  // призовых (правило 8b). Двойной экспоненты тут нет — награда не растит
  // фанатов, значит сама себя не разгоняет.
  grant(reward) {
    if (!reward) return ''
    if (reward.kind === 'gems') {
      // Награды НЕ под дневным капом: кап 150/день [F] снят с попапа финиша,
      // то есть он про гемы за победы. При 17% побед он выбивается за четверть
      // суток, и общий кап обнулил бы весь этот экран.
      this.addGems(reward.amount, false)
      return `+${reward.amount} 💎`
    }
    if (reward.kind === 'trophy') { this.addTrophies(reward.amount); return `+${reward.amount} 🏆` }
    if (reward.kind === 'cashSec') {
      const cash = this.incomePerSec * reward.amount
      this.addCash(cash)
      return '+' + formatMoney(cash)
    }
    // Шаг 8: соревнования платят не только валютой, но и расходниками двух
    // новых осей силы. Это и есть причина, по которой контур наград отдельный:
    // он кормит гир и гараж, не добавляя множителя к деньгам, то есть кривую
    // дохода не трогает вовсе.
    if (reward.kind === 'shards') {
      this.gear.addShards(reward.shard, reward.amount)
      return `+${reward.amount} ⬢`
    }
    if (reward.kind === 'carShards') {
      this.parts.addShards(reward.shard, reward.amount)
      return `+${reward.amount} ⚙`
    }
    if (reward.kind === 'coupon') {
      this.gear.addCoupon(reward.coupon, reward.amount)
      return `+${reward.amount} 🎫`
    }
    // Шаг 9. Ядра — единственный путь к прокачке Unique [E], и купить их за
    // гемы нельзя намеренно: вершина лестницы редкостей не должна покупаться
    // кошельком.
    if (reward.kind === 'cores') {
      this.extras.cores += reward.amount
      return `+${reward.amount} ⬣`
    }
    if (reward.kind === 'outfit') {
      // Без конкретного id — первый ненадетый: приз «аутфит» не должен
      // превращаться в звезду к уже полученному, пока есть неоткрытые.
      const id = reward.outfit
        ?? (this.outfits.find((r) => !r.owned)?.def.id ?? this.outfits[0].def.id)
      const res = grantOutfit(this.extras, id)
      this.invalidateOutfits()
      return res === 'new' ? 'New outfit!' : res === 'star' ? '+1 ★ outfit' : ''
    }
    // Машина и звезда машины — призы Lucky Draw [F]. Легендарную машину иначе
    // взять негде: за доллары мы не продаём (правило 26a).
    if (reward.kind === 'car' || reward.kind === 'carStar') {
      const tier = reward.kind === 'car' ? (reward.tier || 'legend') : null
      const car = tier
        ? ALL_CARS.find((c) => c.classId === this.activeClass && c.tier === tier)
        : this.car
      if (!car) return ''
      const res = this.grantCar(car.id)
      return res === 'new' ? `${car.name} unlocked!` : res === 'star' ? `${car.name} +1 ★` : ''
    }
    return ''
  }

  tasksIn(scope) { return tasksOf(this.rw, scope) }
  resetInSec(scope) { return resetInSec(scope) }
  get passProgress() { return passProgress(this.rw) }
  get passRows() { return passRows(this.rw) }
  get passLeftSec() { return passLeftMs(Date.now()) / 1000 }
  get loginInfo() { return loginState(this.rw) }
  get mailList() { return this.rw.mail }

  // Красная точка на вкладке 5: сколько всего готово к получению. Считаем
  // здесь, а не в навигации, — иначе счётчик пришлось бы собирать из четырёх
  // мест в UI, и он бы разошёлся с содержимым вкладки.
  get rewardsPending() {
    const rw = this.rw
    const tasks = tasksOf(rw, 'daily').concat(tasksOf(rw, 'weekly')).filter((t) => t.claimable).length
    return tasks + passClaimable(rw).length + (loginState(rw).available ? 1 : 0) + mailUnread(rw)
  }

  claimTaskReward(scope, id) { return claimTask(this.rw, scope, id) }
  claimAllTaskRewards() { return claimAllTasks(this.rw) }

  claimPassReward(level, premium = false) {
    return this.grant(claimPass(this.rw, level, premium))
  }

  claimLoginReward() {
    return claimLogin(this.rw).map((r) => this.grant(r)).filter(Boolean)
  }

  claimMailReward(id) { return this.grant(claimMail(this.rw, id)) }

  mail(title, body, reward = null) { pushMail(this.rw, { title, body, reward }) }

  // --- Магазин (вкладка 6) ------------------------------------------------
  // Работает ровно то, что в оригинале стоит гемов; всё, что стоит долларов,
  // вкладка показывает витриной и не продаёт (см. шапку config/shop.js).
  get cashPacks() { return cashPackRows(this.rw, this.gems) }
  get shopFree() { return freeState(this.rw) }
  get rookiePass() { return rookiePassState(this.rw, this.gems) }

  // Деньги за гемы. Выплата — секунды СУММАРНОГО дохода (правило 8b): пак не
  // привязан к классу, в отличие от призовых.
  buyCashPack(id) {
    const row = this.cashPacks.find((r) => r.pack.id === id)
    if (!row?.available || !this.spendGems(row.pack.gems)) return 0
    const seconds = takeCashPack(this.rw, id)
    const cash = this.incomePerSec * seconds
    this.addCash(cash)
    return cash
  }

  // Бесплатные гемы идут МИМО дневного капа, как и награды вкладки 5: кап
  // 150/день [F] снят с попапа финиша и ограничивает гемы за победы.
  claimDailyGems() {
    const gems = takeDailyGems(this.rw)
    if (gems) this.addGems(gems, false)
    return gems
  }

  // Реклама магазина засчитывается в дневную задачу `Watch an ad` [F] наравне
  // с бустом, но ведёт свой счётчик: лимит 6 на класс [F] — это лимит буста.
  watchShopAd() {
    const gems = takeAdGems(this.rw)
    if (!gems) return 0
    this.addGems(gems, false)
    this.track('adWatch')
    return gems
  }

  buyRookiePass() {
    const st = this.rookiePass
    if (st.owned || !st.affordable) return false
    if (!this.spendGems(st.def.gems)) return false
    return takeRookiePass(this.rw)
  }

  // Красная точка на вкладке 6 — только по тому, что и правда можно забрать
  // бесплатно. Гореть из-за витрины, которая не продаётся, она не должна.
  get shopPending() {
    const free = this.shopFree
    return (free.dailyReady ? 1 : 0) + free.adsLeft
  }

  // --- Ссылки ------------------------------------------------------------
  // activeClass — свойство с сеттером: смена класса обязана сбросить кэш
  // свода скиллов, дерево у каждого класса своё.
  get activeClass() { return this._activeClass }
  set activeClass(id) { this._activeClass = id; this._fx = null; this._idle = null }

  get cls() { return this.classes[this.activeClass] }
  get clsDef() { return CLASS_BY_ID[this.activeClass] }
  get league() { return LEAGUES[Math.min(this.cls.league, LEAGUES.length - 1)] }
  get agg() { return aggregateClass(this.activeClass, this.cls.levels) }

  get teamName() { return this.cls.teamName || 'Your Team' }
  set teamName(v) { this.cls.teamName = String(v).slice(0, 18).trim() || 'Your Team' }
  leagueOf(classId) { return LEAGUES[Math.min(this.classes[classId].league, LEAGUES.length - 1)] }
  nextLeagueOf(classId) { return LEAGUES[this.classes[classId].league + 1] || null }

  // --- Лига и сезон ------------------------------------------------------
  get seasonTarget() { return promotionTarget() }
  // Именно seasonLength, а не seasonRaces: у класса есть поле cls.seasonRaces —
  // счётчик отъезженных, и два почти одинаковых имени рядом читались бы как одно.
  get seasonLength() { return SEASON.races }

  // Сила игрока относительно лиги — в тех же единицах, что OPPONENT_SPREAD:
  // соперник i имеет силу leaguePower * spread[i], а у игрока это off + def.
  relativePowerOf(classId) {
    const p = this.powerOf(classId)
    return (p.off + p.def) / this.leagueOf(classId).power
  }

  standingsOf(classId) {
    const cls = this.classes[classId]
    return standingsRows(cls, cls.teamName, classId, this.relativePowerOf(classId))
  }

  rankOf(classId) {
    const cls = this.classes[classId]
    return playerRank(cls, cls.teamName, classId, this.relativePowerOf(classId))
  }

  // [F] Кнопка `Advance` рядом со строкой `Current League`. Что она делает в
  // оригинале, разбор не установил (см. FINDINGS): подпись `Win the season to
  // advance` [E] говорит только о том, что повышение заслуживают сезоном.
  // У нас это «забрать повышение досрочно»: порог счёта уже взят, ждать
  // оставшиеся заезды незачем. Правило повышения при этом ОДНО и то же, что в
  // RaceRewards, — вторая формула тут означала бы два разных условия победы
  // в сезоне. Влияние на баланс мало: порог 43 очка из 60 возможных берётся
  // на 15-18-й гонке из 20, то есть досрочный клик экономит хвост сезона.
  canAdvance(classId) {
    const cls = this.classes[classId]
    return cls.unlocked
      && cls.league < LEAGUES.length - 1
      && cls.seasonScore >= SEASON.races * SEASON.promoteRatio
  }

  advanceLeague(classId) {
    if (!this.canAdvance(classId)) return false
    const cls = this.classes[classId]
    archiveSeason(cls, cls.teamName, classId, true, this.relativePowerOf(classId))
    cls.league++
    cls.season++
    cls.seasonRaces = 0
    cls.seasonScore = 0
    return true
  }

  // --- Карьерный драйвер -------------------------------------------------
  get career() { return this.cls.career }
  get careerFx() {
    if (!this._fx) this._fx = careerEffects(this.cls.career)
    return this._fx
  }
  get careerDriver() { return careerStats(this.cls.career, this.careerFx) }
  get careerPoints() { return pointsFree(this.cls.career) }
  // Дерево правится только у активного класса, но `_idle` считает ЧУЖИЕ своды:
  // сбрасываем и его, иначе после возврата в покинутый класс сумма осталась бы
  // от старой раскладки.
  invalidateCareer() { this._fx = null; this._idle = null }

  // --- Производные статы -------------------------------------------------
  // База — сумма статов пятёрки состава ПЛЮС карьерный драйвер (он выходит на
  // трассу шестым). Проценты апгрейдов и скиллов идут поверх.
  get squadStats() { return this.roster.teamStats(this.activeClass) }

  get power() { return this.powerOf(this.activeClass) }

  // Карточка классов показывает силу и шанс победы по КАЖДОМУ классу, а не
  // только по активному, — поэтому расчёт параметризован классом. Для
  // активного идём через кэш свода скиллов, для остальных считаем на месте:
  // кэш один, и держать его на шесть классов ради модалки незачем.
  powerOf(classId) {
    const cls = this.classes[classId]
    const fx = classId === this.activeClass ? this.careerFx : careerEffects(cls.career)
    const sq = this.roster.teamStats(classId)
    const cd = careerStats(cls.career, fx)
    const agg = classId === this.activeClass ? this.agg : aggregateClass(classId, cls.levels)
    // Скиллы уводят проценты в минус (Glass Cannon: −7% защиты за ранг).
    // Нижний зажим 0.05, иначе связка трейд-оффов обнуляет сторону в ноль, а
    // RaceModel берёт от статов логарифм.
    // Аутфиты (шаг 9) — проценты к силе, как апгрейды и скиллы. Кэшируются
    // отдельно: свод не зависит от класса, но дёргается из powerOf каждый кадр.
    const of = this.outfitFx
    const offMult = Math.max(0.05, 1 + (agg.offensePct + fx.teamOffPct + of.offPct) / 100)
    const defMult = Math.max(0.05, 1 + (agg.defensePct + fx.teamDefPct + of.defPct) / 100)
    // Гир (шаг 6) и гараж (шаг 7) — слагаемые к СЫРЫМ статам, до процентов
    // апгрейдов: в оригинале боевые слоты подписаны «+2% Offense» [F], то есть
    // процент берётся от всей силы команды, включая снаряжение. Множителем
    // поверх процентов они бы с апгрейдами не перемножались, и две оси, которые
    // должны усиливать друг друга, складывались бы линейно.
    const gr = this.gear.statsOf(classId)
    const ga = garageStats(this.garage, this.parts, classId)
    const def = (sq.def + cd.def + gr.def + ga.def) * defMult
    // Counter Force [F]: часть обороны засчитывается и в атакующем заезде, при
    // этом из обороны НЕ вычитается — это контратака, а не размен.
    const counter = Math.max(0, Math.min(100, fx.defToOff)) / 100
    return {
      off: (sq.off + cd.off + gr.off + ga.off) * offMult + def * counter,
      def,
    }
  }

  // [F] На карточке класса рядом со счётчиком фанатов стоит «🍀 5%». Что это
  // за число в оригинале, разбор не установил (см. FINDINGS). У нас это
  // честная вероятность победы в своей лиге — тот же `placeDist`, по которому
  // решает балансный бот, а не декоративный процент.
  winChanceOf(classId) {
    const p = this.powerOf(classId)
    return placeDistOf(p.off, p.def, this.leagueOf(classId).power)
  }

  get offense() { return this.power.off }
  get defense() { return this.power.def }
  get teamPower() { const p = this.power; return p.off + p.def }

  // Доход — ЭТО фанаты (см. ECONOMY): на кадрах двух игр одного движка
  // "Income /s" совпадает с фанатами, делёнными на 1188, а свежий класс при
  // любом прогрессе игрока показывает $1/с. Поэтому здесь нет ни множителя
  // лиги, ни множителя класса — они переехали на приток фанатов в RaceRewards.
  get fanIncome() { return this.cls.fans / ECONOMY.fansPerDollar }

  // Множитель фанатов к «голому» доходу — для интерфейса и оценщика: во
  // сколько раз накопленные фанаты подняли доход над стартовым полом.
  get fanMultiplier() { return Math.max(1, this.fanIncome / ECONOMY.baseIncomePerSec) }

  // Доход ОДНОГО класса, без буста. Скиллы дохода (Sponsorships, Merchandising,
  // Team Principal) — множитель, а не слагаемое: иначе к середине игры они не
  // видны. Узел оригинала «−30% Income in Monster Truck» [F] работает так же,
  // и он же объясняет, почему множитель берётся из дерева ЭТОГО класса.
  classIncome(classId) {
    const cls = this.classes[classId]
    if (!cls.unlocked) return 0
    const fx = classId === this.activeClass ? this.careerFx : careerEffects(cls.career)
    // Процент дохода от аутфитов [E] (`Team Income`) — множителем, как у
    // карьерных скиллов: слагаемое к середине игры не видно.
    const career = Math.max(0.05, 1 + (fx.incomePct + this.outfitFx.incomePct) / 100)
    return Math.max(ECONOMY.baseIncomePerSec, cls.fans / ECONOMY.fansPerDollar) * career
  }

  get boostMult() { return this.adBoostActive ? AD_BOOST.multiplier : 1 }

  // Доход АКТИВНОГО класса — то самое число из шапки [F] и база призовых.
  // Приз меряется в секундах дохода того класса, в котором едет заезд: иначе
  // свежий шестой класс раздавал бы призы по накопленному пятому.
  get activeIncomePerSec() { return this.classIncome(this.activeClass) * this.boostMult }

  // ПАРАЛЛЕЛЬНЫЙ ДОХОД. Открытые классы продолжают приносить свои фанатские
  // деньги, пока игрок катается в другом (доля — ECONOMY.idleClassShare).
  // Кэш обязателен: сумма дёргается из incomePerSec, то есть каждый кадр, а
  // careerEffects чужого класса не мемоизируется (кэш `_fx` только для
  // активного). Фанаты неактивного класса не меняются — он не едет, — поэтому
  // сумма живёт до смены класса, разблокировки или правки дерева.
  get idleIncomePerSec() {
    if (this._idle === null || this._idle === undefined) {
      let sum = 0
      for (const c of RACE_CLASSES) {
        if (c.id === this.activeClass) continue
        sum += this.classIncome(c.id)
      }
      this._idle = sum * ECONOMY.idleClassShare
    }
    return this._idle * this.boostMult
  }

  invalidateIdle() { this._idle = null }

  get unlockedCount() { return RACE_CLASSES.filter((c) => this.classes[c.id].unlocked).length }

  get incomePerSec() { return this.activeIncomePerSec + this.idleIncomePerSec }

  get adBoostActive() { return this.adBoostUntil > Date.now() }
  get adBoostLeftSec() { return Math.max(0, (this.adBoostUntil - Date.now()) / 1000) }

  // --- Действия ----------------------------------------------------------
  addCash(amount) { this.cash += amount }

  // `capped` — под дневным лимитом или нет. Лимит 150/день [F] снят с попапа
  // финиша (`Gems (47 / 150 per day)`), то есть он ограничивает гемы ЗА ПОБЕДЫ.
  // Награды вкладки 5 идут мимо него: победный кап выбивается за четверть
  // суток, и общий лимит превратил бы задачи и пасс в декорацию.
  addGems(amount, capped = true) {
    if (this.gemsDay !== todayKey()) { this.gemsDay = todayKey(); this.gemsToday = 0 }
    if (!capped) { this.gems += amount; return amount }
    const allowed = Math.max(0, Math.min(amount, GEMS.dailyCap - this.gemsToday))
    this.gemsToday += allowed
    this.gems += allowed
    return allowed
  }

  spendGems(amount) {
    if (this.gems < amount) return false
    this.gems -= amount
    this.track('gemSpend', amount)   // [F] дневная задача `Spend Gems 30/50`
    return true
  }

  addTrophies(amount) { this.trophies += amount; this.trophiesEarned += amount }

  levelOf(key) { return this.cls.levels[key] || 0 }

  priceOf(key) { return upgradePrice(getUpgrade(this.activeClass, key), this.levelOf(key)) }

  canBuy(key) {
    const def = getUpgrade(this.activeClass, key)
    if (isUpgradeLocked(def, this)) return false
    const price = this.priceOf(key)
    return def.currency === 'trophy' ? this.trophies >= price : this.cash >= price
  }

  buy(key) {
    if (!this.canBuy(key)) return false
    const def = getUpgrade(this.activeClass, key)
    const price = this.priceOf(key)
    if (def.currency === 'trophy') this.trophies -= price
    else this.cash -= price
    this.cls.levels[key] = this.levelOf(key) + 1
    return true
  }

  unlockPriceFor(classId) { return CLASS_UNLOCK_PRICES[CLASS_BY_ID[classId].index] }

  unlockClass(classId) {
    const price = this.unlockPriceFor(classId)
    if (this.classes[classId].unlocked || this.cash < price) return false
    this.cash -= price
    this.classes[classId].unlocked = true
    this.roster.ensureStarters(classId, CLASS_BY_ID[classId].index)
    // Стартовая машина класса выдаётся сразу [E: `unlock: free`]: иначе свежий
    // класс выходит на трассу без машины, и переход — главное решение игры с
    // шага 3b — начинает читаться как наказание.
    ensureStarterCar(this.garage, classId)
    this.invalidateIdle()   // открытый класс начинает капать сразу, ещё до перехода
    return true
  }

  // --- Драйверы ----------------------------------------------------------
  packPrice(packId, count) {
    const pack = PACK_BY_ID[packId]
    return count >= 10 ? pack.gems10 : pack.gems1 * count
  }

  canDraw(packId, count = 1) { return this.gems >= this.packPrice(packId, count) }

  drawPack(packId, count = 1) {
    if (!this.spendGems(this.packPrice(packId, count))) return null
    return this.roster.draw(packId, count)
  }

  // Продажа отдаёт СЕКУНДЫ текущего дохода, а не плоскую сумму: к середине
  // игры плоская цена отстала бы от экономики на порядки (та же причина, что
  // у призовых в RaceRewards).
  sellDriver(uid) {
    const d = this.roster.get(uid)
    if (!d || this.roster.inSquad(uid)) return 0
    const amount = this.incomePerSec * RARITY_BY_ID[d.rarity].sellSec
    this.roster.remove(uid)
    this.addCash(amount)
    return amount
  }

  // --- Гир драйверов (вкладка 2, шаг 6) -----------------------------------
  // Слотов состава больше пяти и они открываются [F: `STARTERS (9)`];
  // счётчик — стат `Seat Count` [E], у нас он растёт от числа открытых классов.
  get seats() { return seatCount(this.unlockedCount) }

  gearRows(classId = this.activeClass) {
    return slotRows(this.gear, classId, this.classes[classId].races || 0)
  }

  gearSlotOpen(slot, classId = this.activeClass) {
    return slotOpen(this.classes[classId].races || 0, slot)
  }

  get gearOpenSlots() { return openSlotCount(this.cls.races || 0) }

  get gearPacks() { return packRows(this.gear, this.gems) }

  gearPackPrice(packId, count) {
    const p = GEAR_PACK_BY_ID[packId]
    return count >= 10 ? p.gems10 : p.gems1 * count
  }

  // Открытие пака гира. Купон [E] тратится ВМЕСТО гемов и только на одиночное
  // открытие: купон на x10 в билде не встречается, а выдать его дешевле, чем
  // десять гемовых роллов, значило бы обойти единственный гемовый сток вкладки.
  drawGear(packId, count = 1, useCoupon = false) {
    if (useCoupon) {
      if (count !== 1 || !this.gear.spendCoupon(packId)) return null
    } else if (!this.spendGems(this.gearPackPrice(packId, count))) return null
    const out = this.gear.draw(packId, count)
    this.invalidatePower()
    return out
  }

  // Бесплатный гир за рекламу [E]. Идёт в ту же дневную задачу `Watch an ad`,
  // что буст и магазин (правило 26c), но ведёт свой счётчик.
  get gearFreeLeft() { return Math.max(0, GEAR.freeAdsPerDay - (this.rw.gear.ads || 0)) }

  watchGearAd() {
    if (this.gearFreeLeft <= 0) return null
    this.rw.gear.ads = (this.rw.gear.ads || 0) + 1
    this.track('adWatch')
    const out = this.gear.draw(GEAR.freeAdPack, 1)
    this.invalidatePower()
    return out
  }

  equipGear(slot, uid, classId = this.activeClass) {
    if (!this.gearSlotOpen(slot, classId)) return false
    const ok = this.gear.equipItem(classId, slot, uid)
    if (ok) this.invalidatePower()
    return ok
  }

  unequipGear(slot, classId = this.activeClass) {
    const ok = this.gear.unequip(classId, slot)
    if (ok) this.invalidatePower()
    return ok
  }

  upgradeGear(uid) {
    const ok = this.gear.upgrade(uid)
    if (ok) this.invalidatePower()
    return ok
  }

  // Возвращают не булево, а ЧТО случилось: плюс-ступень или осколки и сколько.
  // Считать это в UI значило бы вторую копию формулы выплаты (правило 16).
  mergeGear(targetUid, victimUid) {
    const res = this.gear.merge(targetUid, victimUid)
    if (res) this.invalidatePower()
    return res
  }

  scrapGear(uid) {
    const res = this.gear.scrap(uid)
    if (res) this.invalidatePower()
    return res
  }

  autoGear(classId = this.activeClass) {
    const races = this.classes[classId].races || 0
    const n = this.gear.autoManage(classId, (slot) => slotOpen(races, slot))
    if (n) this.invalidatePower()
    return n
  }

  // --- Гараж (шаг 7) ------------------------------------------------------
  get car() { return activeCar(this.garage, this.activeClass) }

  carsOfClass(classId = this.activeClass) { return carRows(this.garage, classId) }

  carPartRows(carId) { return slotRowsFor(this.parts, carId) }

  get partPacks() { return partPackRows(this.parts, this.gems) }

  partPackPrice(packId, count) {
    const p = PART_PACK_BY_ID[packId]
    return count >= 10 ? p.gems10 : p.gems1 * count
  }

  drawParts(packId, count = 1, useCoupon = false) {
    if (useCoupon) {
      if (count !== 1 || !this.parts.spendCoupon(packId)) return null
    } else if (!this.spendGems(this.partPackPrice(packId, count))) return null
    const out = this.parts.draw(packId, count)
    this.invalidatePower()
    return out
  }

  equipPart(carId, slot, uid) {
    const ok = this.parts.equipItem(partOwner(carId), slot, uid)
    if (ok) this.invalidatePower()
    return ok
  }

  unequipPart(carId, slot) {
    const ok = this.parts.unequip(partOwner(carId), slot)
    if (ok) this.invalidatePower()
    return ok
  }

  upgradePart(uid) {
    const ok = this.parts.upgrade(uid)
    if (ok) this.invalidatePower()
    return ok
  }

  // Покупка машины. Три типа кнопок [E]: бесплатно, за гемы, за IAP. Последняя
  // по правилу 26a показана и не продаётся — легендарная машина приходит только
  // из Lucky Draw (шаг 9).
  buyCar(carId) {
    const def = CAR_BY_ID[carId]
    if (!def) return false
    const row = this.carsOfClass(def.classId).find((r) => r.def.id === carId)
    if (!row || row.owned) return false
    if (def.unlock !== 'gems' || !this.spendGems(def.gems)) return false
    grantCar(this.garage, carId)
    selectCar(this.garage, def.classId, carId)
    this.invalidatePower()
    return true
  }

  pickCar(carId) {
    const ok = selectCar(this.garage, this.activeClass, carId)
    if (ok) this.invalidatePower()
    return ok
  }

  upgradeActiveCar() {
    const car = this.car
    if (!car) return false
    const ok = upgradeCar(this.garage, car.id, this.cash, this.incomePerSec,
      (price) => { this.cash -= price; return true })
    if (ok) this.invalidatePower()
    return ok
  }

  grantCar(carId) { this.invalidatePower(); return grantCar(this.garage, carId) }

  autoGarage() {
    const n = autoGarage(this.garage, this.parts, this.activeClass)
    if (n) this.invalidatePower()
    return n
  }

  // Косметика: цена в секундах дохода (правило 24). Силы не даёт намеренно —
  // это единственный сток, куда уходят поздние деньги, когда уровни уже не
  // влезают в кошелёк.
  paintPrice(def) { return def.price * PAINT_PRICE_SECONDS * this.incomePerSec }

  buyPaintFor(id) {
    const def = PAINTS.find((p) => p.id === id)
    if (!def || this.garage.paintsOwned.includes(id)) return false
    const price = this.paintPrice(def)
    if (this.cash < price) return false
    this.cash -= price
    return buyPaint(this.garage, id)
  }

  buyDecalFor(id) {
    const def = DECALS.find((d) => d.id === id)
    if (!def || this.garage.decalsOwned.includes(id)) return false
    const price = this.paintPrice(def)
    if (this.cash < price) return false
    this.cash -= price
    return buyDecal(this.garage, id)
  }

  setPaint(id) { if (this.garage.paintsOwned.includes(id)) this.garage.paint[this.activeClass] = id }
  setDecal(id) { if (this.garage.decalsOwned.includes(id)) this.garage.decal[this.activeClass] = id }

  get paintColor() {
    const id = this.garage.paint[this.activeClass]
    return PAINTS.find((p) => p.id === id)?.color ?? null
  }

  // Кэш статов сидит в двух мешках и в Roster, а powerOf зовётся каждый кадр —
  // один метод на все сбросы, иначе забытая строка даёт силу, которая не
  // меняется после покупки (и ловится только прогоном).
  invalidatePower() {
    this.gear.touch()
    this.parts.touch()
    this.roster.touch()
  }

  // Свод аутфитов. Кэш по той же причине, что careerFx: он в горячем пути
  // (powerOf и classIncome), а меняется только покупкой или сменой аутфита.
  get outfitFx() {
    if (!this._outfit) this._outfit = outfitEffects(this.extras)
    return this._outfit
  }

  invalidateOutfits() { this._outfit = null; this._idle = null; this.invalidatePower() }

  // --- Соревнования (шаг 8) -----------------------------------------------
  // Единая точка входа, как `rw` у наград: сброс суток арены и клуба
  // проверяется при КАЖДОМ обращении. Сутки арены кончаются в 05:00 UTC, то
  // есть могут наступить при открытом экране.
  get comp() {
    const c = this.compete
    const due = arenaRollover(c.arena)
    if (due) {
      // [E] «Rewards are based on your final rank and sent via in-game mail».
      this.mail(`Arena Rank ${due.rank}`,
        `Champions Arena daily rewards for rank ${due.rank}.`, due.rewards[0])
      for (const extra of due.rewards.slice(1)) this.mail('Arena Rewards', 'Extra rank reward.', extra)
    }
    if (clubRollover(c.club)) { /* вызовы суток обнулены */ }
    if (c.club.clash) accrueClash(c.club)
    const done = settleClash(c.club)
    if (done) {
      this.mail(done.won ? 'Club Clash — Victory!' : 'Club Clash — Defeat',
        `Your Club scored ${done.myScore} against ${done.foeScore}.`, done.rewards[0])
      for (const extra of done.rewards.slice(1)) this.mail('Club Clash Rewards', 'Extra reward.', extra)
    }
    return c
  }

  get arena() { return this.comp.arena }
  get arenaLeagueDef() { return arenaLeague(this.arena) }
  get arenaNextLeagueDef() { return arenaNextLeague(this.arena) }
  get arenaRankNow() { return arenaRank(this.arena) }
  get arenaResetSec() { return arenaResetInSec() }

  get arenaOpponents() {
    const p = this.power
    return arenaOpponents(this.arena, p.off + p.def, rivalNames('arena', this.arena.league, this.arena.pick))
  }

  arenaChance(opp) {
    const p = this.power
    return arenaWinChance(p.off, p.def, opp.power)
  }

  arenaRankingRows() { return arenaRankings(this.arena, this.teamName) }

  refreshArena() { return arenaRefresh(this.arena) }

  // Бой арены. Сид берём из Roster: ГПСЧ арены не обязан быть общим с гонкой,
  // но обязан быть СИДИРОВАННЫМ — иначе балансный прогон не воспроизводится
  // (правило 3 по смыслу: Math.random в модели убивает повторяемость).
  playArena(index) {
    const opp = this.arenaOpponents[index]
    if (!opp) return null
    const p = this.power
    const rng = this.roster.nextRng()
    const res = arenaMatch(this.arena, p.off, p.def, opp, () => rng.float(0, 1))
    return res ? { ...res, opponent: opp } : null
  }

  // --- Турниры и кубок ----------------------------------------------------
  // Ключ периода решает, когда сетка сбрасывается: у турнира лиги это сезон
  // класса, у недельного — номер недели, у кубка — ступень. Один и тот же код
  // сетки (BracketSystem) на три повода.
  bracketKeyOf(kind) {
    if (kind === 'league') return `${this.activeClass}-${this.cls.season}`
    if (kind === 'weekly') return `w${Math.floor(Date.now() / (7 * 86400000))}`
    // Попытка в ключе: см. cupFailed — иначе после вылета ступень кубка
    // мертва до конца игры.
    return `cup-${this.compete.cup.tier}.${this.compete.cup.attempt ?? 0}-${this.activeClass}`
  }

  bracketOf(kind) {
    if (kind === 'cup') return this.compete.cup.bracket
    return this.compete[kind]
  }

  // [E] У недельного турнира класс РОТИРУЕТСЯ: «Each tournament features one
  // sport, which rotates each week». Берём по номеру недели, то есть участвовать
  // можно не всегда тем классом, которым хочется, — в этом и смысл ротации.
  get weeklyClass() {
    const week = Math.floor(Date.now() / (7 * 86400000))
    return RACE_CLASSES[week % RACE_CLASSES.length]
  }

  bracketInfo(kind) {
    const b = this.bracketOf(kind)
    const key = this.bracketKeyOf(kind)
    const fresh = b.key !== key
    const field = bracketField(this.#keyNum(key), this.teamPower, rivalNames(kind, 0, key))
    return {
      bracket: b, key, fresh,
      registered: !fresh && b.registered,
      round: b.round,
      roundName: roundName(b.round),
      opponent: roundOpponent(field, b.round),
      racesLeft: Math.max(0, b.raceAt - (this.cls.races || 0)),
      ready: !fresh && bracketReady(b, this.cls.races || 0),
      place: fresh ? null : b.place,
      log: fresh ? [] : b.log,
      // Недельный турнир требует, чтобы активным был класс недели [E].
      blocked: kind === 'weekly' && WEEKLY.registerNeeded
        && this.weeklyClass.id !== this.activeClass ? this.weeklyClass.name : null,
      cupBlocked: kind === 'cup' && !cupTierOpen(this.compete.cup, this.cls.league)
        ? CUP.tierLeague[this.compete.cup.tier] : null,
    }
  }

  #keyNum(key) {
    let h = 0x811c9dc5
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
    return h >>> 0
  }

  // Регистрация [E] `Registered` / `Not registered` / `You are already
  // registered`. Два отказа содержательные: недельный турнир идёт классом
  // недели, а ступень кубка открывается лигой трассы.
  registerBracketFor(kind) {
    const info = this.bracketInfo(kind)
    if (info.blocked) return false
    if (kind === 'cup' && info.cupBlocked !== null) return false
    // Длина раунда у кубка своя: его период — ступень, а не сезон (см. шапку
    // BRACKET.racesPerRound).
    const perRound = kind === 'cup' ? CUP.racesPerRound : BRACKET.racesPerRound
    return registerBracket(this.bracketOf(kind), info.key, this.cls.races || 0, perRound)
  }

  // Шаг сетки. Зовётся из RaceRewards (правило 7): награду турнира раздаёт тот
  // же код, что и награду за финиш, иначе стенд играл бы в игру без турниров.
  tickBrackets() {
    const out = []
    for (const kind of ['league', 'weekly', 'cup']) {
      const info = this.bracketInfo(kind)
      if (!info.ready) continue
      const b = this.bracketOf(kind)
      const field = bracketField(this.#keyNum(info.key), this.teamPower, rivalNames(kind, 0, info.key))
      const p = this.power
      const rng = this.roster.nextRng()
      const res = advanceBracket(b, {
        off: p.off, def: p.def, field, raceNow: this.cls.races || 0,
        rnd: () => rng.float(0, 1),
      })
      if (!res) continue
      out.push({ kind, ...res })
      if (res.place !== null) {
        const rewards = rewardsForPlace(res.place, this.cls.league)
        const title = kind === 'cup' ? cupTierName(this.compete.cup, this.clsDef.name)
          : kind === 'weekly' ? 'Weekly Tournament' : 'Tournament'
        this.mail(`${title} — ${res.place === 1 ? 'Champion!' : `Place ${res.place}`}`,
          `Your final placement: ${res.place}.`, rewards[0])
        for (const extra of rewards.slice(1)) this.mail(`${title} Rewards`, 'Extra reward.', extra)
        // Кубок за первое место отдаёт ПОСТОЯННУЮ рамку [E] и открывает
        // следующую ступень — валюты у него нет вовсе.
        if (kind === 'cup') {
          if (res.place === 1) {
            const frame = cupTaken(this.compete.cup, this.clsDef.name)
            this.mail(frame, 'A permanent trophy for conquering the cup.', null)
          } else cupFailed(this.compete.cup)
        }
      }
    }
    return out
  }

  // --- Клубы --------------------------------------------------------------
  get club() { return this.comp.club }
  get clubRows() { return clubList(this.teamPower) }
  get clubChallengesLeft() { return challengesLeft(this.club) }
  get clashOn() { return clashActive(this.club) }
  get clashPredicted() { return predictedRewards(this.club) }

  joinClub(index) {
    const row = this.clubRows[index]
    if (!row?.canJoin) return false
    this.club.joined = index
    this.club.own = false
    this.club.name = row.name
    return true
  }

  // [F] Единственное число клубов из оригинала: создание — 150 гемов.
  createClub(name) {
    if (this.club.joined !== null || !this.spendGems(CLUB.createGems)) return false
    this.club.joined = -1
    this.club.own = true
    this.club.name = String(name || 'My Club').slice(0, 18)
    return true
  }

  leaveClub() {
    this.club.joined = null
    this.club.own = false
    this.club.name = null
    this.club.clash = null
    return true
  }

  startClash() {
    if (this.club.joined === null || this.clashOn) return false
    startClash(this.club)
    return true
  }

  capturePosition(index) {
    const p = this.power
    const rng = this.roster.nextRng()
    return capture(this.club, index, {
      off: p.off, def: p.def, power: this.teamPower, rnd: () => rng.float(0, 1),
    })
  }

  // --- Доборы шага 9 ------------------------------------------------------
  get ex() {
    if (luckyRollover(this.extras.lucky)) { /* сетка призов обновилась */ }
    if (collectionRollover(this.collection)) { /* сезон коллекций сменился */ }
    return this.extras
  }

  get outfits() { return outfitRows(this.ex) }
  equipOutfitId(id) {
    const ok = equipOutfit(this.extras, id)
    if (ok) this.invalidateOutfits()
    return ok
  }

  // Unique Cores [E]: ядра И жертва. Жертва — только из резерва, как при merge
  // («Drivers in Squad cannot be used for upgrades» [E]).
  canCoreUp(uid) { return canCore(this.ex, this.roster.get(uid)) }

  coreUp(uid, victimUid) {
    const d = this.roster.get(uid)
    const v = this.roster.get(victimUid)
    if (!d || !v || this.roster.inSquad(victimUid)) return false
    if (!applyCore(this.extras, d, { off: v.off, def: v.def })) return false
    this.roster.remove(victimUid)
    this.invalidatePower()
    return true
  }

  // --- Lucky Draw ---------------------------------------------------------
  get luckyRowsNow() { return luckyRows(this.ex.lucky) }
  get luckyLeftNow() { return luckyLeft(this.ex.lucky) }
  get luckyPrice() { return LUCKY.drawGems }

  playLucky() {
    if (this.luckyLeftNow <= 0) return null
    if (!this.spendGems(LUCKY.drawGems)) return null
    const rng = this.roster.nextRng()
    const pick = luckyDraw(this.extras.lucky, () => rng.float(0, 1))
    if (!pick) return null
    return { ...pick, text: this.grant(pick.prize) }
  }

  // --- Коллекции ----------------------------------------------------------
  // Заезды копят пак коллекции. Зовётся из RaceRewards (правило 7).
  trackCollection() { return trackCollectionRace(this.collection) }

  get albums() { collectionRollover(this.collection); return albumRows(this.collection) }
  get collectionState() { collectionRollover(this.collection); return this.collection }
  get starShop() { return COLLECTION.starShop }

  openCollectionPack() {
    const rng = this.roster.nextRng()
    return openPack(this.collection, COLLECTION.starShop[0].cards, () => rng.float(0, 1))
  }

  buyStarPackFor(id) { return buyStarPack(this.collection, id) }
  useWildCard(album, card, golden = false) { return useWild(this.collection, album, card, golden) }

  claimAlbumReward(index) {
    const rewards = claimAlbum(this.collection, index)
    return (rewards ?? []).map((r) => this.grant(r)).filter(Boolean)
  }

  claimUltimateReward() {
    const rewards = claimUltimate(this.collection)
    return (rewards ?? []).map((r) => this.grant(r)).filter(Boolean)
  }

  // --- Коды и косметика ---------------------------------------------------
  redeemGiftCode(code) {
    const res = redeemCode(this.ex, code)
    if (!res.ok) return res
    return { ok: true, texts: res.rewards.map((r) => this.grant(r)).filter(Boolean) }
  }

  get vanityStats() {
    let races = 0
    let wins = 0
    let league = 0
    for (const c of RACE_CLASSES) {
      const cls = this.classes[c.id]
      races += cls.races || 0
      wins += cls.seasonWins || 0
      league = Math.max(league, cls.league)
    }
    return { races, wins, league, albums: this.collection.claimed.length }
  }

  get avatars() { return avatarRows(this.ex, this.vanityStats) }
  pickAvatar(id) { return setAvatar(this.extras, id, this.vanityStats) }
  get avatarIcon() {
    return this.avatars.find((a) => a.active)?.def.icon ?? '🧑‍✈️'
  }
  grantFrame(id) { return addFrame(this.extras, id) }
  pickFrame(id) { return setFrame(this.extras, id) }

  // --- Карьера -----------------------------------------------------------
  gainCareerXp(amount) { return addCareerXp(this.cls.career, amount) }

  spendSkill(skillId) {
    if (!spendPoint(this.cls.career, skillId)) return false
    this.invalidateCareer()
    return true
  }

  // «You can reset your Skills at any time for Gems» [F], цена наша.
  canResetSkills() {
    return pointsSpent(this.cls.career) > 0 && this.gems >= CAREER.resetGems
  }

  resetCareerSkills() {
    if (!this.canResetSkills()) return 0
    this.spendGems(CAREER.resetGems)
    const back = resetSkills(this.cls.career)
    this.invalidateCareer()
    return back
  }

  activateAdBoost() {
    if (this.cls.adBoostsUsed >= AD_BOOST.maxPerClass) return false
    this.cls.adBoostsUsed++
    this.track('adWatch')   // [F] дневная задача `Watch an ad 1/1`
    // Буст накапливает время, а не перезапускает таймер [F].
    const from = Math.max(Date.now(), this.adBoostUntil)
    this.adBoostUntil = from + AD_BOOST.durationSec * 1000
    return true
  }

  // Idle-доход за время отсутствия, с капом по часам.
  // [X] попап офлайн-дохода в оригинале публично не показан — кап наш.
  claimOffline() {
    const seconds = Math.max(0, (Date.now() - this.lastSeen) / 1000)
    const capped = Math.min(seconds, ECONOMY.offlineCapHours * 3600)
    if (capped < 30) return null
    const amount = this.incomePerSec * capped
    this.addCash(amount)
    this.lastSeen = Date.now()
    return { seconds: capped, amount, capped: seconds > capped }
  }

  save() {
    SaveSystem.save({
      cash: this.cash, gems: this.gems, trophies: this.trophies,
      trophiesEarned: this.trophiesEarned,
      activeClass: this.activeClass, gemsDay: this.gemsDay, gemsToday: this.gemsToday,
      classes: this.classes, roster: this.roster.toJSON(), rewards: this.rewards,
      gear: this.gear.toJSON(),
      // Мешок частей лежит ВНУТРИ гаража: у него один и тот же срок жизни с
      // машинами, и две отдельные ветки сейва рассинхронизировались бы при
      // откате (предмет надет на машину, которой в сейве нет).
      garage: { ...this.garage, parts: this.parts.toJSON() },
      compete: this.compete, extras: this.extras, collection: this.collection,
      lastSeen: Date.now(),
    })
  }
}
