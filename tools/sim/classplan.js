import { ECONOMY, RACE, LEAGUES, CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'
import { RACE_CLASSES } from '../../src/config/classes.js'
import { racerShape, placeDist } from '../../src/systems/RaceModel.js'
import { reachableLeague } from './policies.js'

// СТРАТЕГИИ СМЕНЫ КЛАССА — то, чего у стенда не было вовсе.
//
// До этого файла прогон шёл 700 часов одним классом (racing, index 0) и не
// платил НИ ОДНОЙ цены разблокировки, хотя все пять вех из targets.js — это
// ровно `CLASS_UNLOCK_PRICES`. То есть подбирали «за сколько игрок накопит на
// класс», а не «за сколько он до него дойдёт», и `classFanMult` — множитель
// притока фанатов x3.2 за индекс класса — вообще не входил в прогон (это прямо
// записано в SPACE у tune.js).
//
// Смена класса — единственный настоящий размен в игре, потому что она НЕ
// бесплатна: лига, карьерный драйвер и уровни апгрейдов у каждого класса свои
// и начинаются с нуля, а взамен приток фанатов идёт множителем
// classFanMult^index. Это классическая развилка идлера («престиж»): рано —
// потеряешь накопленное, поздно — не успеешь разогнать.
//
// ЧТО ИМЕННО ТЕРЯЕТСЯ — переписано на шаге «параллельный доход». Раньше:
// фанаты обнулялись и доход падал к полу $1/с [F]. Теперь покинутый класс
// продолжает платить долю idleClassShare, но НЕ ЕДЕТ — значит его фанаты
// заморожены (расти перестают) и призов он больше не приносит. Размен из-за
// этого не исчез, но стал тоньше, и цена ошибки держится именно долей: при
// доле 1 переход бесплатен и решать становится нечего (замер — $3.23T против
// $3.23T у наивного плана).
// Порядок покупок внутри класса такого размена не даёт: бот тратит деньги в
// ноль, и обе политики выходят на один и тот же фронт доступного (замер —
// tools/sim/why.js).

// Классы открываются строго по порядку индекса — цена следующего берётся из
// CLASS_UNLOCK_PRICES по его же индексу.
function nextLocked(state) {
  for (const c of RACE_CLASSES) if (!state.classes[c.id].unlocked) return c
  return null
}

// Средний коэффициент фанатов за место при данной силе и лиге.
const fansCoef = (off, def, leaguePower) =>
  placeDist(racerShape(off, def), leaguePower)
    .reduce((acc, p, k) => acc + p * ECONOMY.placeFans[k], 0)

const prizeCoef = (off, def, leaguePower, league) =>
  placeDist(racerShape(off, def), leaguePower)
    .reduce((acc, p, k) => acc + p * ECONOMY.placePrize[k], 0)
    * ECONOMY.prizeSeconds * Math.pow(ECONOMY.leaguePrizeMult, league) / RACE.durationSec

// Обе стороны сравниваются в ОДНОЙ И ТОЙ ЖЕ силе и лиге, и это главное решение
// в файле. Соблазн был честнее: у нового класса и уровни апгрейдов нулевые, и
// лига ROOKIE — так и считала первая версия. Обе поправки по отдельности
// выглядели правдой и обе оказались слепотой в смысле правила 15:
//   - лига 0 НАВСЕГДА: множитель призовых 1.45^9 = x28.6 против x1 перевешивал
//     всё, и бот отказывался открывать шестой класс, хотя деньги набирались к
//     14-му дню. На деле состав переезжает с игроком, и лестница проходится
//     заново за считанные сезоны — мгновение на фоне четырёхсотчасового
//     горизонта;
//   - голые статы пятёрки против прокачанных: боевые слоты стоят копейки на
//     фоне накопленного состояния и выкупаются сразу же.
// Что действительно теряется и потому остаётся в сравнении — НАКОПЛЕННЫЕ
// ФАНАТЫ (доход падает к полу $1/с [F]) и цена разблокировки. Против них
// работает множитель класса. Известное упрощение бота: карьерный драйвер тоже
// обнуляется, а он-то отрастает не быстро; бот этого не видит и переходит чуть
// охотнее, чем следовало бы. Ловится итогом прогона, а не оценщиком.
const leagueOf = (state) => {
  const p = state.power
  const lg = Math.max(state.cls.league, Math.round(reachableLeague(racerShape(p.off, p.def))))
  return Math.min(lg, LEAGUES.length - 1)
}

function rates(state, target) {
  const p = state.power
  const lg = leagueOf(state)
  const power = LEAGUES[lg].power
  const rate = state.agg.fansPerRace * fansCoef(p.off, p.def, power)
    * Math.pow(ECONOMY.classFanMult, state.clsDef.index)
  const prize = prizeCoef(p.off, p.def, power, lg)
  const step = Math.pow(ECONOMY.classFanMult, target.index - state.clsDef.index)

  return {
    price: CLASS_UNLOCK_PRICES[target.index],
    cur: { rate, fans: state.cls.fans, prize, frozen: 0 },
    // Накопленные фанаты текущего класса при переходе НЕ пропадают: класс
    // остаётся открытым и капает долей idleClassShare (см. ECONOMY). Но он не
    // едет — значит его фанаты заморожены и призов он больше не приносит.
    // До шага «параллельный доход» здесь стоял ноль, и это было честно: доход
    // падал к полу $1/с. Забыть эту строку сейчас — значит оставить бота в
    // прежней игре и получить отказ от шестого класса по старой причине.
    next: {
      rate: rate * step, fans: 0, prize,
      frozen: state.cls.fans * ECONOMY.idleClassShare,
    },
  }
}

// Сколько денег принесёт ветка за оставшиеся R гонок. Фанаты копятся линейно
// (приток за гонку постоянен между покупками), доход = фанаты / 1188 [~],
// отсюда сумма по гонкам: (F*R + rate*R^2/2) * длительность / 1188.
// Замороженные фанаты платят те же R гонок, но без призовой надбавки.
const project = (side, R) =>
  ((side.fans * R + side.rate * R * R / 2) * (1 + side.prize) + side.frozen * R)
  * RACE.durationSec / ECONOMY.fansPerDollar

function doSwitch(state, target, takeSquad) {
  if (!state.unlockClass(target.id)) return false
  state.activeClass = target.id
  // Состав переставляем ПОСЛЕ смены активного класса: autoManage кормит
  // остатками сильнейшего, а «сильнейший» считается уже в новой команде.
  takeSquad(state, target.id)
  state.simReserve = 0
  return true
}

// Игрок КОПИТ на разблокировку, а бот закупки тратит в ноль каждую гонку.
// Пока резерва не было, класс открывался только в тот кадр, когда цену
// перекрыл единичный приз, — из-за этого switchRoi не доходил до пятого и
// шестого класса вовсе, хотя денег за прогон зарабатывал в разы больше их
// цены. Резерв читают все политики закупки (см. affordable в policies.js).
const reserve = (state, amount) => { state.simReserve = amount; return false }

// --- Стратегии -------------------------------------------------------------

// Ничего не открывать: ровно то поведение, что было у стенда до этого файла.
// Оставлено как точка сравнения — по нему видно, чего стоит сидение в racing.
export const stayFirst = (state) => reserve(state, 0)

// Открывать и переходить, как только хватило денег. Верхняя граница «жадности».
export function switchAsap(state, ctx, takeSquad) {
  const target = nextLocked(state)
  if (!target) return reserve(state, 0)
  const price = CLASS_UNLOCK_PRICES[target.index]
  if (state.cash < price) return reserve(state, price)
  return doSwitch(state, target, takeSquad)
}

// Горизонт решения о переходе — остаток прогона, но НЕ МЕНЬШЕ этого числа.
// Обе половины правила пришлось поставить замером, и обе не декоративны.
//
// Остаток прогона сам по себе — оптимальный горизонт, если цель «заработать за
// 700 часов»: под конец окна переход и правда не окупается. Но 700 часов —
// это окно ИЗМЕРЕНИЯ, а не конец игры: игрок на 26-й день не знает, что через
// трое суток всё кончится. С чистым остатком бот отказывался открывать шестой
// класс вовсе — деньги на него набирались к 14-му дню, а последняя веха стоит
// на 26-м, и окупить её за оставшиеся трое суток проекция не обещала. То есть
// веха была недостижима по построению стенда.
// Фиксированный горизонт вместо остатка тоже не подошёл: при 25000 бот стал
// осторожнее нужного и не дошёл уже до пятого класса ($127B против $158B).
// Отсюда max: ранняя игра решает по остатку, поздняя — по «игра продолжается».
const CLASS_HORIZON_RACES = 25000

// Проекцию пересчитываем не каждую гонку: она стоит двух placeDist и решает
// вопрос, ответ на который меняется за часы, а не за минуту. Наличные при этом
// проверяются каждый раз — иначе накопленный резерв пролежал бы до следующей
// проверки.
const CHECK_EVERY = 20

// Считать, а не спешить: переходим, если проекция нового класса на горизонт
// обгоняет проекцию текущего за вычетом цены разблокировки.
export function switchRoi(state, ctx, takeSquad) {
  const target = nextLocked(state)
  if (!target) return reserve(state, 0)
  if (ctx.race % CHECK_EVERY === 0 || state.simWorth === undefined) {
    const R = Math.max(ctx.totalRaces - ctx.race, CLASS_HORIZON_RACES)
    const r = rates(state, target)
    state.simWorth = project(r.next, R) - r.price > project(r.cur, R)
  }
  // Решение «стоит ли» принимается ДО проверки наличных: пока переход выгоден,
  // но денег не хватает, бот держит цену в резерве и не спускает её в апгрейды.
  if (!state.simWorth) return reserve(state, 0)
  const price = CLASS_UNLOCK_PRICES[target.index]
  if (state.cash < price) return reserve(state, price)
  state.simWorth = undefined
  return doSwitch(state, target, takeSquad)
}

export const CLASS_PLANS = { stayFirst, switchAsap, switchRoi }
