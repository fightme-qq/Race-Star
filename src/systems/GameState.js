import { RACE_CLASSES, CLASS_BY_ID, getUpgrade } from '../config/classes.js'
import { STATS, ECONOMY, LEAGUES, GEMS, CLASS_UNLOCK_PRICES, AD_BOOST } from '../config/balance.js'
import { aggregateClass, upgradePrice, isUpgradeLocked } from './UpgradeSystem.js'
import { SaveSystem } from './SaveSystem.js'

const todayKey = () => new Date().toISOString().slice(0, 10)

const freshClass = (index) => ({
  unlocked: index === 0,
  levels: {},
  fans: 0,
  league: 0,
  season: 1,
  seasonScore: 0,
  seasonRaces: 0,
  adBoostsUsed: 0,
})

export class GameState {
  constructor() {
    const saved = SaveSystem.load()
    this.cash = saved?.cash ?? 0
    this.gems = saved?.gems ?? 0
    this.trophies = saved?.trophies ?? 0
    this.trophiesEarned = saved?.trophiesEarned ?? 0
    this.teamName = saved?.teamName ?? 'Your Team'
    this.activeClass = saved?.activeClass ?? 'racing'
    this.gemsDay = saved?.gemsDay ?? todayKey()
    this.gemsToday = saved?.gemsDay === todayKey() ? (saved?.gemsToday ?? 0) : 0
    this.adBoostUntil = 0
    this.classes = {}
    for (const c of RACE_CLASSES) {
      this.classes[c.id] = { ...freshClass(c.index), ...(saved?.classes?.[c.id] ?? {}) }
    }
    this.lastSeen = saved?.lastSeen ?? Date.now()
  }

  // --- Ссылки ------------------------------------------------------------
  get cls() { return this.classes[this.activeClass] }
  get clsDef() { return CLASS_BY_ID[this.activeClass] }
  get league() { return LEAGUES[Math.min(this.cls.league, LEAGUES.length - 1)] }
  get agg() { return aggregateClass(this.activeClass, this.cls.levels) }

  // --- Производные статы -------------------------------------------------
  get offense() { return STATS.baseOffense * (1 + this.agg.offensePct / 100) }
  get defense() { return STATS.baseDefense * (1 + this.agg.defensePct / 100) }
  get teamPower() { return this.offense + this.defense }

  get fanMultiplier() { return 1 + this.cls.fans / ECONOMY.fansPerFanBonus }

  get incomePerSec() {
    const base = ECONOMY.baseIncomePerSec + this.agg.incomePerSec
    const boost = this.adBoostActive ? AD_BOOST.multiplier : 1
    return base * this.fanMultiplier * boost
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
    return true
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
      trophiesEarned: this.trophiesEarned, teamName: this.teamName,
      activeClass: this.activeClass, gemsDay: this.gemsDay, gemsToday: this.gemsToday,
      classes: this.classes, lastSeen: Date.now(),
    })
  }
}
