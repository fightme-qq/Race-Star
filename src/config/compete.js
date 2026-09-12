// Соревнования: Champions Arena, турниры, кубок, клубы. Шаг 8.
//
// ГРАНИЦА ИСТОЧНИКОВ. Экранов нет ни на одном публичном кадре, зато этот шаг —
// единственный, где слой [E] дал почти полное ОПИСАНИЕ МЕХАНИКИ: в билде лежат
// целые попапы «Overview» с правилами. Поэтому структура и все числа из них
// помечены [E] дословно, а [X] — только то, чего в тексте нет (таблицы наград,
// пороги ранга, размер сетки).
//
// Главное свойство этого шага: он НЕ трогает кривую дохода. Соревнования платят
// гемами, осколками и купонами — то есть кормят оси силы, которые уже
// подобраны, а не добавляют новый множитель денег. Поэтому он идёт после
// гира и гаража, а не между ними.

// --- Champions Arena -----------------------------------------------------
// Всё из попапа `Champions Arena Overview` [E]:
//   «Each match costs 1 Arena Ticket», «Your tickets refill to 3 every day at
//   5:00 AM UTC», «If you have more than 3 tickets, they remain until reset»,
//   «At reset ... any extra Arena Tickets are removed», «Your rank is based on
//   the total Medals you earn each day», «Rewards are based on your final rank
//   and sent via in-game mail».
export const ARENA = {
  ticketCost: 1,            // [E]
  ticketsRefill: 3,         // [E] пополняется ДО трёх, а не на три
  resetHourUtc: 5,          // [E] 5:00 AM UTC
  opponents: 3,             // [E] `Select an opponent` — сколько показывать [X]
  refreshes: 5,             // [E] `Refresh {0}/{1}` — сколько раз за день [X]
  medalsWin: 12,            // [X]
  medalsLoss: 3,            // [X] проигрыш тоже даёт медали, иначе тикет сгорает зря
  // Разброс силы соперника относительно силы игрока [X]. Подбор соперника «по
  // силе» — это прямо из попапа: шанс зависит от отношения Team Power, и если
  // соперники были бы из воздуха, показанный Win Chance был бы либо 99%, либо
  // 1% всегда.
  spread: [0.86, 1.0, 1.18],
}

// [E] Ровно пять лиг арены — `Bronze/Silver/Gold/Platinum/Diamond League`.
// Ни Elite, ни Expert в арене нет (в отличие от лиг трассы, где ступеней 14).
// Пороги медалей [X]: в билде ни одного числа.
export const ARENA_LEAGUES = [
  { id: 'bronze',   name: 'Bronze League',   color: 0xa9714b, medals: 0 },
  { id: 'silver',   name: 'Silver League',   color: 0x9aa7b4, medals: 240 },
  { id: 'gold',     name: 'Gold League',     color: 0xf9a31b, medals: 720 },
  { id: 'platinum', name: 'Platinum League', color: 0x4dd0e1, medals: 1800 },
  { id: 'diamond',  name: 'Diamond League',  color: 0x8a3ff0, medals: 4200 },
]

// Награды за ранг по итогам суток, письмом [E]. Числа [X].
// Ранг считается по медалям ЗА СУТКИ, а лига — по накопленным: в попапе это два
// разных предложения, и путать их нельзя.
export const ARENA_RANK_REWARDS = [
  { upTo: 1,  rewards: [{ kind: 'gems', amount: 40 }, { kind: 'shards', shard: 'legendary', amount: 10 }] },
  { upTo: 3,  rewards: [{ kind: 'gems', amount: 25 }, { kind: 'shards', shard: 'epic', amount: 25 }] },
  { upTo: 10, rewards: [{ kind: 'gems', amount: 12 }, { kind: 'shards', shard: 'rare', amount: 25 }] },
  { upTo: 50, rewards: [{ kind: 'gems', amount: 5 }, { kind: 'shards', shard: 'rare', amount: 10 }] },
]

// --- Турниры -------------------------------------------------------------
// Из попапов `Tournament Overview` и `Weekly Tournament Overview` [E]:
//   «you compete in a bracket against other players in your league»,
//   «Each match is played as a best-of-three», «Rewards are based on your final
//   tournament placement and league, and are sent via in-game mail»,
//   «Each tournament features one sport, which rotates each week».
// Раунды подписаны `Quarter-Final` / `Semi-Final` / `Final` [E] — то есть сетка
// на ВОСЕМЬ участников, это единственное, что из названий раундов выводится.
export const BRACKET = {
  size: 8,                  // [E] выведено из трёх названий раундов
  bestOf: 3,                // [E]
  roundNames: ['Quarter-Final', 'Semi-Final', 'Final'],   // [E]
  winsNeeded: 2,            // [E] «Win at least 2 out of 3 matches»
  // Сколько заездов трассы проходит между раундами [X]. В оригинале раунды
  // открываются по расписанию («when the next round will be revealed»), а у нас
  // календаря нет: привязка к гонкам сохраняет смысл ожидания.
  racesPerRound: 20,
}

