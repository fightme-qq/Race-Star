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
    const offMult = Math.max(0.05, 1 + (agg.offensePct + fx.teamOffPct) / 100)
    const defMult = Math.max(0.05, 1 + (agg.defensePct + fx.teamDefPct) / 100)
    const def = (sq.def + cd.def) * defMult
    // Counter Force [F]: часть обороны засчитывается и в атакующем заезде, при
    // этом из обороны НЕ вычитается — это контратака, а не размен.
    const counter = Math.max(0, Math.min(100, fx.defToOff)) / 100
    return {
      off: (sq.off + cd.off) * offMult + def * counter,
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
    const career = Math.max(0.05, 1 + fx.incomePct / 100)
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
      lastSeen: Date.now(),
    })
  }
}
