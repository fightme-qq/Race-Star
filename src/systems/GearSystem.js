import {
  SLOT_SETS, SLOT_COUNT, SLOT_SIDE, SLOT_UNLOCK_RACES, GEAR, GEAR_BY_ID,
  GEAR_INDEX, GEAR_PACK_BY_ID, GEAR_PACKS, COUPON_KINDS, SHARD_KINDS, PLUS_GAIN,
} from '../config/gear.js'
import { GearBag } from './GearBag.js'

// Домен «гир драйверов» для GearBag. Всё, что знает о конфиге вкладки 2, —
// здесь; сам мешок слепой (см. шапку GearBag.js).
export const GEAR_KIND = {
  slotCount: SLOT_COUNT,
  plusGain: PLUS_GAIN,
  shardGrowth: GEAR.shardGrowth,
  // Множитель читается ФУНКЦИЕЙ, а не копируется числом: перебор правит
  // GEAR.statMult на месте перед прогоном, и замороженная на импорте копия
  // молча осталась бы от первой точки (та же грабля, что с milestoneTargets).
  statMult: () => GEAR.statMult,
  rarityOf: (id) => GEAR_BY_ID[id],
  indexOf: (id) => GEAR_INDEX[id] ?? 0,
  sideOf: (slot) => SLOT_SIDE[slot] ?? 'off',
  packOf: (id) => GEAR_PACK_BY_ID[id],
  couponFor: (packId) => COUPON_KINDS.find((c) => c.pack === packId) ?? null,
  freshShards: () => Object.fromEntries(SHARD_KINDS.map((s) => [s.id, 0])),
  freshCoupons: () => Object.fromEntries(COUPON_KINDS.map((c) => [c.id, 0])),
}

export const newGearBag = (saved) => new GearBag(GEAR_KIND, saved)

// Имя слота зависит от класса [E]: шесть наборов по десять имён.
export const slotName = (classId, slot) =>
  (SLOT_SETS[classId] ?? SLOT_SETS.racing)[slot] ?? `Slot ${slot + 1}`

export const slotNames = (classId) => SLOT_SETS[classId] ?? SLOT_SETS.racing

// Открыт ли слот. Условие — заезды ИМЕННО ЭТОГО класса [E] `Play {0} races to
// unlock`: гир у класса свой, и считать общий пробег значило бы выдавать
// свежему шестому классу все десять слотов открытыми с первой секунды.
export const slotOpen = (races, slot) => races >= (SLOT_UNLOCK_RACES[slot] ?? Infinity)

export const slotNeeds = (slot) => SLOT_UNLOCK_RACES[slot] ?? 0

export const openSlotCount = (races) =>
  SLOT_UNLOCK_RACES.filter((n) => races >= n).length

// Сводка для UI: по каждому слоту имя, сторона, предмет, открытость.
export function slotRows(bag, classId, races) {
  return SLOT_SIDE.map((side, slot) => {
    const uid = bag.equippedUid(classId, slot)
    const it = uid ? bag.get(uid) : null
    return {
      slot,
      name: slotName(classId, slot),
      side,
      item: it,
      value: it ? bag.valueOf(it) : 0,
      open: slotOpen(races, slot),
      needs: slotNeeds(slot),
      // Сколько заездов ОСТАЛОСЬ: строку `Play N races to unlock` иначе нельзя
      // собрать из одной строки данных — UI пришлось бы лезть за cls.races
      // отдельно и складывать самому.
      left: Math.max(0, slotNeeds(slot) - races),
    }
  })
}

// Сколько предметов этого слота лежит в сумке — для значка «есть что надеть».
export const slotCandidates = (bag, slot) => bag.items.filter((it) => it.slot === slot)

export const packRows = (bag, gems) => GEAR_PACKS.map((pack) => ({
  pack,
  coupons: bag.couponsOf(pack.id),
  pityLeft: bag.pityLeft(pack.id),
  can1: gems >= pack.gems1,
  can10: gems >= pack.gems10,
}))