// Награды по финальному месту [X], письмом [E]. Множитель лиги — тот же
// leaguePrizeMult, что у призовых: турнир в DIAMOND обязан платить больше, чем
// в ROOKIE, иначе поздний игрок перестаёт в него заходить.
export const BRACKET_REWARDS = [
  { place: 1, rewards: [{ kind: 'gems', amount: 50 }, { kind: 'coupon', coupon: 'elite', amount: 1 }] },
  { place: 2, rewards: [{ kind: 'gems', amount: 25 }, { kind: 'coupon', coupon: 'standard', amount: 2 }] },
  { place: 4, rewards: [{ kind: 'gems', amount: 12 }, { kind: 'carShards', shard: 'gepic', amount: 10 }] },
  { place: 8, rewards: [{ kind: 'gems', amount: 5 }] },
]

// [E] Weekly Tournament: «Each tournament features one sport, which rotates
// each week» + «Remember to register again for each new Weekly Tournament».
export const WEEKLY = { registerNeeded: true }

// --- Кубок ---------------------------------------------------------------
// [E] В билде есть ровно одно имя кубка — `Stock Car Cup`, и набор рамок
// `Bronze/Silver/Gold/Platinum/Diamond Stock Car Cup Frame` с описанием
// «A permanent trophy for conquering the Bronze Stock Car Cup.» То есть кубок
// привязан к КЛАССУ, а награда — ПОСТОЯННАЯ рамка, а не валюта.
export const CUP = {
  tiers: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],   // [E]
  // Требование к лиге трассы для входа в ступень кубка [X]: кубок — проверка
  // «дорос ли», поэтому ступень открывается лигой, а не деньгами.
  tierLeague: [0, 3, 6, 9, 12],
  entryGems: 0,             // [X] вход бесплатный: тикеты уже есть у арены
  racesPerRound: 20,        // [X] как у сетки
}

// --- Клубы ---------------------------------------------------------------
// Из попапа `Club Clash Overview` [E]:
//   «Each player receives 3 Challenges per day», «To capture an opposing
//   position, you must win a best-of-three match series», «Each match uses a
//   random sport», «Win at least 2 out of 3 matches to capture the position»,
//   «When you capture a position, it becomes protected», «Empty positions can be
//   claimed immediately without playing a match», «Occupied positions generate
//   points for your Club over time», «rewards are based on whether your Club
//   wins or loses and are sent via in-game mail».
// [F] единственное число оригинала: создание клуба — 150💎.
export const CLUB = {
  createGems: 150,          // [F]
  members: 20,              // [X] `Club is full` есть, числа нет
  challengesPerDay: 3,      // [E]
  positions: 8,             // [X] `Each position can be occupied by only one
                            //     player at a time`, сколько их — нет данных
  protectionSec: 1800,      // [X] таймер защиты
  // Очки позиции в минуту: верхние дороже [E] «Higher positions generate more
  // Club Points, making them the most valuable spots to control». Числа [X].
  pointsPerMin: [10, 8, 6, 5, 4, 3, 2, 1],
  clashDays: 3,             // [X] длина события
  winRewards: [{ kind: 'gems', amount: 60 }, { kind: 'coupon', coupon: 'elite', amount: 2 }],
  loseRewards: [{ kind: 'gems', amount: 20 }, { kind: 'coupon', coupon: 'standard', amount: 1 }],
  // Порог силы для входа в клуб [E] `Your Power Level is too low to join this
  // club` — у ботов-клубов он свой, от этого зависит, в какой клуб пустят.
  powerGates: [0, 600, 2500, 9000],
}

// Рамки [E] — постоянная косметика: `Weekly Tournament Champion Frame`,
// `Bronze Arena Frame ({0} Days)`, `Bronze Stock Car Cup Frame`. У арены рамка
// временная («Lasts {0} days»), у кубка постоянная — прямо из описаний.
export const FRAMES = {
  arenaDays: 7,             // [E] «Lasts {0} days», число [X]
  weeklyDays: 7,            // [E] то же
}
