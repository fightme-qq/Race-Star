// ЧИСЛА вкладки наград. Метки как везде: [F] с кадров, [~] реконструкция,
// [X] наш баланс.
//
// Что снято с кадров (FINDINGS, слой F):
//   Season Pass: сезон ≈ 10 дней (`9D 19H 11M`), шкала `10 / 35`.
//   DAILY (сброс 24 ч): watch ad 1/1, spend gems 30/50, finish race 54/100,
//     win race 4/5, finish season 0/1 — каждая по 🪙10.
//   WEEKLY (сброс 7 дн): watch ad 1/20, spend gems 30/250, finish race — по 🪙100.
// Самого экрана наград нет ни на одном из 42 кадров: видны только счётчики
// задач и шкала пасса. Композиция и все награды — наши.

// Эпоха, от которой считаются недельный и сезонный периоды. Не «с момента
// установки»: иначе у балансного стенда и у игрока неделя начиналась бы в
// разные моменты, и приток токенов было бы не с чем сравнивать.
export const DAY_MS = 86400000
export const EPOCH_UTC = Date.UTC(2026, 0, 1)

// Награда — {kind, amount}. `cashSec` меряется В СЕКУНДАХ ДОХОДА, а не в
// долларах, по той же причине, что призовые и цена продажи драйвера: плоская
// сумма к середине игры отстаёт от экономики на порядки и кнопка умирает.
// Гемы и трофеи плоские — они не инфлируют.
export const REWARD_ICON = { gems: '💎', cashSec: '💵', trophy: '🏆', token: '🪙',
  // Шаг 8 платит расходниками осей силы, а не только валютой. Без этих трёх
  // строк награда турнира рисовалась как «2 » с пустой иконкой.
  shards: '⬢',
  carShards: '⚙',
  coupon: '🎫',
  cores: '⬣',
  outfit: '🧥',
  car: '🏎',
  carStar: '★',
}

export const TASK_TOKENS = { daily: 10, weekly: 100 }   // [F]

export const DAILY_TASKS = [
  { id: 'ad',     metric: 'adWatch',      goal: 1,   title: 'Watch an ad' },          // [F] 1/1
  { id: 'gems',   metric: 'gemSpend',     goal: 50,  title: 'Spend Gems' },           // [F] 30/50
  { id: 'races',  metric: 'raceFinish',   goal: 100, title: 'Finish races' },         // [F] 54/100
  { id: 'wins',   metric: 'raceWin',      goal: 5,   title: 'Win races' },            // [F] 4/5
  { id: 'season', metric: 'seasonFinish', goal: 1,   title: 'Finish a season' },      // [F] 0/1
]

// Третья недельная цель на кадре обрезана — видно подпись `finish race` и
// награду 🪙100, но не число. 700 = семь дневных целей [X].
export const WEEKLY_TASKS = [
  { id: 'ad',    metric: 'adWatch',    goal: 20,  title: 'Watch ads' },               // [F] 1/20
  { id: 'gems',  metric: 'gemSpend',   goal: 250, title: 'Spend Gems' },              // [F] 30/250
  { id: 'races', metric: 'raceFinish', goal: 700, title: 'Finish races' },            // [X]
]

export const METRICS = ['adWatch', 'gemSpend', 'raceFinish', 'raceWin', 'seasonFinish']

// --- Season Pass ---------------------------------------------------------
// Цена уровня линейна: 12, 13, 14, ... Полная шкала из 35 уровней стоит
// 35*12 + 595 = 1015 🪙, а дневной потолок задач — 5*10 + 300/7 ≈ 93 🪙.
// То есть за 10 дней [F] пасс проходится примерно на девять десятых при
// идеальной игре и заметно меньше при обычной — как и задумано в оригинале,
// где шкала на кадре стоит на 10/35 при уже начатом сезоне.
export const PASS = {
  days: 10,        // [F] `9D 19H 11M` до конца сезона
  levels: 35,      // [F] шкала `10 / 35`
  tokenBase: 12,   // [~]
  tokenStep: 1,    // [~]
}

// Free-трек (`Rookie` [E]) и премиум (`Champion`). Премиум в оригинале — IAP
// `Rookie Pass $4.99` [F], то есть до магазина (шаг 5) он покупкой не станет:
// ветка рисуется, но заблокирована. Класть её на гемы значило бы придумать
// цену, которую потом придётся выбрасывать вместе с магазином.
export function passReward(level, premium = false) {
  if (premium) {
    if (level % 10 === 0) return { kind: 'gems', amount: 150 }
    if (level % 5 === 0) return { kind: 'gems', amount: 60 }
    if (level % 3 === 0) return { kind: 'trophy', amount: 6 }
    return { kind: 'cashSec', amount: 900 }
  }
  if (level % 10 === 0) return { kind: 'gems', amount: 60 }
  if (level % 5 === 0) return { kind: 'gems', amount: 25 }
  if (level % 5 === 3) return { kind: 'trophy', amount: 2 }
  return { kind: 'cashSec', amount: 240 }
}

// --- Daily Rewards -------------------------------------------------------
// `DailyRewardsConfig` + `Milestones_Rotation` [E] — из лога билда известно,
// что есть цикл наград и майлстоуны. Сами награды наши [X].
export const LOGIN = {
  cycle: [
    { kind: 'gems', amount: 20 },
    { kind: 'cashSec', amount: 300 },
    { kind: 'gems', amount: 30 },
    { kind: 'trophy', amount: 3 },
    { kind: 'cashSec', amount: 600 },
    { kind: 'gems', amount: 40 },
    { kind: 'gems', amount: 80 },
  ],
  // Майлстоуны — по СУММАРНЫМ дням входа, они не сбрасываются циклом.
  milestones: [
    { days: 3, reward: { kind: 'gems', amount: 50 } },
    { days: 7, reward: { kind: 'trophy', amount: 10 } },
    { days: 14, reward: { kind: 'gems', amount: 150 } },
    { days: 30, reward: { kind: 'gems', amount: 400 } },
  ],
}

// --- Почта ---------------------------------------------------------------
// `MailboxMessages` [E]. Смысл на этом шаге — доставка наград за события,
// которые случились, пока игрок смотрел в другое место: конец сезона и
// повышение в лиге. С шага 8 сюда же придут награды арены и турниров.
export const MAIL = {
  max: 20,   // [X] старые письма вытесняются
  seasonReward: { kind: 'cashSec', amount: 400 },   // [X]
  promoReward: { kind: 'gems', amount: 15 },        // [X]
}
