import { SEASON } from '../config/balance.js'
import { OPPONENT_SPREAD } from './RaceModel.js'
import { rivalNames } from '../config/rivals.js'

// Таблица лиги и история сезонов. [E] из локализации билда известны только
// названия блоков — `Current Season Standings`, `Season History`, `W/L`,
// «Win the season to advance». Правила начисления наши [X], но НЕ выдуманы
// отдельно: соперники считают очки ровно тем же правилом, что игрок
// (SEASON.winPoints / podiumPoints), иначе таблица врала бы про то, кто ведёт.
//
// ВАЖНО: таблица ни на что не влияет — ни на награды, ни на повышение. Оно
// по-прежнему решается счётом сезона (RaceRewards), потому что порог
// SEASON.promoteRatio — подобранный параметр баланса, а не следствие таблицы.
// Совпадают они не случайно: набрать 2.13 очка за гонку нельзя, не выигрывая
// большинство заездов, то есть не будучи первым в таблице.

export const HISTORY_LIMIT = 8

export const freshStandings = () => ({
  pts: new Array(9).fill(0),
  wins: new Array(9).fill(0),
})

export function pointsFor(position) {
  if (position === 1) return SEASON.winPoints
  if (position <= 3) return SEASON.podiumPoints
  return 0
}

// Очков нужно на повышение. Порог — доля от полного сезона, поэтому целое
// значение считаем в одном месте: игроку показывается ровно то число, по
// которому сравнивает RaceRewards.
export const promotionTarget = () => Math.ceil(SEASON.races * SEASON.promoteRatio)

// order[i] — место соперника с индексом i (тот же индекс, что в
// OPPONENT_SPREAD и у racer.id === i + 1). Без него (быстрый прогон стенда)
// таблица просто не ведётся: стенд её не читает.
export function recordRivals(cls, order) {
  if (!order || !cls.standings) return
  const st = cls.standings
  for (let i = 0; i < st.pts.length; i++) {
    const place = order[i]
    if (!place) continue
    st.pts[i] += pointsFor(place)
    if (place === 1) st.wins[i]++
  }
}

// Строки таблицы: игрок плюс девять соперников, отсортированные по очкам.
// Тай-брейк — победы, затем сила: две команды с равным счётом иначе прыгали бы
// местами между кадрами, и таблица дрожала бы на глазах.
export function standingsRows(cls, teamName, classId, playerPower = 1) {
  const st = cls.standings || freshStandings()
  const names = rivalNames(classId, cls.league, cls.season)
  const rows = st.pts.map((pts, i) => ({
    name: names[i],
    pts,
    wins: st.wins[i] || 0,
    power: OPPONENT_SPREAD[i],
    isPlayer: false,
  }))
  rows.push({
    name: teamName,
    pts: cls.seasonScore,
    wins: cls.seasonWins || 0,
    // Сила игрока в тех же единицах, что OPPONENT_SPREAD: доля от силы лиги.
    // Нужна только для тай-брейка, но нужна честная — на первой гонке сезона
    // очки у всех нулевые, и место в таблице определяется ровно ей.
    power: playerPower,
    isPlayer: true,
  })
  rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.power - a.power)
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

export const playerRank = (cls, teamName, classId, playerPower) =>
  standingsRows(cls, teamName, classId, playerPower).find((r) => r.isPlayer).rank

// Конец сезона: строку в историю, таблицу — на ноль. Зовётся из RaceRewards,
// то есть ровно там же, где сбрасывается счёт, — разъехаться они не могут.
export function archiveSeason(cls, teamName, classId, promoted, playerPower) {
  if (!cls.history) cls.history = []
  cls.history.unshift({
    season: cls.season,
    league: cls.league,
    score: cls.seasonScore,
    wins: cls.seasonWins || 0,
    rank: playerRank(cls, teamName, classId, playerPower),
    promoted,
  })
  cls.history.length = Math.min(cls.history.length, HISTORY_LIMIT)
  cls.standings = freshStandings()
  cls.seasonWins = 0
}
