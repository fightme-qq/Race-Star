// Политики закупки — чем игрок занимает деньги. Разные политики нужны, чтобы
// отличить «экономика не растёт» от «бот покупает не то».

import { ECONOMY, RACE } from '../../src/config/balance.js'

const buyableKeys = (state) =>
  state.clsDef.upgrades.filter((u) => u.currency === 'cash').map((u) => u.key)

// Оценка суммарного $/с: пассив + приз, размазанный по длине гонки.
// Ожидаемое место берём грубо — по отношению силы к силе лиги.
export function ratePerSec(state) {
  const idx = Math.max(0, Math.min(9, Math.round(expectedPlace(state)) - 1))
  const prizeShare = ECONOMY.placePrize[idx] * ECONOMY.prizeSeconds / RACE.durationSec
  return state.incomePerSec * (1 + prizeShare)
}

// Соперники расставлены по leaguePower * spread; считаем, скольких обгоняем.
const SPREAD = [0.72, 0.80, 0.87, 0.93, 1.0, 1.06, 1.13, 1.21, 1.32]
export function expectedPlace(state) {
  const mine = state.teamPower
  let ahead = 0
  for (const s of SPREAD) if (state.league.power * s > mine) ahead++
  return ahead + 1
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
