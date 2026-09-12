// Гир драйверов (`SportTeamGear` [D]). Вкладка 2 нижнего меню.
//
// ЧЕСТНАЯ ГРАНИЦА ИСТОЧНИКОВ. Этой вкладки нет НИ НА ОДНОМ из 42 публичных
// кадров (проверено, см. teardown/ref/index.json) — значит ни одного числа
// оригинала здесь быть не может. Зато слой [E] (локализация билда) оказался
// богаче слоя кадров: из него восстановлены названия всех слотов, лестница
// редкостей, состав паков и механика купонов. Поэтому разметка такая:
//   [E] — строка/структура взята из локализации билда дословно;
//   [X] — наше число, в оригинале не наблюдалось.
// Ни одного [F] в этом файле нет и быть не может.

// [E] Шесть наборов по РОВНО 10 слотов — по одному набору на класс
// (последовательные блоки id в билде). Порядок классов тот же, что в
// config/classes.js. Седьмой набор (идентичный набору Rally) лежит в более
// позднем блоке id и относится к событийному Go-Kart — у нас его нет.
export const SLOT_SETS = {
  racing: ['Balaclava', 'Wristband', 'Driving Boots', 'Racing Suit', 'Base Layer',
    'Arm Sleeve', 'Knee Pads', 'Cooling Sleeve', 'Leg Sleeve', 'Mouthguard'],
  stock: ['Balaclava', 'Team Armband', 'Driving Boots', 'Racing Suit', 'Base Layer',
    'Arm Sleeve', 'Knee Guards', 'Wristband', 'Beanie', 'Neck Warmer'],
  rally: ['Helmet', 'Racing Gloves', 'Driving Boots', 'Racing Suit', 'Racing Trousers',
    'Race Harness', 'Knee Guard', 'Elbow Guards', 'Neck Guard', 'Mouthguard'],
  superbike: ['Helmet', 'Racing Gloves', 'Arm Sleeve', 'Racing Suit', 'Racing Trousers',
    'Shoulder Pads', 'Elbow Pad', 'Wristband', 'Back Plate', 'Chest Protector'],
  monster: ['Team Cap', 'Racing Gloves', 'Driving Boots', 'Racing Suit', 'Racing Trousers',
    'Arm Sleeve', 'Pit Gloves', 'Wristband', 'Steering Wheel', 'Base Layer'],
  speedster: ['Balaclava', 'Finger Tape', 'Driving Boots', 'Racing Suit', 'Base Layer',
    'Arm Sleeve', 'Elbow Sleeve', 'Wristband', 'Sweatband', 'Knee Pads'],
}

export const SLOT_COUNT = 10

// Сторона, в которую играет слот [X]. В оригинале есть фильтр `By Type` [E],
// то есть тип у слота ЕСТЬ, но какой у какого — неизвестно. Раскладываем
// поровну: 5 атакующих, 5 защитных. Ровность тут не косметика — с шага 4 ядра
// перекос стоит очков сезона, и набор, который тянет только в одну сторону,
// сам бы себя штрафовал (см. RaceModel.js).
export const SLOT_SIDE = ['off', 'def', 'def', 'off', 'def', 'off', 'def', 'off', 'off', 'def']

// [E] Слоты открываются: строка `Slot not available`, а шаблоны условий в
// билде только такие: `Play {0} races to unlock`, `Win {0} race to unlock`,
// `Own {0} teams to unlock`. Берём первый — он не зависит ни от силы, ни от
// удачи, то есть слот нельзя «не открыть». Пороги [X], считаются по заездам
// ИМЕННО ЭТОГО класса: гир у класса свой, как и состав.
export const SLOT_UNLOCK_RACES = [0, 0, 0, 25, 75, 180, 400, 800, 1500, 2600]

// Лестница редкостей [E]. В билде она длиннее (есть Mythic и Unique), но
// верхние ступени достаются там из событий, которых у нас нет. Плюс-ступени
// (`Epic +1`, `Legendary +2`) — НЕ отдельные редкости: это `Rarity Upgrades`
// [E], то есть merge дубликатов, поэтому они живут полем `plus`, а не списком.
// `maxPlus` взят из наблюдённых имён: у Epic есть +1 и +2, у Legendary до +3.
export const GEAR_RARITIES = [
  { id: 'common',    name: 'Common',    color: 0x8a94a6, base: 2.0,  perLevel: 0.30, maxLevel: 10, maxPlus: 0, shard: 'rare',      shardCost: 4,  dust: 2 },
  { id: 'uncommon',  name: 'Uncommon',  color: 0x17a44b, base: 3.4,  perLevel: 0.55, maxLevel: 15, maxPlus: 0, shard: 'rare',      shardCost: 6,  dust: 4 },
  { id: 'rare',      name: 'Rare',      color: 0x0d8ecf, base: 5.8,  perLevel: 1.00, maxLevel: 20, maxPlus: 1, shard: 'rare',      shardCost: 9,  dust: 8 },
  { id: 'epic',      name: 'Epic',      color: 0x8a3ff0, base: 9.8,  perLevel: 1.80, maxLevel: 25, maxPlus: 2, shard: 'epic',      shardCost: 7,  dust: 6 },
  { id: 'legendary', name: 'Legendary', color: 0xf9a31b, base: 16.6, perLevel: 3.20, maxLevel: 30, maxPlus: 3, shard: 'legendary', shardCost: 5,  dust: 4 },
]

