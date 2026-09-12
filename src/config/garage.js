// Гараж и машины (`Features.Garage`, `CarData`, `CarStarData`,
// `CarUpgradeCost`, `GarageColorsUnlockService` [D]). Шаг 7.
//
// ЧЕСТНАЯ ГРАНИЦА. Гаража нет ни на одном публичном кадре — видео опубликованы
// 17.07.2026, это билд ~1.2-1.3, и в нём экрана ещё нет [F-negative]. Значит
// визуал целиком наш. Но имена и структура — НЕ выдуманные: из локализации
// билда [E] восстановлены все 24 названия машин (по 4 на класс, порядок id
// совпадает с порядком классов), 12 описаний (по 2 на класс: обычное и
// легендарное), 8 слотов частей и три вида осколков гаража.
// Числа [X] все до единого, кроме цены топовой машины $9.99 [F].

// [E] Восемь слотов частей машины, порядок из билда.
export const CAR_SLOTS = ['Engine', 'Gearbox', 'Suspension', 'Brakes',
  'Tires', 'Battery', 'Clutch', 'Exhaust']

export const CAR_SLOT_COUNT = CAR_SLOTS.length

// Сторона слота [X] — как и у гира, ровно половина на половину, чтобы набор
// сам себя не штрафовал перекосом (см. RaceModel.js).
export const CAR_SLOT_SIDE = ['off', 'off', 'def', 'def', 'off', 'off', 'def', 'def']

// [E] Осколки гаража — СВОЯ валюта, отдельная от осколков гира
// (`25 Epic Garage Shards` против `25 Epic Shards`). Это не украшение: общий
// кошелёк осколков означал бы, что две оси силы конкурируют за один ресурс, и
// игрок всегда вкладывает в ту, что дороже по курсу, — вторая ось умирает
// ровно тем способом, который шаг 5 ловил у магазина и гачи (правило 26b).
export const CAR_SHARD_KINDS = [
  { id: 'grare',      name: 'Rare Garage Shards',      color: 0x0d8ecf },
  { id: 'gepic',      name: 'Epic Garage Shards',      color: 0x8a3ff0 },
  { id: 'glegendary', name: 'Legendary Garage Shards', color: 0xf9a31b },
]

// Редкости частей машины [X]. Лестница короче, чем у гира (три ступени вместо
// пяти): слотов восемь против десяти, и пятиступенчатая лестница на обеих осях
// превращает обе вкладки в одну и ту же работу.
export const PART_RARITIES = [
  { id: 'rare',      name: 'Rare',      color: 0x0d8ecf, base: 4.0,  perLevel: 0.70, maxLevel: 15, maxPlus: 1, shard: 'grare',      shardCost: 6, dust: 5 },
  { id: 'epic',      name: 'Epic',      color: 0x8a3ff0, base: 7.5,  perLevel: 1.35, maxLevel: 22, maxPlus: 2, shard: 'gepic',      shardCost: 6, dust: 5 },
  { id: 'legendary', name: 'Legendary', color: 0xf9a31b, base: 13.0, perLevel: 2.50, maxLevel: 28, maxPlus: 3, shard: 'glegendary', shardCost: 5, dust: 4 },
]

export const PART_BY_ID = Object.fromEntries(PART_RARITIES.map((r) => [r.id, r]))
export const PART_INDEX = Object.fromEntries(PART_RARITIES.map((r, i) => [r.id, i]))

// [E] `Unrevealed Garage Gear` / `Boost Your Ride`: части приходят тем же
// способом, что гир, — паком. Цены и шансы [X].
export const PART_PACKS = [
  {
    id: 'parts', name: 'Garage Parts', color: 0x4dd0e1,
    gems1: 20, gems10: 200, pityAt: 12, pityRarity: 'epic',
    coupon: 'parts',
    odds: { rare: 0.62, epic: 0.33, legendary: 0.05 },
  },
  {
    id: 'superior', name: 'Superior Chest', color: 0xa06bff,
    gems1: 45, gems10: 450, pityAt: 10, pityRarity: 'legendary',
    coupon: 'superior',
    odds: { rare: 0.28, epic: 0.55, legendary: 0.17 },
  },
]

export const PART_PACK_BY_ID = Object.fromEntries(PART_PACKS.map((p) => [p.id, p]))

export const PART_COUPONS = [
  { id: 'parts',    name: 'Garage Parts Coupon',  pack: 'parts' },
  { id: 'superior', name: 'Superior Chest Coupon', pack: 'superior' },
]

// [E] 24 машины, по 4 на класс, в порядке id билда. Описания [E] идут парами
// на класс: первое — обычное, второе — легендарное; по ним и опознана группа.
const CAR_NAMES = {
  racing:    ['Apex Runner', 'Slipstream Ace', 'Vortex Vector', 'Grid Reaper'],
  stock:     ['Speedway Cruiser', 'Pace Breaker', 'Redline Rebel', 'Thunderstock'],
  rally:     ['Gravel Scout', 'Mud Slinger', 'Trail Howler', 'Dirt Dominator'],
  superbike: ['Road Wasp', 'Chrome Sting', 'Razor Wraith', 'Warp Wing'],
  monster:   ['Heavy Hauler', 'Big Stomper', 'Quake Maker', 'King Crusher'],
  speedster: ['Streamliner', 'Turbo Dasher', 'Mach Menace', 'Sonic Sovereign'],
}

