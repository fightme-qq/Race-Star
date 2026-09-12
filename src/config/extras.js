// Доборы шага 9: Unique Cores, коллекции, аутфиты, Lucky Draw, гифт-коды,
// аватары и рамки.
//
// ГРАНИЦА ИСТОЧНИКОВ. Ни одного кадра, зато локализация билда [E] дала целые
// попапы правил и полные списки имён: 25 альбомов коллекций, 16 аутфитов,
// механика дубликатов и Wild Cards. Числа [X] все — ни одной цены, ни одного
// шанса в билде нет.

// --- Unique Cores --------------------------------------------------------
// [E] Строк всего несколько, но они однозначны: `Unique Cores`,
// `Unique driver upgrades permanently consume one driver to strengthen
// another!`, `Get more unique drivers to upgrade`. То есть ядро — это валюта, а
// апгрейд съедает ВТОРОГО драйвера. Числа [X].
export const CORES = {
  // Сколько ядер стоит ступень и что она даёт. Ступеней немного и они дорогие:
  // Unique — вершина лестницы редкостей (стат 150 [F]), и дешёвая прокачка
  // вершины обесценила бы всё, что под ней.
  perStep: 3,
  maxSteps: 5,
  gainPerStep: 0.10,      // +10% к базовым статам за ступень, как тренировка [F]
  // Откуда ядра берутся: дубликат Unique-драйвера (в гаче он 0.5%) и призы
  // коллекций. Прямой продажи за гемы НЕТ намеренно — иначе вершина лестницы
  // покупается кошельком, а не игрой.
  fromDuplicate: 1,
}

// --- Коллекции -----------------------------------------------------------
// Попап `Collections Overview` [E] полностью: сезонное событие, альбомы из
// карт, паки дают карты разных звёзд, дубликаты превращаются в Stars, Stars
// тратятся в Star Shop на паки, Wild Card открывает недостающую карту,
// завершение альбома даёт награду, завершение всех — Ultimate Reward.
export const COLLECTION = {
  // [X] Размер альбома. В билде есть `{0} Cards`, `Total Cards {0}`,
  // `Number of Cards {0}` — параметры, не числа.
  cardsPerAlbum: 9,
  // Сколько альбомов в сезоне [X]: всех 25 имён сразу — это месяцы гринда,
  // поэтому сезон берёт четыре, а имена идут по кругу.
  albumsPerSeason: 4,
  seasonDays: 14,          // [E] «available for a limited time», длина [X]
  // Дубликат → Stars. Ровно та механика, на которую в билде ссылается ошибка
  // импортёра: `DuplicateValues (collection_id, rarity, coins)`.
  dupStars: { common: 1, uncommon: 2, rare: 4, epic: 9, legendary: 20 },
  starShop: [
    { id: 'common',    name: 'Common Pack',    stars: 20,  cards: 3 },
    { id: 'rare',      name: 'Rare Pack',      stars: 60,  cards: 3 },
    { id: 'legendary', name: 'Legendary Pack', stars: 180, cards: 5 },
  ],
  // Шансы карт в паке [X]. Золотая карта — отдельный флаг, как в оригинале
  // (`Golden Wild Cards can unlock missing Golden Cards`).
  odds: { common: 0.45, uncommon: 0.28, rare: 0.17, epic: 0.08, legendary: 0.02 },
  goldenChance: 0.08,
  albumReward: [{ kind: 'gems', amount: 30 }, { kind: 'coupon', coupon: 'elite', amount: 1 }],
  ultimateReward: [
    { kind: 'gems', amount: 150 }, { kind: 'cores', amount: 3 }, { kind: 'outfit' },
  ],
  // Пак коллекции зарабатывается игрой [E] «Packs can be earned by playing the
  // game» — у нас за каждые N заездов [X]. Гемами НЕ продаётся: четвёртый
  // гемовый сток сломал бы подбор шага 5 (правило 26b).
  packEveryRaces: 40,
}

// [E] 25 имён альбомов из билда, в порядке id.
export const ALBUMS = [
  'Stock Car', 'Rally', 'Drag Racing', 'Drift', 'Off-Road', 'Open Wheel',
  'Go-Kart', 'Motocross', 'Hill Climb', 'Speedster', 'Monster Truck',
  'Superbike', 'Endurance', 'Electric Racing', 'Powerboat Racing',
  'Truck Racing', 'Ice Racing', 'Demolition Derby', 'Night Racing',
  'Pit Crew Life', 'Legends Garage', 'Weather Wars', 'The Rivals',
  'Race Day Carnival', 'Midnight Classic',
]

export const CARD_RARITIES = [
  { id: 'common',    name: 'Common',    color: 0x8a94a6, stars: 1 },
  { id: 'uncommon',  name: 'Uncommon',  color: 0x17a44b, stars: 2 },
  { id: 'rare',      name: 'Rare',      color: 0x0d8ecf, stars: 3 },
  { id: 'epic',      name: 'Epic',      color: 0x8a3ff0, stars: 4 },
  { id: 'legendary', name: 'Legendary', color: 0xf9a31b, stars: 5 },
]

// --- Аутфиты -------------------------------------------------------------
// [E] Попап: «All outfits have <b>Owned</b> and <b>Equipped</b> bonuses. When
// you own multiple outfits, their <b>Owned</b> stats are combined. Each outfit
// can be upgraded up to 10 stars using <b>Shards</b>.» Это единственное число
// оригинала здесь — десять звёзд. 16 имён [E] в порядке id.
export const OUTFIT_STARS = 10

