import { BRACKET, BRACKET_REWARDS, CUP } from '../config/compete.js'
import { ECONOMY } from '../config/balance.js'
import { racerShape, opponentShape, duelProb } from './RaceModel.js'
import { mulberry32 } from '../utils/rng.js'

// Сетка на выбывание: турнир лиги, недельный турнир и кубок — одна механика с
// разными поводами. [E] «you compete in a bracket», «Each match is played as a
// best-of-three», «To advance in the bracket, you need to win the match»,
// раунды `Quarter-Final` / `Semi-Final` / `Final`.
//
// Три сущности на одном коде намеренно: разойдись они — и недельный турнир стал
// бы платить по другой формуле, чем турнир лиги, причём молча. Отличаются они
// только тем, откуда берётся сила поля и что написано на заголовке.

const ROUNDS = BRACKET.roundNames.length   // 3 раунда = сетка на 8

export const freshBracket = () => ({
  key: null,          // ключ периода: сезон класса / номер недели / ступень кубка
  registered: false,
  round: 0,
  alive: true,
  place: null,
  raceAt: 0,          // на какой гонке класса открывается следующий раунд
  log: [],            // [E] `Reveal Results` — что показать игроку
})

// Поле соперников выводится из ключа, а не хранится: восемь строк на каждый из
// трёх турниров — это 24 записи в сейве ради того, что однозначно считается
// (та же причина, что у rivalNames).
export function bracketField(key, basePower, names) {
  const rnd = mulberry32(((key || 1) * 2246822519) >>> 0)
  return Array.from({ length: BRACKET.size - 1 }, (_, i) => ({
    name: names[(Math.floor(rnd() * names.length) + i * 3) % names.length],
    // Разброс поля [X]: от явно слабее до явно сильнее, иначе сетка решается
    // первым же раундом и «best-of-three» ничего не значит.
    power: basePower * (0.78 + 0.52 * ((i + 1) / BRACKET.size) + 0.18 * rnd()),
  }))
}

// Соперник раунда: чем дальше, тем сильнее. Берём из поля по индексу раунда —
// так порядок воспроизводим и не зависит от того, когда игрок открыл экран.
export const roundOpponent = (field, round) =>
  field[Math.min(field.length - 1, Math.floor(field.length / 2) + round * 2)]

// Серия до двух побед из трёх [E]. Возвращает историю заездов: её показывает
// экран (`Reveal Results`), и без неё best-of-3 визуально не отличим от одного
// матча.
export function playSeries(off, def, oppPower, rnd) {
  const chance = duelProb(racerShape(off, def), opponentShape(oppPower))
  const games = []
  let mine = 0
  let theirs = 0
  while (mine < BRACKET.winsNeeded && theirs < BRACKET.winsNeeded) {
    const won = rnd() < chance
    games.push(won)
    if (won) mine++
    else theirs++
  }
  return { won: mine >= BRACKET.winsNeeded, games, chance }
}

export const roundName = (round) => BRACKET.roundNames[Math.min(round, ROUNDS - 1)]

// Место по тому, где выбили: проиграл четвертьфинал — 8-й, полуфинал — 4-й,
// финал — 2-й, выиграл финал — 1-й.
export const placeForRound = (round, won) => {
  if (won && round >= ROUNDS - 1) return 1
  return BRACKET.size / Math.pow(2, round)
}

export const rewardsForPlace = (place, leagueIdx = 0) => {
  const row = BRACKET_REWARDS.find((r) => place <= r.place) ?? BRACKET_REWARDS.at(-1)
  // Множитель лиги — тот же, что у призовых: иначе поздний игрок перестаёт
  // заходить в турнир, где платят как в ROOKIE.
  const mult = Math.pow(ECONOMY.leaguePrizeMult, leagueIdx) ** 0.5
  return row.rewards.map((r) => ({ ...r, amount: Math.max(1, Math.round(r.amount * mult)) }))
}

// Регистрация. [E] `You are already registered`, `Not registered`,
// `Remember to register again for each new Weekly Tournament` — то есть
// регистрация сбрасывается вместе с периодом.
export function registerBracket(b, key, raceNow) {
  if (b.key === key && b.registered) return false
  if (b.key !== key) Object.assign(b, freshBracket())
  b.key = key
  b.registered = true
  b.alive = true
  b.round = 0
  b.place = null
  b.raceAt = raceNow + BRACKET.racesPerRound
  b.log = []
  return true
}

export const bracketReady = (b, raceNow) =>
  b.registered && b.alive && b.place === null && raceNow >= b.raceAt

// Один раунд. Вызывается, когда набрано нужное число заездов: [E] «Your bracket
// shows each matchup and when the next round will be revealed» — в оригинале это
// расписание, у нас пробег, потому что календаря события у нас нет.
export function advanceBracket(b, { off, def, field, raceNow, rnd }) {
  if (!bracketReady(b, raceNow)) return null
  const opp = roundOpponent(field, b.round)
  const res = playSeries(off, def, opp.power, rnd)
  b.log.unshift({ round: b.round, name: opp.name, ...res })
  if (b.log.length > 6) b.log.length = 6
  if (!res.won) {
    b.alive = false
    b.place = placeForRound(b.round, false)
  } else if (b.round >= ROUNDS - 1) {
    b.place = 1
  } else {
    b.round++
    b.raceAt = raceNow + BRACKET.racesPerRound
  }
  return { ...res, opponent: opp, round: b.round, place: b.place, name: opp.name }
}

// --- Кубок ---------------------------------------------------------------
// [E] В билде кубок один — `Stock Car Cup`, награда постоянная рамка
// (`A permanent trophy for conquering the Bronze Stock Car Cup.`). Поэтому у
// кубка ступени, а не сезоны: взял Bronze — открылась Silver, и так до Diamond.
// `attempt` входит в ключ сетки, и это НЕ украшение. Без него кубок —
// единственная из трёх сеток, у которой период не обновляется сам: турнир лиги
// сбрасывается сезоном, недельный — неделей, а ключ кубка это (ступень, класс).
// Значит после первого же вылета `registerBracket` отказывал навсегда, и
// ступень стояла мёртвой до конца игры. Прогон на 200ч это и показал: кубок
// остался на Bronze, хотя силы хватало. Счётчик попыток делает вылет
// повторяемым, а победа всё равно двигает ступень.
export const freshCup = () => ({ tier: 0, attempt: 0, taken: [], bracket: freshBracket() })

export const cupTierOpen = (cup, league) =>
  cup.tier < CUP.tiers.length && league >= CUP.tierLeague[cup.tier]

export const cupTierName = (cup, className) =>
  `${CUP.tiers[Math.min(cup.tier, CUP.tiers.length - 1)]} ${className} Cup`

export function cupTaken(cup, className) {
  const name = `${CUP.tiers[cup.tier]} ${className} Cup Frame`
  cup.taken.push(name)
  cup.tier = Math.min(CUP.tiers.length, cup.tier + 1)
  cup.attempt = 0
  cup.bracket = freshBracket()
  return name
}

// Вылет: попытка считается израсходованной, ключ меняется, и в следующую
// регистрацию игрока пустят снова на ту же ступень.
export function cupFailed(cup) {
  cup.attempt++
  cup.bracket = freshBracket()
}
