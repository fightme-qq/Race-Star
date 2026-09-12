import {
  CAR_SLOTS, CAR_SLOT_COUNT, CAR_SLOT_SIDE, PART_BY_ID, PART_INDEX,
  PART_PACK_BY_ID, PART_PACKS, PART_COUPONS, CAR_SHARD_KINDS,
  CARS, CAR_BY_ID, carsOf, CAR_STARS, CAR_UPGRADE, GARAGE, PAINTS, DECALS,
} from '../config/garage.js'
import { GearBag } from './GearBag.js'
import { PLUS_GAIN } from '../config/gear.js'

// Домен «части машины» для того же GearBag, что носит гир драйверов. Восемь
// слотов вместо десяти, свои осколки, своя короткая лестница редкостей.
export const PART_KIND = {
  slotCount: CAR_SLOT_COUNT,
  plusGain: PLUS_GAIN,
  shardGrowth: GARAGE.shardGrowth,
  statMult: () => GARAGE.statMult,
  rarityOf: (id) => PART_BY_ID[id],
  indexOf: (id) => PART_INDEX[id] ?? 0,
  sideOf: (slot) => CAR_SLOT_SIDE[slot] ?? 'off',
  packOf: (id) => PART_PACK_BY_ID[id],
  couponFor: (packId) => PART_COUPONS.find((c) => c.pack === packId) ?? null,
  freshShards: () => Object.fromEntries(CAR_SHARD_KINDS.map((s) => [s.id, 0])),
  freshCoupons: () => Object.fromEntries(PART_COUPONS.map((c) => [c.id, 0])),
}

export const newPartBag = (saved) => new GearBag(PART_KIND, saved)

// Владелец частей — МАШИНА, а не класс: [E] `Select a car first` / `This car is
// already equipped` / `Pick a car for these shards`. Это важно для баланса:
// купив новую машину, игрок не получает её частями усиленную сразу — он их
// переставляет, и переставлять есть смысл только одну машину за раз.
export const partOwner = (carId) => `car:${carId}`

export const freshGarage = () => ({
  cars: { },               // carId -> {owned, level, stars}
  active: { },             // classId -> carId
  paint: { },              // classId -> paintId
  decal: { },              // classId -> decalId
  paintsOwned: ['team'],
  decalsOwned: ['none'],
  parts: null,             // сейв GearBag частей
})

const freshCar = (owned = false) => ({ owned, level: 0, stars: 0 })

export const carState = (g, carId) => (g.cars[carId] ??= freshCar())

// Стартовая машина класса выдаётся бесплатно [E] (`unlock: free`) — иначе
// свежий класс выходит на трассу вообще без машины, и вторая ось силы читается
// как наказание за переход, а переход с шага 3b — главное решение игры.
export function ensureStarterCar(g, classId) {
  const first = carsOf(classId)[0]
  if (!first) return
  const st = carState(g, first.id)
  if (!st.owned) st.owned = true
  if (!g.active[classId]) g.active[classId] = first.id
}

export const activeCar = (g, classId) => {
  const id = g.active[classId]
  return id ? CAR_BY_ID[id] : null
}

// Сила машины БЕЗ частей. Звёзды множат, перекос (tilt) делит сумму между
// атакой и защитой: tilt +0.18 означает «на 18% больше в атаку и на столько же
// меньше в защиту», сумма при этом сохраняется.
export function carStats(g, carId) {
  const def = CAR_BY_ID[carId]
  if (!def) return { off: 0, def: 0 }
  const st = carState(g, carId)
  if (!st.owned) return { off: 0, def: 0 }
  const total = (def.base + def.perLevel * st.level)
    * (1 + st.stars * CAR_STARS.gainPerStar) * GARAGE.statMult
  return {
    off: total * (1 + def.tilt) / 2,
    def: total * (1 - def.tilt) / 2,
  }
}

