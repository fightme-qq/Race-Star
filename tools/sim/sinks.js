// Гемовый кошелёк питает ДВА стока: паки «деньги за гемы» (шаг 5) и гачу
// драйверов (шаг 2). Здесь — способ прогнать игру с одним из них выключенным.
//
// Зачем это отдельный файл, а не проверка внутри перебора. Шаг 5 сдавался с
// требованием на ДОЛЮ гемов (`SHOP_SHARE`), и оно оказалось не той величиной:
//   - бот не может выбрать долю правильно, потому что не умеет оценить гачу
//     (заход из десяти роллов чаще всего не меняет состав вовсе — он копит
//     pity и дубликаты, которые платят потом, при слиянии);
//   - сама доля ничего не гарантирует: 50/50 бывает и когда обе траты нужны, и
//     когда одна из них — чистый убыток, который бот несёт по порядку вызова.
// Замер на 300ч при курсе 1.0 показал ровно второе: «только гача» $25.8B
// против $23.3B у смешанной игры, то есть магазин в сданном виде ОТНИМАЛ.
//
// Правильная проверка — та же, что уже стоит на политиках закупки и на планах
// перехода: нужны ли обе траты. Ни один сток в одиночку не должен обыгрывать
// смешанную игру.
import { CASH_PACKS } from '../../src/config/shop.js'
import { PACKS } from '../../src/config/drivers.js'
import { GEAR_PACKS, GEAR } from '../../src/config/gear.js'
import { PART_PACKS, CARS } from '../../src/config/garage.js'
import { LUCKY } from '../../src/config/extras.js'

// Конфиги — обычные объекты, правим на месте и возвращаем обратно (тот же
// приём, что в applyTune). Цену гачи задираем вместо удаления паков: так
// пропадает покупка, а не сам объект, и Roster не спотыкается об отсутствие id.
const OFF = 1e12

export function withoutShop(fn) {
  const save = CASH_PACKS.map((p) => p.perDay)
  CASH_PACKS.forEach((p) => { p.perDay = 0 })
  try { return fn() } finally { CASH_PACKS.forEach((p, i) => { p.perDay = save[i] }) }
}

export function withoutGacha(fn) {
  const save = PACKS.map((p) => [p.gems1, p.gems10])
  PACKS.forEach((p) => { p.gems1 = OFF; p.gems10 = OFF * 10 })
  try { return fn() } finally {
    PACKS.forEach((p, i) => { p.gems1 = save[i][0]; p.gems10 = save[i][1] })
  }
}

// Шаги 6-7 добавили в тот же кошелёк ещё два стока: паки гира и части машины.
// Конструкция та же, а риск выше — стоков стало четыре, и «ни один не лишний»
// перестаёт выполняться само собой. Выключаем тем же приёмом: цена в недостижимо
// много гемов, а не удаление пака (Roster и GearBag ищут по id).
export function withoutGear(fn) {
  const save = GEAR_PACKS.map((p) => [p.gems1, p.gems10])
  const ads = GEAR.freeAdsPerDay
  GEAR_PACKS.forEach((p) => { p.gems1 = OFF; p.gems10 = OFF * 10 })
  // Бесплатный гир по рекламе гемов не стоит: оставить его включённым значило
  // бы мерить «магазин без гемовых паков», а не «игру без гира».
  GEAR.freeAdsPerDay = 0
  try { return fn() } finally {
    GEAR_PACKS.forEach((p, i) => { p.gems1 = save[i][0]; p.gems10 = save[i][1] })
    GEAR.freeAdsPerDay = ads
  }
}

export function withoutGarage(fn) {
  const save = PART_PACKS.map((p) => [p.gems1, p.gems10])
  const cars = CARS.map((c) => c.gems)
  PART_PACKS.forEach((p) => { p.gems1 = OFF; p.gems10 = OFF * 10 })
  // Машины за гемы — тоже гемовый сток, и он крупнее частей: выключать надо
  // оба, иначе «без гаража» всё равно покупает машины.
  CARS.forEach((c) => { if (c.unlock === 'gems') c.gems = OFF })
  try { return fn() } finally {
    PART_PACKS.forEach((p, i) => { p.gems1 = save[i][0]; p.gems10 = save[i][1] })
    CARS.forEach((c, i) => { c.gems = cars[i] })
  }
}

// Lucky Draw (шаг 9) — четвёртый гемовый сток. Выключается ценой, как и
// остальные: сетку удалять нельзя, её номера лежат в сейве.
export function withoutLucky(fn) {
  const save = LUCKY.drawGems
  LUCKY.drawGems = OFF
  try { return fn() } finally { LUCKY.drawGems = save }
}
