import { CASH_PACKS, GEM_PACKS, FREE, SHOP, ROOKIE_PASS } from '../config/shop.js'

// Магазин — чистые данные и математика, без единого объекта сцены (правило 2).
// Списывает и начисляет GameState: здесь мы только решаем, что доступно и
// сколько это даёт.
//
// Дневные счётчики живут в общем ведре наград (`rw.shop`) и сбрасываются тем же
// `rollover`, что задачи и вход. Заводить магазину собственную границу суток
// было бы ошибкой: подпись «Resets in 4H» на двух соседних экранах считалась бы
// по-разному, а с переводом часов (`npm run sim:rewards`) они разъехались бы
// молча.

export const CASH_BY_ID = Object.fromEntries(CASH_PACKS.map((p) => [p.id, p]))
export const GEM_PACK_BY_ID = Object.fromEntries(GEM_PACKS.map((p) => [p.id, p]))

export const freshShop = () => ({ daily: false, ads: 0, packs: {} })

// Сколько секунд дохода отдаёт пак. Общий множитель вынесен в SHOP, чтобы
// перебор двигал курс целиком и не ломал лесенку «дороже пак — выгоднее курс».
export const packSeconds = (pack) => pack.sec * SHOP.cashRateMult

// Курс в секундах дохода за один гем — то, по чему пак сравнивается с гачей.
export const packRate = (pack) => packSeconds(pack) / pack.gems

export function cashPackRows(rw, gems) {
  return CASH_PACKS.map((pack) => {
    const bought = rw.shop.packs[pack.id] || 0
    const left = Math.max(0, pack.perDay - bought)
    return {
      pack, bought, left,
      seconds: packSeconds(pack),
      rate: packRate(pack),
      affordable: gems >= pack.gems,
      available: left > 0 && gems >= pack.gems,
    }
  })
}

// Возвращает секунды дохода к выдаче или 0. Деньги считает вызывающий: цена
// меряется в секундах, а доход знает только GameState.
export function takeCashPack(rw, id) {
  const pack = CASH_BY_ID[id]
  if (!pack) return 0
  const bought = rw.shop.packs[id] || 0
  if (bought >= pack.perDay) return 0
  rw.shop.packs[id] = bought + 1
  return packSeconds(pack)
}

// --- Бесплатное ----------------------------------------------------------
export const freeState = (rw) => ({
  dailyReady: !rw.shop.daily,
  dailyGems: FREE.dailyGems,
  adsLeft: Math.max(0, FREE.adsPerDay - rw.shop.ads),
  adsPerDay: FREE.adsPerDay,
  adGems: FREE.adGems,
})

export function takeDailyGems(rw) {
  if (rw.shop.daily) return 0
  rw.shop.daily = true
  return FREE.dailyGems
}

// Реклама магазина ведёт СВОЙ счётчик, отдельный от буста `Activate 2x`.
// Лимит 6 на класс [F] — это лимит буста; в задачу `Watch an ad` [F] засчитывается
// и то и другое, иначе дневная задача была бы выполнима 36 раз за всю игру.
export function takeAdGems(rw) {
  if (rw.shop.ads >= FREE.adsPerDay) return 0
  rw.shop.ads++
  return FREE.adGems
}

// --- Rookie Pass ---------------------------------------------------------
// Единственная позиция магазина с гемовой ценой. Покупается на ТЕКУЩИЙ сезон
// пасса: `rw.pass` целиком пересоздаётся в rollover, значит флаг сгорает вместе
// с сезоном сам — отдельного срока хранить не нужно.
export const rookiePassState = (rw, gems) => ({
  def: ROOKIE_PASS,
  owned: rw.pass.premium,
  affordable: gems >= ROOKIE_PASS.gems,
})

export function takeRookiePass(rw) {
  if (rw.pass.premium) return false
  rw.pass.premium = true
  return true
}
