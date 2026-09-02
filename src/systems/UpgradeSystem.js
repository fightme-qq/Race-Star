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

// Цена экономического слота задаётся ЯКОРЕМ — наблюдённой ценой на известном
// уровне, а не базой: у Parking и Grandstands кадра с Lv.0 нет. Так измерение
// остаётся выполненным при любом pg, который выберет перебор.
export function economyPrice(def, level) {
  return Math.round(def.anchor.price * Math.pow(def.pg, level - def.anchor.level))
}

export function upgradePrice(def, level) {
  if (def.kind === 'combat') return combatPrice(def.base, def.curve, level)
  if (def.kind === 'economy') return economyPrice(def, level)
  return def.trophyCost
}

// Текущий и следующий эффект — для строки "0% -> 10%" на карточке.
export function upgradeEffect(def, level) {
  if (def.kind === 'combat' || def.kind === 'trophy') {
    return { current: def.step * level, next: def.step * (level + 1), unit: '%' }
  }
  // Экономика: плоская прибавка плюс flat, который слот даёт уже на Lv.0
  // (Ticket Marketing на кадре показывает "+$6 -> +$9" при Lv.0, Grandstands —
  // "10 -> 15"). Поэтому нулевой уровень здесь НЕ пропускается.
  return {
    current: def.flat + def.gain * level,
    next: def.flat + def.gain * (level + 1),
    unit: def.unit,
  }
}

export function isUpgradeLocked(def, state) {
  return def.kind === 'trophy' && state.trophiesEarned < TROPHY_UNLOCK_AT
}

// Свод по классу: суммарные проценты и плоские прибавки.
export function aggregateClass(classId, levels) {
  const out = { offensePct: 0, defensePct: 0, cashPerRace: 0, cashPerWin: 0, fansPerRace: 0 }
  for (const def of CLASS_BY_ID[classId].upgrades) {
    const level = levels[def.key] || 0
    const eff = upgradeEffect(def, level).current
    if (def.kind === 'combat' || def.kind === 'trophy') {
      if (level === 0) continue
      if (def.tag === 'offense') out.offensePct += eff
      else out.defensePct += eff
    } else {
      out[def.effect] += eff
    }
  }
  return out
}
