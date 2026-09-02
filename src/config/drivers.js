// Драйверы (`SportTeamPlayers` в оригинале). Источник каждого числа помечен:
//   [F] — снято с кадров, [~] — реконструкция формы, [X] — наш баланс.

// Редкости. Шкала имён [F] неполная: серый Amateur, фиолетовый All-Star,
// золотой Legend, оранжевый Unique подписаны на кадрах; зелёная и синяя
// ступени видны только цветом — названия наши [X].
// Диапазоны статов посажены на две наблюдённые точки: Legend «Cruz Castro»
// 96/93 (рейтинг 95) и Unique «Macks» рейтинг 150. Остальные ступени
// расставлены геометрически между стартовой пятёркой (~20) и Legend.
export const RARITIES = [
  { id: 'amateur', name: 'Amateur',  color: 0x7b8496, min: 15, max: 29,  feedXp: 20,   sellSec: 25 },
  { id: 'semipro', name: 'Semi-Pro', color: 0x17a44b, min: 30, max: 45,  feedXp: 45,   sellSec: 70 },
  { id: 'pro',     name: 'Pro',      color: 0x0d8ecf, min: 46, max: 65,  feedXp: 100,  sellSec: 190 },
  { id: 'allstar', name: 'All-Star', color: 0x8a3ff0, min: 66, max: 87,  feedXp: 240,  sellSec: 520 },
  { id: 'legend',  name: 'Legend',   color: 0xf9a31b, min: 88, max: 110, feedXp: 600,  sellSec: 1400 },
  { id: 'unique',  name: 'Unique',   color: 0xe8232b, min: 130, max: 160, feedXp: 1500, sellSec: 3800 },
]

export const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r) => [r.id, r]))
export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]))

// Продажа даёт не плоские деньги, а СЕКУНДЫ текущего дохода — по той же
// причине, что и призовые (RaceRewards): плоская сумма к середине игры
// обесценивается на порядки и кнопка становится мёртвой.

// Пул имён. Драйвер опознаётся парой (defId, rarity) — merge требует именно
// дубликат, поэтому пул конечный [F: «Merge (объединить дубликаты)»].
export const NAMES = [
  'Cruz Castro', 'Dane Reyes', 'Milo Vance', 'Otto Brandt', 'Kai Lindqvist',
  'Rex Halloway', 'Nico Ferraro', 'Ivo Petrenko', 'Sami Okafor', 'Luca Bianchi',
  'Theo Marchand', 'Enzo Duarte', 'Ryu Nakamura', 'Adem Yilmaz', 'Bram de Vries',
  'Gus Thornton', 'Vik Sorensen', 'Marco Salas', 'Finn Doyle', 'Yuri Kovacs',
  'Abel Nkemi', 'Jax Whitmore', 'Leon Aubert', 'Pavel Horak',
]

// [F] секция состава подписана «STARTERS (5)» с меткой PLAYING NOW.
export const SQUAD_SIZE = 5

// Стартовая пятёрка на класс. Числа подобраны так, чтобы сумма давала ровно
// 100 offense и 100 defense: это точка калибровки Этапа 1 (раньше жила в
// balance.js как STATS.baseOffense/baseDefense). Меняешь их — едут все вехи.
export const STARTER_STATS = [
  { off: 22, def: 18 }, { off: 21, def: 19 }, { off: 20, def: 20 },
  { off: 19, def: 21 }, { off: 18, def: 22 },
]

// Тренировка. Прирост +10% от БАЗОВОГО стата за уровень — [F], сверено на
// трёх точках: 96→(+9.6), 96→(+19.2), 93→(+9.3).
// Пороги XP с кадров: 75 (Lv+1) и 100 (Lv+2). Две точки одинаково хорошо
// ложатся и на линейный шаг +25, и на геометрический x1.333 — берём второй:
// при линейном пороге уровень растёт как sqrt(XP), и поток кормёжки из гачи
// уводит статы в разнос (проверено прогоном: +43 уровня за 700ч).
// x1.333 даёт логарифм: 56 -> 75 -> 100 -> 133 ...
export const TRAINING = {
  gainPerLevel: 0.10,  // [F]
  xpBase: 56,          // [~] чтобы порог на Lv.1 дал ровно 75
  xpGrowth: 1.333,     // [~] 75 -> 100 наблюдены, дальше геометрия
}

// Merge дубликатов -> звёзды. Механика [F], числа [X].
export const STARS = { max: 5, gainPerStar: 0.08 }

// Гача. Цены и pity — [F] с текста баннеров. Таблица выпадения [X]:
// в оригинале она спрятана за кнопкой «шансы», в кадрах её нет.
export const PACKS = [
  {
    id: 'pro', name: 'PRO PACK', color: 0x4dd0e1,
    gems1: 10, gems10: 100, pityAt: 15, pityRarity: 'allstar',
    odds: { amateur: 0.46, semipro: 0.33, pro: 0.165, allstar: 0.04, legend: 0.005 },
  },
  {
    id: 'allstar', name: 'ALL-STAR PACK', color: 0xa06bff,
    gems1: 30, gems10: 300, pityAt: 13, pityRarity: 'legend',
    odds: { pro: 0.40, allstar: 0.46, legend: 0.135, unique: 0.005 },
  },
]

export const PACK_BY_ID = Object.fromEntries(PACKS.map((p) => [p.id, p]))
