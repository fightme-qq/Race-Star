import {
  RARITY_BY_ID, RARITY_INDEX, NAMES, TRAINING, STARS,
} from '../config/drivers.js'

// Чистая математика одного драйвера. Ни одного объекта сцены — этим же кодом
// считает балансный стенд (tools/sim).

// Драйвер: { uid, defId, rarity, off, def, level, xp, totalXp, stars }
//   off/def — БАЗОВЫЕ статы, выпавшие при получении. Тренировка и звёзды их
//   не переписывают: прирост считается от базы (+10%/ур. — [F]).

export const nameOf = (d) => NAMES[d.defId % NAMES.length]

export function statMultiplier(driver) {
  return (1 + TRAINING.gainPerLevel * driver.level)
    * (1 + STARS.gainPerStar * driver.stars)
}

export function effStats(driver) {
  const k = statMultiplier(driver)
  return { off: driver.off * k, def: driver.def * k }
}

export function ratingOf(driver) {
  const e = effStats(driver)
  return Math.round((e.off + e.def) / 2)
}

// Прирост, который покажет карточка: «Offense: 96 (+9.6)» — ровно как в оригинале.
export function statBonus(driver) {
  const k = statMultiplier(driver) - 1
  return { off: driver.off * k, def: driver.def * k }
}

export const xpToNext = (level) =>
  Math.round(TRAINING.xpBase * Math.pow(TRAINING.xpGrowth, level))

// Корм переносит В ТОМ ЧИСЛЕ весь свой накопленный опыт — подсказка из
// оригинала дословно: «Training a leveled driver transfers all gained
// experience to the new player!». Значит тренировка без потерь и порядок
// скармливания не важен.
export const feedXpOf = (driver) =>
  RARITY_BY_ID[driver.rarity].feedXp + driver.totalXp

export function addXp(driver, amount) {
  driver.xp += amount
  driver.totalXp += amount
  let gained = 0
  while (driver.xp >= xpToNext(driver.level)) {
    driver.xp -= xpToNext(driver.level)
    driver.level++
    gained++
  }
  return gained
}

export function rollStats(rarityId, rng) {
  const r = RARITY_BY_ID[rarityId]
  // Оба стата тянутся независимо: у Cruz Castro 96/93 — карточки не
  // симметричны, драйверы отличаются уклоном в атаку или защиту.
  return { off: rng.int(r.min, r.max), def: rng.int(r.min, r.max) }
}

export function makeDriver(uid, rarityId, rng, defId = null) {
  const stats = rollStats(rarityId, rng)
  return {
    uid, defId: defId ?? rng.int(0, NAMES.length - 1), rarity: rarityId,
    off: stats.off, def: stats.def, level: 0, xp: 0, totalXp: 0, stars: 0,
  }
}

// Выпадение из пака: обычный ролл по таблице, либо гарантия по pity.
// pity — счётчик роллов ПОДРЯД без нужной редкости; [F] 15 для PRO PACK
// (гарантия All-Star) и 13 для ALL-STAR PACK (гарантия Legend).
export function drawRarity(pack, pityCount, rng) {
  if (pityCount + 1 >= pack.pityAt) return pack.pityRarity
  let roll = rng.float(0, 1)
  const entries = Object.entries(pack.odds)
  for (const [id, chance] of entries) {
    roll -= chance
    if (roll <= 0) return id
  }
  return entries[0][0]
}

// Сбрасывает ли выпавшая редкость счётчик pity (получили то, что гарантируют).
export const resetsPity = (pack, rarityId) =>
  RARITY_INDEX[rarityId] >= RARITY_INDEX[pack.pityRarity]

export const canMerge = (a, b) =>
  a && b && a.uid !== b.uid && a.defId === b.defId && a.rarity === b.rarity
  && a.stars < STARS.max
