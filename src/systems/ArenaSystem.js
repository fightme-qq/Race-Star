import { ARENA, ARENA_LEAGUES, ARENA_RANK_REWARDS } from '../config/compete.js'
import { racerShape, opponentShape, duelProb } from './RaceModel.js'
import { mulberry32 } from '../utils/rng.js'

// Champions Arena. Чистая математика, без объектов сцены (правило 2).
//
// Сутки арены НЕ совпадают с сутками задач: [E] «Your tickets refill to 3 every
// day at 5:00 AM UTC». Поэтому у арены свой ключ дня, а не ведро в rw — общая
// граница означала бы, что подпись «refills in» на двух экранах врёт на пять
// часов (ровно та причина, по которой счётчики магазина, наоборот, в rw: у них
// граница та же).
const DAY = 86400000
const OFFSET = () => ARENA.resetHourUtc * 3600000

export const arenaDayKey = (now = Date.now()) => Math.floor((now - OFFSET()) / DAY)

export const arenaResetInSec = (now = Date.now()) =>
  ((arenaDayKey(now) + 1) * DAY + OFFSET() - now) / 1000

export const freshArena = (now = Date.now()) => ({
  key: arenaDayKey(now),
  tickets: ARENA.ticketsRefill,
  medalsToday: 0,
  medals: 0,               // накопленные: по ним лига [E]
  league: 0,
  refreshes: 0,
  pick: 0,                 // номер выборки соперников (меняется при Refresh)
  history: [],             // последние матчи для вкладки `History` [E]
})

// Бот-поле суток: у каждого соперника свои медали за день. Нужно для ранга
// [E] «Your rank is based on the total Medals you earn each day». Выводится из
// ключа дня, а не хранится: 50 строк в сейве ради числа, которое однозначно
// считается, — лишний вес и лишний повод для рассинхрона (как rivalNames).
const FIELD = 50

function fieldMedals(key, leagueIdx) {
  const rnd = mulberry32((key * 2654435761 + leagueIdx * 97) >>> 0)
  const peak = ARENA.medalsWin * (3 + leagueIdx * 1.6)
  return Array.from({ length: FIELD }, () => Math.round(peak * (0.25 + 1.5 * rnd() * rnd())))
}

// Ранг игрока: сколько ботов набрало больше. 1-й — значит никто.
export function arenaRank(arena) {
  const field = fieldMedals(arena.key, arena.league)
  return 1 + field.filter((m) => m > arena.medalsToday).length
}

export const arenaLeague = (arena) => ARENA_LEAGUES[Math.min(arena.league, ARENA_LEAGUES.length - 1)]
export const arenaNextLeague = (arena) => ARENA_LEAGUES[arena.league + 1] || null

// Лига — по НАКОПЛЕННЫМ медалям, ранг — по дневным. В попапе это два разных
// предложения, и слить их в одно значило бы, что лига падает каждое утро.
export function arenaLeagueFor(medals) {
  let idx = 0
  ARENA_LEAGUES.forEach((l, i) => { if (medals >= l.medals) idx = i })
  return idx
}

const rewardsForRank = (rank) =>
  ARENA_RANK_REWARDS.find((r) => rank <= r.upTo)?.rewards ?? []

// Сброс суток. Возвращает награды за прошедший день — их отправляет письмом
// GameState [E] «Rewards ... are sent via in-game mail».
export function arenaRollover(arena, now = Date.now()) {
  const key = arenaDayKey(now)
  if (arena.key === key) return null
  const rank = arenaRank(arena)
  const rewards = arena.medalsToday > 0 ? rewardsForRank(rank) : []
  arena.key = key
  arena.medalsToday = 0
  // [E] «any extra Arena Tickets are removed» — именно ДО трёх, а не +3.
  arena.tickets = ARENA.ticketsRefill
  arena.refreshes = 0
  arena.pick++
  arena.league = arenaLeagueFor(arena.medals)
  return rewards.length ? { rank, rewards } : null
}

// Трое соперников [E] `Select an opponent`. Сила — вокруг силы игрока
// (ARENA.spread): иначе показанный `Win Chance` всегда 1% или 99%, и выбор,
// который экран прямо предлагает сделать, становится бессмысленным.
export function arenaOpponents(arena, power, names) {
  const rnd = mulberry32((arena.key * 40503 + arena.pick * 7919) >>> 0)
  return ARENA.spread.map((s, i) => {
    const jitter = 0.92 + 0.16 * rnd()
    const oppPower = Math.max(1, power * s * jitter)
    return {
      index: i,
      name: names[(Math.floor(rnd() * names.length) + i) % names.length],
      power: oppPower,
      // Статы соперника показываются [E] `Opponent Stats`: половина на половину,
      // как у соперников трассы (opponentShape).
      off: oppPower / 2,
      def: oppPower / 2,
    }
  })
}

// Шанс победы — тем же `duelProb`, что и решает бой (правило 16).
export const arenaWinChance = (off, def, oppPower) =>
  duelProb(racerShape(off, def), opponentShape(oppPower))

export function arenaRefresh(arena) {
  if (arena.refreshes >= ARENA.refreshes) return false
  arena.refreshes++
  arena.pick++
  return true
}

// Матч. Тикет списывается ДО боя [E] «A Challenge is used when you start a
// match series» — у клуба это сказано прямо, у арены «Each match costs 1 Arena
// Ticket»; проигрыш тикет не возвращает, иначе их лимит ничего не ограничивает.
export function arenaMatch(arena, off, def, opp, rnd) {
  if (arena.tickets < ARENA.ticketCost) return null
  arena.tickets -= ARENA.ticketCost
  const chance = arenaWinChance(off, def, opp.power)
  const won = rnd() < chance
  const medals = won ? ARENA.medalsWin : ARENA.medalsLoss
  arena.medalsToday += medals
  arena.medals += medals
  const before = arena.league
  arena.league = arenaLeagueFor(arena.medals)
  arena.history.unshift({ name: opp.name, won, medals, chance })
  if (arena.history.length > 10) arena.history.length = 10
  return { won, medals, chance, promoted: arena.league > before, rank: arenaRank(arena) }
}

// Строки таблицы `Rankings` [E]: игрок внутри бот-поля, отсортированного по
// дневным медалям. Показываем окно вокруг игрока, а не первые десять: в
// Bronze-лиге игрок почти всегда вне топа, и пустая для него таблица читалась
// бы как сломанная.
export function arenaRankings(arena, playerName, limit = 10) {
  const field = fieldMedals(arena.key, arena.league).map((m, i) => ({
    name: `Racer ${((arena.key + i * 37) % 900) + 100}`, medals: m, me: false,
  }))
  field.push({ name: playerName, medals: arena.medalsToday, me: true })
  field.sort((a, b) => b.medals - a.medals)
  const myIdx = field.findIndex((r) => r.me)
  const from = Math.max(0, Math.min(myIdx - Math.floor(limit / 2), field.length - limit))
  return field.slice(from, from + limit).map((r, i) => ({ ...r, rank: from + i + 1 }))
}
