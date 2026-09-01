import { PRICE_CURVE, TROPHY_UNLOCK_AT } from '../config/balance.js'
import { CLASS_BY_ID } from '../config/classes.js'

// Цена боевого слота: base * П (gMin + (gMax-gMin)*exp(-i/k)), i = 0..level-1.
// Форма выведена в balance.js, здесь только вычисление.
const priceCache = new Map()

export function combatPrice(base, curveId, level) {
  const cacheKey = curveId + ':' + level
  let mult = priceCache.get(cacheKey)
  if (mult === undefined) {
    const c = PRICE_CURVE[curveId]
    mult = 1
    for (let i = 0; i < level; i++) {
      mult *= c.gMin + (c.gMax - c.gMin) * Math.exp(-i / c.k)
    }
    priceCache.set(cacheKey, mult)
  }
  return Math.round(base * mult)
}

export function upgradePrice(def, level) {
  if (def.kind === 'combat') return combatPrice(def.base, def.curve, level)
  if (def.kind === 'economy') return Math.round(def.base * Math.pow(def.pg, level))
  return def.trophyCost
}

// Текущий и следующий эффект — для строки "0% -> 10%" на карточке.
export function upgradeEffect(def, level) {
  if (def.kind === 'combat' || def.kind === 'trophy') {
    return { current: def.step * level, next: def.step * (level + 1), unit: '%' }
  }
  const sum = (n) => (n === 0 ? 0 : def.gain * (Math.pow(def.gg, n) - 1) / (def.gg - 1))
  return { current: sum(level), next: sum(level + 1), unit: def.effect === 'fansPerRace' ? '' : '$' }
}

export function isUpgradeLocked(def, state) {
  return def.kind === 'trophy' && state.trophiesEarned < TROPHY_UNLOCK_AT
}

// Свод по классу: суммарные проценты и плоские прибавки.
export function aggregateClass(classId, levels) {
  const out = { offensePct: 0, defensePct: 0, incomePerSec: 0, fansPerRace: 0, winBonus: 0 }
  for (const def of CLASS_BY_ID[classId].upgrades) {
    const level = levels[def.key] || 0
    if (level === 0) continue
    const eff = upgradeEffect(def, level).current
    if (def.kind === 'combat' || def.kind === 'trophy') {
      if (def.tag === 'offense') out.offensePct += eff
      else out.defensePct += eff
    } else {
      out[def.effect] += eff
    }
  }
  return out
}
