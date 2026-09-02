import { RACE_CLASSES, CLASS_BY_ID, getUpgrade } from '../config/classes.js'
import { ECONOMY, LEAGUES, GEMS, CLASS_UNLOCK_PRICES, AD_BOOST } from '../config/balance.js'
import { PACK_BY_ID, RARITY_BY_ID } from '../config/drivers.js'
import { CAREER } from '../config/career.js'
import { aggregateClass, upgradePrice, isUpgradeLocked } from './UpgradeSystem.js'
import { Roster } from './Roster.js'
import { placeDistOf } from './RaceModel.js'
import { SaveSystem } from './SaveSystem.js'
import {
  freshCareer, careerEffects, careerStats, addCareerXp,
  spendPoint, resetSkills, pointsFree, pointsSpent,
} from './CareerSystem.js'

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
    this.lastSeen = saved?.lastSeen ?? Date.now()
  }

  // --- Ссылки ------------------------------------------------------------
  // activeClass — свойство с сеттером: смена класса обязана сбросить кэш
  // свода скиллов, дерево у каждого класса своё.
  get activeClass() { return this._activeClass }
  set activeClass(id) { this._activeClass = id; this._fx = null }

  get cls() { return this.classes[this.activeClass] }
  get clsDef() { return CLASS_BY_ID[this.activeClass] }
  get league() { return LEAGUES[Math.min(this.cls.league, LEAGUES.length - 1)] }
  get agg() { return aggregateClass(this.activeClass, this.cls.levels) }

  get teamName() { return this.cls.teamName || 'Your Team' }
  set teamName(v) { this.cls.teamName = String(v).slice(0, 18).trim() || 'Your Team' }
  leagueOf(classId) { return LEAGUES[Math.min(this.classes[classId].league, LEAGUES.length - 1)] }

  // --- Карьерный драйвер -------------------------------------------------
  get career() { return this.cls.career }
  get careerFx() {
    if (!this._fx) this._fx = careerEffects(this.cls.career)
    return this._fx
  }
  get careerDriver() { return careerStats(this.cls.career, this.careerFx) }
  get careerPoints() { return pointsFree(this.cls.career) }
  invalidateCareer() { this._fx = null }

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

  // Три множителя дохода, каждый со своей формой роста — см. ECONOMY.
  get fanMultiplier() { return 1 + this.cls.fans / ECONOMY.fansPerFanBonus }
  get leagueMultiplier() { return Math.pow(ECONOMY.leagueIncomeMult, this.cls.league) }
  get classMultiplier() { return Math.pow(ECONOMY.classIncomeMult, this.clsDef.index) }

  get incomePerSec() {
    const base = ECONOMY.baseIncomePerSec + this.agg.incomePerSec
    const boost = this.adBoostActive ? AD_BOOST.multiplier : 1
    // Скиллы дохода (Sponsorships, Merchandising, Team Principal) — ещё один
    // множитель, а не слагаемое: иначе к середине игры они не видны.
    const career = Math.max(0.05, 1 + this.careerFx.incomePct / 100)
    return base * this.fanMultiplier * this.leagueMultiplier * this.classMultiplier * boost * career
  }

  get adBoostActive() { return this.adBoostUntil > Date.now() }
  get adBoostLeftSec() { return Math.max(0, (this.adBoostUntil - Date.now()) / 1000) }

  // --- Действия ----------------------------------------------------------
  addCash(amount) { this.cash += amount }

  addGems(amount) {
    if (this.gemsDay !== todayKey()) { this.gemsDay = todayKey(); this.gemsToday = 0 }
    const allowed = Math.max(0, Math.min(amount, GEMS.dailyCap - this.gemsToday))
    this.gemsToday += allowed
    this.gems += allowed
    return allowed
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
    return true
  }

  // --- Драйверы ----------------------------------------------------------
  packPrice(packId, count) {
    const pack = PACK_BY_ID[packId]
    return count >= 10 ? pack.gems10 : pack.gems1 * count
  }

  canDraw(packId, count = 1) { return this.gems >= this.packPrice(packId, count) }

  drawPack(packId, count = 1) {
    if (!this.canDraw(packId, count)) return null
    this.gems -= this.packPrice(packId, count)
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
    this.gems -= CAREER.resetGems
    const back = resetSkills(this.cls.career)
    this.invalidateCareer()
    return back
  }

  activateAdBoost() {
    if (this.cls.adBoostsUsed >= AD_BOOST.maxPerClass) return false
    this.cls.adBoostsUsed++
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
      classes: this.classes, roster: this.roster.toJSON(), lastSeen: Date.now(),
    })
  }
}