// Сила машины ВМЕСТЕ с надетыми частями — то, что идёт в powerOf().
export function garageStats(g, bag, classId) {
  const car = activeCar(g, classId)
  if (!car) return { off: 0, def: 0 }
  const base = carStats(g, car.id)
  const parts = bag.statsOf(partOwner(car.id))
  return { off: base.off + parts.off, def: base.def + parts.def }
}

// Цена уровня машины в СЕКУНДАХ дохода (правило 24).
export const carUpgradeSeconds = (g, carId) => {
  const def = CAR_BY_ID[carId]
  const st = carState(g, carId)
  if (!def || st.level >= def.maxLevel) return null
  return CAR_UPGRADE.baseSeconds * Math.pow(CAR_UPGRADE.growth, st.level)
}

export function upgradeCar(g, carId, cashAvailable, incomePerSec, spend) {
  const sec = carUpgradeSeconds(g, carId)
  if (sec === null) return false
  const price = sec * incomePerSec
  if (cashAvailable < price || !spend(price)) return false
  carState(g, carId).level++
  return true
}

// Дубликат машины из Lucky Draw даёт звезду [X] (`CarStarData` [D]).
export function grantCar(g, carId) {
  const st = carState(g, carId)
  if (!st.owned) { st.owned = true; return 'new' }
  if (st.stars < CAR_STARS.max) { st.stars++; return 'star' }
  return 'max'
}

export function selectCar(g, classId, carId) {
  const def = CAR_BY_ID[carId]
  if (!def || def.classId !== classId || !carState(g, carId).owned) return false
  g.active[classId] = carId
  return true
}

// Сводка по машинам класса для UI.
export const carRows = (g, classId) => carsOf(classId).map((def) => {
  const st = carState(g, def.id)
  return {
    def, st, owned: st.owned, active: g.active[classId] === def.id,
    stats: carStats(g, def.id),
    nextSeconds: carUpgradeSeconds(g, def.id),
  }
})

export const slotRowsFor = (bag, carId) => CAR_SLOTS.map((name, slot) => {
  const uid = bag.equippedUid(partOwner(carId), slot)
  const it = uid ? bag.get(uid) : null
  return { slot, name, side: CAR_SLOT_SIDE[slot], item: it, value: it ? bag.valueOf(it) : 0, open: true }
})

export const partPackRows = (bag, gems) => PART_PACKS.map((pack) => ({
  pack, coupons: bag.couponsOf(pack.id), pityLeft: bag.pityLeft(pack.id),
  can1: gems >= pack.gems1, can10: gems >= pack.gems10,
}))

// Косметика. Цена в секундах дохода (правило 24) — см. PAINT_PRICE_SECONDS.
export const paintRows = (g) => PAINTS.map((p) => ({
  def: p, owned: g.paintsOwned.includes(p.id), active: false,
}))

export const decalRows = (g) => DECALS.map((d) => ({
  def: d, owned: g.decalsOwned.includes(d.id),
}))

export function buyPaint(g, id) {
  if (g.paintsOwned.includes(id)) return true
  g.paintsOwned.push(id)
  return true
}

export function buyDecal(g, id) {
  if (g.decalsOwned.includes(id)) return true
  g.decalsOwned.push(id)
  return true
}

// Авто-ход гаража для бота стенда и кнопки Auto: лучшая доступная машина,
// merge частей, надеть лучшее, слить осколки в самый дешёвый апгрейд надетого.
export function autoGarage(g, bag, classId) {
  const rows = carRows(g, classId).filter((r) => r.owned)
  const best = rows.sort((a, b) =>
    (b.stats.off + b.stats.def) - (a.stats.off + a.stats.def))[0]
  if (best) selectCar(g, classId, best.def.id)
  const car = activeCar(g, classId)
  if (!car) return 0
  return bag.autoManage(partOwner(car.id), () => true)
}

export { CARS, CAR_BY_ID, carsOf, CAR_SLOTS, CAR_STARS }