const CAR_DESC = {
  racing:    ['A pure-bred racer built to leave the pack behind.',
    'The ultimate racing legend, engineered to dominate every track.'],
  stock:     ['Stock car muscle that bullies its way to the front.',
    'Legendary stock car thunder that owns the whole oval.'],
  rally:     ['A rally beast that grips any surface at full throttle.',
    'The rally icon that conquers dirt, ice, and asphalt alike.'],
  superbike: ['Razor-sharp handling tuned for daredevil overtakes.',
    'A legend of raw speed that redefines the racing line.'],
  monster:   ['A monster truck that crushes everything on the way to the finish.',
    'The legendary monster rig no wall or rival can stop.'],
  speedster: ['A featherweight speedster built for blistering pace.',
    'A once-in-a-generation speedster chasing pure velocity.'],
}

// [E] «Разблокировка машины: бесплатно / за гемы / за IAP (три типа кнопок)».
// Четвёртая машина каждого класса — легендарная: в оригинале топовые машины
// стоят $9.99 [F] и отдельно крутятся в Lucky Draw за гемы [F]. По правилу 26a
// долларовое у нас ПОКАЗАНО и не продаётся, поэтому единственный способ её
// получить — Lucky Draw (шаг 9).
const TIERS = [
  { key: 'start',  unlock: 'free',  gems: 0,   base: 10, perLevel: 1.6, maxLevel: 20, tilt:  0.00, legend: false },
  { key: 'mid',    unlock: 'gems',  gems: 180, base: 20, perLevel: 2.8, maxLevel: 28, tilt:  0.18, legend: false },
  { key: 'late',   unlock: 'gems',  gems: 650, base: 34, perLevel: 4.4, maxLevel: 36, tilt: -0.18, legend: false },
  { key: 'legend', unlock: 'draw',  gems: 0,   base: 58, perLevel: 7.0, maxLevel: 45, tilt:  0.00, legend: true },
]

// `tilt` [X] — перекос машины между атакой и защитой. Это единственное место
// во всей игре, где игрок ВЫБИРАЕТ расклад, не платя за него навсегда: скиллы
// карьеры с шага 4 дают перекос рангом, но сбросить их стоит 60💎, а машину
// можно просто поменять. Шаг 4 измерил, что оптимальный расклад зависит от
// того, лезешь ты в новую лигу (80% в атаку) или закрепляешься (50/50) —
// до сих пор отыграть это было нечем.
export const CARS = []
for (const [classId, names] of Object.entries(CAR_NAMES)) {
  names.forEach((name, i) => {
    const t = TIERS[i]
    CARS.push({
      id: `${classId}-${t.key}`, classId, name, tier: t.key, index: i,
      desc: CAR_DESC[classId][t.legend ? 1 : 0],
      unlock: t.unlock, gems: t.gems, legend: t.legend,
      base: t.base, perLevel: t.perLevel, maxLevel: t.maxLevel, tilt: t.tilt,
    })
  })
}

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]))
export const carsOf = (classId) => CARS.filter((c) => c.classId === classId)

// [F] Цена топовой машины в оригинале. Показываем витриной, не продаём.
export const TOP_CAR_USD = 9.99

// Звёзды машины (`CarStarData` [D], `Star level` / `Star Power` [E]). Числа
// [X]: счётчика звёзд в билде нет ни одного. Звезда приходит дубликатом из
// Lucky Draw — по той же логике, что merge драйверов.
export const CAR_STARS = { max: 5, gainPerStar: 0.12 }

// Цена уровня машины (`CarUpgradeCost` [D]) — в ДЕНЬГАХ, а не в осколках [X]:
// осколки уходят в части, и второй сток на ту же валюту сделал бы одну из двух
// трат мёртвой (правило 26b). Цена — секунды суммарного дохода, как награды и
// призы (правило 24), иначе апгрейд машины обесценивается к середине игры.
export const CAR_UPGRADE = { baseSeconds: 90, growth: 1.23 }

// ОБЩИЙ МНОЖИТЕЛЬ ВКЛАДА ГАРАЖА [X] — координата перебора, как GEAR.statMult.
export const GARAGE = { statMult: 1.0, shardGrowth: 1.15 }

// [E] `Paints` / `Decals` / `Decal Colors`. Чистая косметика: цвет машины идёт
// в CarPainter, то есть виден на трассе. Открываются деньгами [X] — это
// единственный сток в игре, который НЕ даёт силы, и он нужен именно поэтому:
// без него поздние деньги некуда девать, кроме уровней, которые уже не влезают.
export const PAINTS = [
  { id: 'team',    name: 'Team Colors', color: null,     price: 0 },
  { id: 'crimson', name: 'Crimson',     color: 0xd62839, price: 120 },
  { id: 'azure',   name: 'Azure',       color: 0x2465e4, price: 120 },
  { id: 'lime',    name: 'Lime',        color: 0x7ac943, price: 240 },
  { id: 'gold',    name: 'Solar Gold',  color: 0xf9a31b, price: 480 },
  { id: 'violet',  name: 'Violet Haze', color: 0x8a3ff0, price: 480 },
  { id: 'carbon',  name: 'Carbon',      color: 0x2b3038, price: 960 },
  { id: 'pearl',   name: 'Pearl White', color: 0xf2f5f9, price: 1800 },
]

export const DECALS = [
  { id: 'none',    name: 'None',        price: 0 },
  { id: 'stripes', name: 'Twin Stripe', price: 180 },
  { id: 'flames',  name: 'Flames',      price: 360 },
  { id: 'bolts',   name: 'Lightning',   price: 720 },
  { id: 'checker', name: 'Checker',     price: 1440 },
]

// Цена косметики — тоже в секундах дохода [X], по правилу 24.
export const PAINT_PRICE_SECONDS = 1
