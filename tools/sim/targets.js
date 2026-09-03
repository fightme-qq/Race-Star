import { RACE_CLASSES } from '../../src/config/classes.js'
import { aggregateClass } from '../../src/systems/UpgradeSystem.js'

// Целевая кривая прогрессии [X] — наш дизайн, в оригинале не наблюдалась.
//
// ПЕРЕСОБРАНА на шаге «вырождение политик». Прежняя лесенка (1ч / 5ч / 25ч /
// 5.2д / 26д) строилась на допущении, что деньги растут как t^2 непрерывно:
// цены идут шагом x25 [F], значит каждый шаг ровно x5 по времени. Допущение
// молча означало, что СМЕНА КЛАССА НИЧЕГО НЕ МЕНЯЕТ, — и это ровно то, что
// делал стенд: 700 часов одним классом, ни одной оплаченной разблокировки.
//
// На самом деле у нового класса приток фанатов идёт множителем c
// (ECONOMY.classFanMult), поэтому шаг по времени r связан с ценой тождеством
// 25 = c * r^2. Выбрано r = 4, отсюда c = 1.5625 (вывод и обе границы на r —
// в balance.js) и лесенка ниже: хвост закреплён на 625-м часу удержанием,
// остальное делится на четыре.
const LAST_SEC = 625 * 3600   // [X] последний класс к 26-му дню — якорь удержания
const STEP = 4                // [X] каждый класс вчетверо дольше предыдущего

const PRICES = [40e3, 1e6, 25e6, 625e6, 15.625e9]   // [F] шаг x25
const label = (sec) => sec >= 86400 ? (sec / 86400).toFixed(1) + 'д'
  : (sec / 3600).toFixed(1) + 'ч'

export const MILESTONE_TARGETS = PRICES.map((price, i) => {
  const sec = LAST_SEC / Math.pow(STEP, PRICES.length - 1 - i)
  return { price, sec, label: label(sec) }
})

// Веха засчитывается по ФАКТУ открытия класса, а не по «накопил на цену».
// Разница не косметическая: цену копят один раз, а платят её деньгами, которые
// иначе ушли бы в апгрейды, — и после перехода доход падает к полу $1/с [F].
// Старое `run.milestones` (по накоплению) остаётся в отчёте второй колонкой:
// расхождение двух колонок и показывает, чего стоит переход.
export const unlockSec = (run, price) =>
  run.switches?.find((s) => s.price === price)?.sec ?? null

// Одними вехами баланс не задать: их можно попасть и конфигом, где покупать
// нечего, а гонка проиграна заранее. Поэтому в штраф входят ещё три условия.
export const QUALITY = {
  levels: 420,      // [X] уровней куплено за 700ч — плотность покупок
  // Доля побед 0.15 — не с потолка: в оригинале кап гемов 150/день при +1 за
  // победу [F], а гонок в сутках 1440. Кап рассчитан так, чтобы упираться в
  // него было можно, но не с утра — это примерно 10-15% побед.
  winRate: 0.15,
  // [X] докуда должен доехать игрок по лигам за 700ч.
  league: 10,
  // Во сколько раз ветка фанатов поднимает СВОЙ приток к концу прогона.
  // Grandstands даёт 10 + 5L фанатов за гонку [F], значит x20 — это Lv.38.
  // Без этого условия перебор делает слот ловушкой и не покупает его вовсе.
  fanRate: 20,
}

// Приток фанатов на Lv.0 — flat слота Grandstands [F]. Держим числом здесь,
// чтобы метрика не поехала молча при правке слота.
const FANS_BASE = 10

const logPenalty = (actual, target) => Math.pow(Math.log(actual / target), 2)

// Все три метрики качества считаются ПО ВСЕМ КЛАССАМ, а не по активному.
// Иначе прогон со сменой класса штрафовался бы за то, что переехал: у свежего
// класса и уровней ноль, и лига нулевая, и ветка фанатов не куплена.
function acrossClasses(state) {
  let levels = 0
  let league = 0
  let fanRate = 0
  for (const c of RACE_CLASSES) {
    const cls = state.classes[c.id]
    if (!cls.unlocked) continue
    levels += Object.values(cls.levels).reduce((a, b) => a + b, 0)
    league = Math.max(league, cls.league)
    fanRate = Math.max(fanRate, aggregateClass(c.id, cls.levels).fansPerRace)
  }
  return { levels, league, fanRate }
}

export function scoreRun(run) {
  let score = 0
  for (const t of MILESTONE_TARGETS) {
    // Не дошёл — штрафуем как за двенадцатикратное опоздание, чтобы «не открыл
    // вовсе» стоило дороже любого промаха по времени.
    score += logPenalty(unlockSec(run, t.price) || t.sec * 12, t.sec)
  }

  const { levels, league, fanRate } = acrossClasses(run.state)
  score += 0.3 * logPenalty(Math.max(1, levels), QUALITY.levels)

  const winRate = run.places[1] / run.races
  score += 0.8 * logPenalty(Math.max(1e-4, winRate), QUALITY.winRate)

  score += 0.25 * Math.pow(QUALITY.league - league, 2)
  score += 0.3 * logPenalty(Math.max(1, fanRate / FANS_BASE), QUALITY.fanRate)
  return score
}
