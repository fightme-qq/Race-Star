// ЧИСЛА. Источник каждого помечен:
//   [F] — снято с кадров оригинала (teardown/FINDINGS.md, слой F)
//   [~] — реконструкция: форма выведена, коэффициенты подогнаны под точки с кадров
//   [X] — наш баланс, в оригинале не наблюдалось

// --- Гонка ---------------------------------------------------------------
export const RACE = {
  durationSec: 60,   // [F] таймер 00:59 -> 00:00
  racers: 10,        // [F] P1/10
  laps: 8,           // [X] в кадрах круги не подписаны
  cooldownSec: 0,    // [F] между гонками паузы нет
  tickHz: 10,        // [X] шаг симуляции
}

// --- Кривая цены боевых апгрейдов ---------------------------------------
// Множитель цены не константа: он ПАДАЕТ с уровнем. Это единственная форма,
// которая свела все 4 точки с кадров:
//   growth(i) = gMin + (gMax - gMin) * exp(-i / k)
//   price(L)  = base * П growth(i), i = 0..L-1
// Сверка (наблюдённое -> модель):
//   Overtaking Technique  Lv.8  base$25  $1.21K -> $1.19K  ✓
//   Attacking Moves       Lv.9  base$50  $6.25K -> $6.03K  ✓
//   Attacking Pressure    Lv.16 base$50  $67.2K -> $60.1K  ✓
//   Overtaking Accuracy   Lv.19 base$25  $31.4K -> $22.8K  ~ (класс Rally, вероятен свой множитель)
export const PRICE_CURVE = {
  pct2: { gMax: 1.90, gMin: 1.22, k: 6 },  // [~] слоты с шагом +2%
  pct3: { gMax: 2.05, gMin: 1.28, k: 6 },  // [~] слоты с шагом +3%
}

// --- Базовые статы команды ----------------------------------------------
export const STATS = {
  baseOffense: 100,  // [X] позже придёт из состава драйверов (5 стартовых)
  baseDefense: 100,  // [X]
}

// --- Экономика -----------------------------------------------------------
export const ECONOMY = {
  baseIncomePerSec: 1,   // [F] стартовое "Income /s $1"
  fansPerFanBonus: 500,  // [X] множитель дохода = 1 + fans / 500
  prizeSeconds: 30,      // [X] приз за гонку = доход/сек * 30 * коэф. места
  // [X] коэффициент приза по месту P1..P10
  placePrize: [1.0, 0.72, 0.55, 0.42, 0.32, 0.25, 0.19, 0.14, 0.10, 0.07],
  // [X] бонус фанатов за место (умножает прирост от Grandstands)
  placeFans: [1.6, 1.35, 1.15, 1.0, 0.85, 0.72, 0.6, 0.5, 0.4, 0.3],
  offlineCapHours: 4,    // [X] попап офлайн-дохода в оригинале нигде не показан
}

export const GEMS = {
  dailyCap: 150,   // [F] "Gems (47 / 150 per day)"
  perWin: 1,       // [F]
}

// --- Сезоны и лиги -------------------------------------------------------
export const LEAGUES = [
  { id: 'rookie',   name: 'ROOKIE LEAGUE',   power: 190 },  // [F] стартовая — ROOKIE
  { id: 'bronze',   name: 'BRONZE LEAGUE',   power: 320 },  // [E] шкала лиг из локализации
  { id: 'silver',   name: 'SILVER LEAGUE',   power: 560 },
  { id: 'gold',     name: 'GOLD LEAGUE',     power: 1050 },
  { id: 'platinum', name: 'PLATINUM LEAGUE', power: 2100 },
  { id: 'diamond',  name: 'DIAMOND LEAGUE',  power: 4400 },
  { id: 'elite',    name: 'ELITE LEAGUE',    power: 9600 },
  { id: 'expert',   name: 'EXPERT LEAGUE',   power: 21000 },
]

export const SEASON = {
  races: 20,        // [X] "SEASON 028 | SCORE 56 | RANK 3" — длина не видна
  winPoints: 3,     // [X]
  podiumPoints: 1,  // [X]
}

// --- Разблокировка классов ----------------------------------------------
// [F] "Unlock Superbike $25M" при "3 of 6 unlocked" и "Unlock New Sport $625M".
// Шаг x25 подтверждён двумя соседними ценами.
export const CLASS_UNLOCK_PRICES = [0, 40e3, 1e6, 25e6, 625e6, 15.625e9]

// --- Реклама-буст --------------------------------------------------------
export const AD_BOOST = {
  durationSec: 300,   // [X]
  multiplier: 2,      // [F] "Activate 2x"
  maxPerClass: 6,     // [F] по отзывам ~6 реклам на класс
}

export const TROPHY_UNLOCK_AT = 100  // [F] "0 / 100 trophies earned"
