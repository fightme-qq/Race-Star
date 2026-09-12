import { COLLECTION, ALBUMS, CARD_RARITIES } from '../config/extras.js'
import { mulberry32 } from '../utils/rng.js'

// Коллекции (шаг 9). По попапу `Collections Overview` [E]: сезон, альбомы из
// карт, паки из игры, дубликаты в Stars, Stars в Star Shop, Wild Card
// открывает недостающую карту, альбом даёт награду, все альбомы — Ultimate.
//
// Карта хранится ОДНИМ числом — счётчиком копий, а не объектом. Альбомов
// четыре по девять карт, то есть 36 записей на сезон; объект на карту раздул бы
// сейв втрое ради полей, которые выводятся из индекса (редкость, имя, золотая).

const DAY = 86400000

export const seasonIndex = (now = Date.now()) =>
  Math.floor(now / (COLLECTION.seasonDays * DAY))

export const freshCollection = (now = Date.now()) => ({
  key: seasonIndex(now),
  season: 1,
  cards: {},          // "albumIdx:cardIdx" -> копий
  golden: {},         // то же для золотых
  stars: 0,
  wild: 0,
  goldenWild: 0,
  packs: 0,           // неоткрытых паков
  raceCount: 0,
  claimed: [],        // индексы альбомов, чья награда забрана
  ultimate: false,
})

// Какие альбомы в сезоне: четыре из двадцати пяти, по кругу от номера сезона.
// Так все имена [E] со временем появляются, а сезон остаётся проходимым.
export const seasonAlbums = (col) =>
  Array.from({ length: COLLECTION.albumsPerSeason }, (_, i) => {
    const idx = (col.key * COLLECTION.albumsPerSeason + i) % ALBUMS.length
    return { index: i, albumIdx: idx, name: ALBUMS[idx] }
  })

// Редкость карты выводится из (альбом, номер): раскладка фиксированная, то есть
// игрок видит, чего именно не хватает, и Wild Card становится осмысленным
// выбором, а не лотереей.
export function cardRarity(albumIdx, cardIdx) {
  const rnd = mulberry32(((albumIdx + 1) * 2246822519 + cardIdx * 40503) >>> 0)
  const roll = rnd()
  let acc = 0
  for (const r of CARD_RARITIES) {
    acc += COLLECTION.odds[r.id] ?? 0
    if (roll <= acc) return r
  }
  return CARD_RARITIES[0]
}

const cardKey = (a, c) => `${a}:${c}`

export const hasCard = (col, a, c, golden = false) =>
  ((golden ? col.golden : col.cards)[cardKey(a, c)] ?? 0) > 0

export function albumRows(col) {
  return seasonAlbums(col).map((al) => {
    const cards = Array.from({ length: COLLECTION.cardsPerAlbum }, (_, c) => ({
      index: c,
      rarity: cardRarity(al.albumIdx, c),
      owned: hasCard(col, al.index, c),
      golden: hasCard(col, al.index, c, true),
    }))
    const have = cards.filter((c) => c.owned).length
    return {
      ...al, cards, have, total: COLLECTION.cardsPerAlbum,
      complete: have >= COLLECTION.cardsPerAlbum,
      claimed: col.claimed.includes(al.index),
    }
  })
}

export const allComplete = (col) => albumRows(col).every((a) => a.complete)

// Выдача карты. Дубликат — в Stars [E] «Duplicate Cards are converted into
// Stars», и это не утешительный приз: Stars — единственная валюта Star Shop,
// то есть дубликаты напрямую ускоряют добор недостающих.
export function giveCard(col, rnd) {
  const albums = seasonAlbums(col)
  const al = albums[Math.floor(rnd() * albums.length)]
  const c = Math.floor(rnd() * COLLECTION.cardsPerAlbum)
  const golden = rnd() < COLLECTION.goldenChance
  const bag = golden ? col.golden : col.cards
  const key = cardKey(al.index, c)
  const dup = (bag[key] ?? 0) > 0
  bag[key] = (bag[key] ?? 0) + 1
  const rarity = cardRarity(al.albumIdx, c)
  if (dup) col.stars += (COLLECTION.dupStars[rarity.id] ?? 1) * (golden ? 2 : 1)
  return { album: al, card: c, rarity, golden, dup }
}

export function openPack(col, count, rnd) {
  if (col.packs < 1) return null
  col.packs--
  return Array.from({ length: count }, () => giveCard(col, rnd))
}

// Паки зарабатываются игрой [E]. Считаем по заездам: это единственный
// источник, гемами паки коллекций НЕ продаются (правило 26b — четвёртый
// гемовый сток сломал бы подбор шага 5).
export function trackRace(col) {
  col.raceCount++
  if (col.raceCount >= COLLECTION.packEveryRaces) {
    col.raceCount = 0
    col.packs++
    return true
  }
  return false
}

export function buyStarPack(col, id) {
  const row = COLLECTION.starShop.find((r) => r.id === id)
  if (!row || col.stars < row.stars) return null
  col.stars -= row.stars
  col.packs++
  return row
}

// Wild Card [E] «Wild Cards can unlock missing non-Golden Cards. Golden Wild
// Cards can unlock missing Golden Cards.»
export function useWild(col, albumIndex, cardIndex, golden = false) {
  const have = golden ? col.goldenWild : col.wild
  if (have < 1) return false
  if (hasCard(col, albumIndex, cardIndex, golden)) return false
  const bag = golden ? col.golden : col.cards
  bag[cardKey(albumIndex, cardIndex)] = 1
  if (golden) col.goldenWild--
  else col.wild--
  return true
}

// Сброс сезона. Незабранные награды сгорают вместе с ним — как уровни Season
// Pass (шаг 4): иначе событие перестаёт быть сроком.
export function collectionRollover(col, now = Date.now()) {
  const key = seasonIndex(now)
  if (col.key === key) return false
  Object.assign(col, freshCollection(now), { key, season: col.season + 1 })
  return true
}

export const claimAlbum = (col, index) => {
  const row = albumRows(col).find((a) => a.index === index)
  if (!row?.complete || row.claimed) return null
  col.claimed.push(index)
  return COLLECTION.albumReward
}

export const claimUltimate = (col) => {
  if (col.ultimate || !allComplete(col)) return null
  col.ultimate = true
  return COLLECTION.ultimateReward
}