export const OUTFITS = [
  { id: 'rookie',   name: 'Rookie Driver',        owned: { offPct: 1 }, equip: { offPct: 3 } },
  { id: 'pit',      name: 'Pit Grinder',          owned: { incomePct: 1 }, equip: { incomePct: 4 } },
  { id: 'veteran',  name: 'Veteran Racer',        owned: { defPct: 1 }, equip: { defPct: 3 } },
  { id: 'junior',   name: 'Junior Ace',           owned: { offPct: 1 }, equip: { offPct: 4 } },
  { id: 'flash',    name: 'Speed Flash',          owned: { offPct: 2 }, equip: { offPct: 5 } },
  { id: 'prodigy',  name: 'Track Prodigy',        owned: { defPct: 2 }, equip: { defPct: 5 } },
  { id: 'showman',  name: 'The Showman',          owned: { fansPct: 2 }, equip: { fansPct: 6 } },
  { id: 'noble',    name: 'Grand Prix Noble',     owned: { incomePct: 2 }, equip: { incomePct: 6 } },
  { id: 'slugger',  name: 'Power Slugger',        owned: { offPct: 3 }, equip: { offPct: 7 } },
  { id: 'tech',     name: 'Master Technician',    owned: { defPct: 3 }, equip: { defPct: 7 } },
  { id: 'captain',  name: 'Team Captain',         owned: { offPct: 2, defPct: 2 }, equip: { offPct: 5, defPct: 5 } },
  { id: 'allstar',  name: 'All-Star Ace',         owned: { offPct: 4 }, equip: { offPct: 9 } },
  { id: 'heavy',    name: 'Heavyweight Champion', owned: { defPct: 4 }, equip: { defPct: 9 } },
  { id: 'gryphon',  name: 'Gryphon Mascot',       owned: { fansPct: 4 }, equip: { fansPct: 10 } },
  { id: 'reigning', name: 'Reigning Champion',    owned: { offPct: 3, defPct: 3 }, equip: { offPct: 8, defPct: 8 } },
  { id: 'tuner',    name: 'Grand Tuner',          owned: { incomePct: 4 }, equip: { incomePct: 12 } },
]

// Прибавка за звезду аутфита [X] — доля от собственного бонуса.
export const OUTFIT_STAR_GAIN = 0.12

// --- Lucky Draw ----------------------------------------------------------
// [E] `Play Lucky Draw to win amazing rewards`, `All rewards have been
// claimed`, «Legendary Reward» в пушах. [F] машины крутятся здесь за гемы,
// топовые стоят $9.99 — значит в сетке и машины, и расходники.
export const LUCKY = {
  slots: 13,               // [X]
  drawGems: 40,            // [X]
  // Один и тот же приз дважды не выпадает [E] «All rewards have been claimed» —
  // то есть сетка ВЫЧЕРПЫВАЕТСЯ, а не крутится бесконечно. Это делает
  // последние ячейки дорогими по ожиданию, и именно поэтому легендарная машина
  // достижима без денег, но не быстро.
  resetDays: 7,
  prizes: [
    { kind: 'gems', amount: 25 },
    { kind: 'shards', shard: 'epic', amount: 25 },
    { kind: 'carShards', shard: 'gepic', amount: 25 },
    { kind: 'coupon', coupon: 'standard', amount: 2 },
    { kind: 'cashSec', amount: 600 },
    { kind: 'shards', shard: 'legendary', amount: 15 },
    { kind: 'coupon', coupon: 'elite', amount: 1 },
    { kind: 'carShards', shard: 'glegendary', amount: 15 },
    { kind: 'cores', amount: 1 },
    { kind: 'cashSec', amount: 1800 },
    { kind: 'carStar', amount: 1 },
    // [E] «There is currently no active Lucky Draw with Career Driver Outfits» —
    // то есть аутфиты раздаёт именно Lucky Draw. Второго источника у них нет,
    // кроме Ultimate Reward коллекций.
    { kind: 'outfit' },
    { kind: 'car', tier: 'legend' },      // [F] легендарная машина — главный приз
  ],
}

// --- Гифт-коды -----------------------------------------------------------
// [E] `Gift Codes`, `Enter Gift Code`, `Gift Code not found`, `This Gift Code
// already used`, `GiftCode must be between {0} and {1} characters`,
// «Join our Discord channel and get 10 Gems as a reward!».
export const GIFT_CODES = {
  minLen: 4,
  maxLen: 16,
  codes: {
    DISCORD: [{ kind: 'gems', amount: 10 }],          // [E] ровно 10 гемов
    RACESTAR: [{ kind: 'gems', amount: 50 }],
    PITSTOP: [{ kind: 'coupon', coupon: 'standard', amount: 3 }],
    GRIDSTART: [{ kind: 'cashSec', amount: 900 }],
  },
}

// --- Аватары и рамки (`VanityItems` [D]) ---------------------------------
// [E] `Avatar`, `Frame`, `Starter Frame` / «Your starter frame.»,
// `Default Frame`, `{0} Days`, рамки арены/кубка/недельного турнира.
// Чистая косметика: аватар показывается в шапке, рамка — вокруг него.
export const AVATARS = [
  { id: 'rookie',  name: 'Rookie',     icon: '🧑‍✈️', need: null },
  { id: 'veteran', name: 'Veteran',    icon: '🧢',   need: { races: 500 } },
  { id: 'champion', name: 'Champion',  icon: '🏆',   need: { wins: 100 } },
  { id: 'legend',  name: 'Legend',     icon: '🔥',   need: { league: 8 } },
  { id: 'mascot',  name: 'Kodiak Mascot', icon: '🐻', need: { albums: 1 } },
]

export const FRAME_COLORS = {
  starter: 0x9aa7b4, bronze: 0xa9714b, silver: 0x9aa7b4,
  gold: 0xf9a31b, platinum: 0x4dd0e1, diamond: 0x8a3ff0,
}
