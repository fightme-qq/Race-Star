// Целевая кривая прогрессии [X] — наш дизайн, в оригинале не наблюдалась.
//
// Разблокировки классов идут шагом x25 ($40K -> $1M -> $25M -> $625M -> $15.6B).
// Если накопленный доход растёт как t^2, каждый шаг x25 = ровно x5 по времени.
// Отсюда лесенка ниже: час, 5 часов, сутки с небольшим, ~5 дней, ~26 дней.
// Это и есть удержание, на которое рассчитан идлер с шестью классами.

export const MILESTONE_TARGETS = [
  { price: 40e3,     sec: 1 * 3600,   label: '1ч' },
  { price: 1e6,      sec: 5 * 3600,   label: '5ч' },
  { price: 25e6,     sec: 25 * 3600,  label: '25ч' },
  { price: 625e6,    sec: 125 * 3600, label: '5.2д' },
  { price: 15.625e9, sec: 625 * 3600, label: '26д' },
]

// Одними вехами баланс не задать: их можно попасть и конфигом, где покупать
// нечего, а гонка проиграна заранее. Поэтому в штраф входят ещё три условия.
export const QUALITY = {
  levels: 420,      // [X] уровней куплено за 700ч — плотность покупок
  // Доля побед 0.15 — не с потолка: в оригинале кап гемов 150/день при +1 за
  // победу [F], а гонок в сутках 1440. Кап рассчитан так, чтобы упираться в
  // него было можно, но не с утра — это примерно 10-15% побед.
  winRate: 0.15,
  // [X] докуда должен доехать игрок по лигам за 700ч. Было 6 из 8; на Этапе 2
  // лестница выросла до 14 ступеней — драйверы дали вторую ось силы. Цель
  // сдвинута так, чтобы к концу прогона оставался запас в три лиги.
  league: 10,
  // Множитель от фанатов к концу прогона. Без этого условия перебор делает
  // Grandstands апгрейдом-ловушкой: цена x1.77 за уровень при +0.09 фаната.
  // Ветка должна быть заметной, иначе её незачем показывать игроку.
  fanMult: 20,
}

const logPenalty = (actual, target) => Math.pow(Math.log(actual / target), 2)

export function scoreRun(run) {
  let score = 0
  for (const t of MILESTONE_TARGETS) {
    const actual = run.milestones[t.price]
    score += logPenalty(actual || t.sec * 12, t.sec)
  }

  const levels = Object.values(run.state.cls.levels).reduce((a, b) => a + b, 0)
  score += 0.3 * logPenalty(Math.max(1, levels), QUALITY.levels)

  const winRate = run.places[1] / run.races
  score += 0.8 * logPenalty(Math.max(1e-4, winRate), QUALITY.winRate)

  score += 0.25 * Math.pow(QUALITY.league - run.state.cls.league, 2)
  score += 0.3 * logPenalty(run.state.fanMultiplier, QUALITY.fanMult)
  return score
}
