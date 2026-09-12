import './headless.js'
import { clock } from './headless.js'
import { GameState } from '../../src/systems/GameState.js'
import { ARENA, CLUB } from '../../src/config/compete.js'
import { LUCKY, COLLECTION } from '../../src/config/extras.js'

// Проверка КАЛЕНДАРНЫХ механик шагов 8-9. Отдельная команда, потому что ни
// smoke, ни балансный прогон их не проверяют: smoke не умеет переводить часы, а
// `npm run sim` не разделяет периоды — он просто крутит 700 часов подряд.
//
// Здесь решает именно календарь, и он РАЗНЫЙ: сутки арены кончаются в 05:00 UTC
// [E], сутки клуба и задач — в полночь, сетка Lucky Draw живёт неделю, сезон
// коллекций — две. Один неверный ключ означает, что счётчик не обнуляется
// вовсе, и поймать это можно только переводом часов.

const HOUR = 3600000
const DAY = 24 * HOUR

let failed = 0
const check = (name, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
}

const fresh = () => { clock.reset(); localStorage.clear(); return new GameState() }

// --- Арена: тикеты и сброс в 05:00 UTC -----------------------------------
{
  const s = fresh()
  check('арена стартует с 3 тикетами', s.arena.tickets === ARENA.ticketsRefill,
    `${s.arena.tickets}`)

  // Три матча подряд должны съесть все тикеты, четвёртый — отказать.
  let played = 0
  while (s.playArena(0)) played++
  check('тикетов хватает ровно на 3 матча', played === ARENA.ticketsRefill, `${played}`)
  const medals = s.arena.medalsToday
  check('медали за день накопились', medals > 0, `${medals}`)

  // Лишние тикеты держатся до сброса [E] «they remain until reset».
  s.arena.tickets += 2
  clock.advance(2 * HOUR)
  check('лишние тикеты не сгорают до сброса', s.arena.tickets === 2, `${s.arena.tickets}`)

  // Перевод за границу 05:00 UTC: виртуальная эпоха — 2026-01-01 09:00 UTC,
  // значит до следующего сброса 20 часов.
  const mailBefore = s.mailList.length
  clock.advance(21 * HOUR)
  const a = s.arena
  check('сброс обнулил дневные медали', a.medalsToday === 0, `${a.medalsToday}`)
  check('тикеты пополнились ДО трёх, лишние удалены',
    a.tickets === ARENA.ticketsRefill, `${a.tickets}`)
  check('награда за ранг пришла письмом [E]', s.mailList.length > mailBefore,
    `${mailBefore} -> ${s.mailList.length}`)
  check('накопленные медали остались', a.medals >= medals, `${a.medals}`)
}

// --- Клуб: вызовы суток и итог события -----------------------------------
{
  const s = fresh()
  s.gems = 1000
  check('в клуб пускают по силе [E]', s.joinClub(0))
  check('событие запускается', s.startClash())
  check('вызовов в сутки = 3 [E]', s.clubChallengesLeft === CLUB.challengesPerDay,
    `${s.clubChallengesLeft}`)

  // Пустая позиция берётся без боя и без вызова [E].
  const free = s.club.clash.positions.findIndex((p) => p.owner === null)
  const res = s.capturePosition(free)
  check('пустая позиция берётся без вызова',
    res.ok && s.clubChallengesLeft === CLUB.challengesPerDay, JSON.stringify(res.ok))

  // Захваченная позиция защищена таймером [E].
  const mine = s.club.clash.positions.findIndex((p) => p.owner === 'me')
  check('своя позиция защищена', s.club.clash.positions[mine].until > Date.now())

  // Очки копятся со временем [E] «generate points over time».
  // Читаем СЫРОЕ состояние (state.compete), а не через геттер `club`: геттер
  // идёт через `comp`, который сам начисляет, и «до» оказалось бы равно «после».
  // Первая версия проверки этим и провалилась — 300 против 300.
  const before = s.compete.club.clash.myScore
  clock.advance(30 * 60000)
  void s.comp
  check('очки позиции капают', s.club.clash.myScore > before,
    `${before.toFixed(0)} -> ${s.club.clash.myScore.toFixed(0)}`)

  // Сутки: вызовы обнуляются.
  s.club.used = CLUB.challengesPerDay
  clock.advance(DAY)
  void s.comp
  check('вызовы обнулились через сутки', s.clubChallengesLeft === CLUB.challengesPerDay,
    `${s.clubChallengesLeft}`)

  // Конец события: награда письмом [E].
  const mailBefore = s.mailList.length
  clock.advance(CLUB.clashDays * DAY)
  void s.comp
  check('событие закрылось', !s.clashOn)
  check('награда Club Clash пришла письмом', s.mailList.length > mailBefore,
    `${mailBefore} -> ${s.mailList.length}`)
}

// --- Lucky Draw: сетка вычерпывается и обновляется ------------------------
{
  const s = fresh()
  s.gems = LUCKY.drawGems * LUCKY.prizes.length + 100
  let draws = 0
  while (s.playLucky()) draws++
  check('сетка вычерпывается без повторов [E]', draws === LUCKY.prizes.length,
    `${draws} из ${LUCKY.prizes.length}`)
  check('пустая сетка не крутится', s.luckyLeftNow === 0)
  s.gems = 1000
  clock.advance(LUCKY.resetDays * DAY + HOUR)
  check('сетка обновилась через неделю', s.luckyLeftNow === LUCKY.prizes.length,
    `${s.luckyLeftNow}`)
}

// --- Коллекции: сезон сгорает --------------------------------------------
{
  const s = fresh()
  // Паки приходят за заезды, не за гемы [E].
  for (let i = 0; i < COLLECTION.packEveryRaces; i++) s.trackCollection()
  check('пак коллекции пришёл за заезды', s.collectionState.packs === 1,
    `${s.collectionState.packs}`)
  s.openCollectionPack()
  const owned = s.albums.reduce((a, al) => a + al.have, 0)
  check('карты выдались', owned > 0, `${owned}`)
  const season = s.collectionState.season
  clock.advance(COLLECTION.seasonDays * DAY + HOUR)
  const after = s.albums.reduce((a, al) => a + al.have, 0)
  check('сезон сменился', s.collectionState.season === season + 1,
    `${season} -> ${s.collectionState.season}`)
  check('незабранное сгорело вместе с сезоном', after === 0, `${after}`)
}

// --- Слоты гира открываются пробегом -------------------------------------
{
  const s = fresh()
  check('на старте открыто 3 слота гира', s.gearOpenSlots === 3, `${s.gearOpenSlots}`)
  s.cls.races = 10000
  check('к концу игры открыты все 10', s.gearOpenSlots === 10, `${s.gearOpenSlots}`)
  check('слоты состава растут с классами [F: STARTERS (9)]', s.seats === 5, `${s.seats}`)
}

console.log(failed ? `\nПРОВАЛ: ${failed}` : '\nвсё ок')
process.exit(failed ? 1 : 0)