export const GEAR_BY_ID = Object.fromEntries(GEAR_RARITIES.map((r) => [r.id, r]))
export const GEAR_INDEX = Object.fromEntries(GEAR_RARITIES.map((r, i) => [r.id, i]))

// [E] Три вида осколков: `10/25/50 Rare Shards`, то же для Epic и Legendary.
// Осколки — ВАЛЮТА УРОВНЯ (`Shards to upgrade`), а не редкости предмета:
// поэтому у редкости есть поле shard, а не наоборот.
export const SHARD_KINDS = [
  { id: 'rare',      name: 'Rare Shards',      color: 0x0d8ecf },
  { id: 'epic',      name: 'Epic Shards',      color: 0x8a3ff0 },
  { id: 'legendary', name: 'Legendary Shards', color: 0xf9a31b },
]

// Прибавка за плюс-ступень [X] — доля от базовой силы предмета.
export const PLUS_GAIN = 0.25

// Во что превращается лишний дубликат, когда плюс-ступени кончились [X]:
// в осколки своей редкости (`dust` у редкости). Без этого топовый предмет,
// выпавший третий раз, был бы мусором, а у гачи исчез бы смысл дожимать.

// ОБЩИЙ МНОЖИТЕЛЬ ВКЛАДА ГИРА [X] — координата перебора. Гир это ТРЕТЬЯ ось
// силы после состава и карьеры, и цена ошибки здесь та же, что была у
// classFanMult: слишком много — состав и дерево становятся декорацией, слишком
// мало — вкладка не нужна. Подбирается прогоном, а не на глаз.
export const GEAR = {
  statMult: 1.0,
  // Цена уровня в осколках растёт геометрически [X]: `Shards to upgrade` [E]
  // показывает одно число, формы в оригинале не видно. Плоская цена означала
  // бы, что Lv.30 стоит столько же, сколько Lv.1, и осколки перестают быть
  // дефицитом ровно в тот момент, когда их начинает приходить много.
  shardGrowth: 1.16,
  // Дневной лимит бесплатных открытий по рекламе [E] `Watch an ad to get gear
  // for free`. Счётчик живёт в ведре наград, как и у магазина (правило 26e).
  freeAdsPerDay: 3,
}

// Паки [E] `Standard Gear` / `Elite Gear`, кнопки `Open x1` / `Open x10`,
// гарантия `Guaranteed <b>{0}</b> in <b>{1}</b> draws`. Цены и шансы [X]:
// таблица выпадения в оригинале спрятана за кнопкой `Probabilities` и в кадрах
// её нет вовсе. Форма та же, что у паков драйверов (config/drivers.js), —
// два пака, дешёвый с потолком Epic и дорогой с гарантией Legendary.
export const GEAR_PACKS = [
  {
    id: 'standard', name: 'Standard Gear', color: 0x4dd0e1,
    gems1: 12, gems10: 120, pityAt: 15, pityRarity: 'epic',
    coupon: 'standard',
    odds: { common: 0.44, uncommon: 0.32, rare: 0.19, epic: 0.045, legendary: 0.005 },
  },
  {
    id: 'elite', name: 'Elite Gear', color: 0xa06bff,
    gems1: 36, gems10: 360, pityAt: 13, pityRarity: 'legendary',
    coupon: 'elite',
    odds: { rare: 0.42, epic: 0.45, legendary: 0.13 },
  },
]

export const GEAR_PACK_BY_ID = Object.fromEntries(GEAR_PACKS.map((p) => [p.id, p]))

// [E] Купоны: `Standard Gear Coupon`, `Elite Gear Coupon` (а также купоны на
// паки драйверов — они живут в config/rewards.js как награда). Купон открывает
// пак мимо гемов: это приток, не завязанный на победы, и именно поэтому он
// здесь, а не в магазине — вкладка наград кормит гир, минуя кап 150/день.
export const COUPON_KINDS = [
  { id: 'standard', name: 'Standard Gear Coupon', pack: 'standard' },
  { id: 'elite',    name: 'Elite Gear Coupon',    pack: 'elite' },
]
