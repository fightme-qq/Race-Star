import { CLUB } from '../config/compete.js'
import { racerShape, opponentShape, duelProb } from './RaceModel.js'
import { mulberry32 } from '../utils/rng.js'
import { playSeries } from './BracketSystem.js'

// Клубы и Club Clash. Сети у нас нет, поэтому клубы — боты, а «другой клуб»
// держит позиции сам. Всё остальное — по попапу [E] дословно: 3 вызова в сутки,
// серия до двух побед из трёх, захваченная позиция защищена таймером, пустая
// берётся без боя, занятые позиции копят очки клубу со временем, награда по
// итогу события письмом.

const DAY = 86400000
const dayKey = (now) => Math.floor(now / DAY)

export const freshClub = (now = Date.now()) => ({
  joined: null,            // индекс клуба из списка ботов
  name: null,             // имя СВОЕГО клуба, если создан [F: 150 гемов]
  own: false,
  day: dayKey(now),
  used: 0,                 // вызовов за сутки [E] 3 per day
  clash: null,
})

// Список клубов [E] `Club List`, `Show only clubs I can join`,
// `Your Power Level is too low to join this club`. Выводится из порогов силы:
// слабому игроку видны слабые клубы, и это единственное, что в оригинале
// ограничивает вступление.
export function clubList(power) {
  return CLUB.powerGates.map((gate, i) => {
    const rnd = mulberry32((i * 2654435761) >>> 0)
    return {
      index: i,
      name: ['Pit Rookies', 'Apex Union', 'Redline Syndicate', 'Grid Masters'][i],
      gate,
      members: 6 + Math.floor(rnd() * (CLUB.members - 6)),
      canJoin: power >= gate,
    }
  })
}

export const clubRollover = (club, now = Date.now()) => {
  const dk = dayKey(now)
  if (club.day === dk) return false
  club.day = dk
  club.used = 0
  return true
}

export const challengesLeft = (club) => Math.max(0, CLUB.challengesPerDay - club.used)

// --- Clash ---------------------------------------------------------------
export function startClash(club, now = Date.now()) {
  club.clash = {
    endsAt: now + CLUB.clashDays * DAY,
    tick: now,
    myScore: 0,
    foeScore: 0,
    // Часть позиций изначально за соперником, часть пуста [E] «Empty positions
    // can be claimed immediately without playing a match»: иначе первый заход
    // игрока — восемь бесплатных захватов, и вызовы не нужны вовсе.
    positions: Array.from({ length: CLUB.positions }, (_, i) => ({
      owner: i % 3 === 0 ? null : 'foe', until: 0,
    })),
  }
  return club.clash
}

export const clashActive = (club, now = Date.now()) =>
  !!club.clash && club.clash.endsAt > now

// Очки копятся НЕПРЕРЫВНО, а начисляются лениво — как офлайн-доход: событие
// идёт трое суток, и тикать по таймеру означало бы, что закрытая игра в нём не
// участвует, хотя позиции заняты.
export function accrueClash(club, now = Date.now()) {
  const c = club.clash
  if (!c) return
  const until = Math.min(now, c.endsAt)
  const mins = (until - c.tick) / 60000
  if (mins <= 0) return
  c.tick = until
  c.positions.forEach((p, i) => {
    const pts = CLUB.pointsPerMin[i] ?? 1
    if (p.owner === 'me') c.myScore += pts * mins
    else if (p.owner === 'foe') c.foeScore += pts * mins
  })
}

export const positionProtected = (pos, now = Date.now()) => pos.until > now

// Захват. Пустую позицию берём без боя [E], занятую — серией best-of-3, и
// только если защита истекла. Прежняя позиция игрока освобождается СРАЗУ
// [E] «If you capture a new position, your previous position becomes empty
// immediately» — иначе один игрок держит всю доску.
export function capture(club, index, { off, def, power, rnd, now = Date.now() }) {
  const c = club.clash
  if (!c || !clashActive(club, now)) return { ok: false, why: 'Club Clash has ended' }
  const pos = c.positions[index]
  if (!pos) return { ok: false, why: 'No such position' }
  if (pos.owner === 'me') return { ok: false, why: 'Already yours' }
  if (positionProtected(pos, now)) return { ok: false, why: 'Position is protected' }

  let series = null
  if (pos.owner === 'foe') {
    if (challengesLeft(club) <= 0) return { ok: false, why: 'No Challenges left today' }
    // [E] «A Challenge is used when you start a match series» — списывается до
    // боя, проигрыш его не возвращает.
    club.used++
    // [E] «Each match uses a random sport»: сила соперника вокруг силы игрока,
    // как в арене, иначе исход предопределён.
    series = playSeries(off, def, power * (0.9 + 0.3 * rnd()), rnd)
    if (!series.won) return { ok: false, why: 'Lost the series', series }
  }
  const mine = c.positions.findIndex((p) => p.owner === 'me')
  if (mine >= 0) c.positions[mine] = { owner: null, until: 0 }
  c.positions[index] = { owner: 'me', until: now + CLUB.protectionSec * 1000 }
  return { ok: true, series, points: CLUB.pointsPerMin[index] ?? 1 }
}

// Итог события: кто больше набрал. Награда письмом [E], её выдаёт GameState.
export function settleClash(club, now = Date.now()) {
  const c = club.clash
  if (!c || c.endsAt > now) return null
  accrueClash(club, now)
  const won = c.myScore >= c.foeScore
  club.clash = null
  return {
    won,
    myScore: Math.round(c.myScore),
    foeScore: Math.round(c.foeScore),
    rewards: won ? CLUB.winRewards : CLUB.loseRewards,
  }
}

// Предсказанная награда [E] «Your current predicted reward is shown during the
// event and updates as the score changes».
export const predictedRewards = (club) => {
  const c = club.clash
  if (!c) return []
  return c.myScore >= c.foeScore ? CLUB.winRewards : CLUB.loseRewards
}

export const clashWinChance = (off, def, power) =>
  duelProb(racerShape(off, def), opponentShape(power))
