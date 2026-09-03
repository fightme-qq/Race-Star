import './headless.js'
import { fastSim } from './fastsim.js'
import { POLICIES, ratePerSec } from './policies.js'
import { ECONOMY, RACE } from '../../src/config/balance.js'
import { CLASS_BY_ID } from '../../src/config/classes.js'

// Диагностика вырождения политик. Стенд заводился ради того, чтобы просчитанная
// игра отличалась от наивной; когда cheapestFirst и roiGreedy сходятся в точку,
// сравнивать нечего, и надо понять — совпадает набор покупок или совпадает
// только итог. Это разные болезни: первая лечится оценщиком, вторая — дизайном.
//
// Печатаем три вещи:
//   1. поуровневый расклад по слотам у каждой политики (совпал ли НАБОР);
//   2. из чего сложен приток денег (пассив / приз / плоские выплаты);
//   3. эластичность итога по деньгам — во сколько раз вырастет конечное
//      состояние, если игроку с первой секунды дать множитель к доходу.
// Третье и есть проверка на «логарифмическое бутылочное горлышко»: если x8 к
// деньгам даёт +5% к итогу, то ЛЮБОЕ преимущество политики съедается, и
// вырождение сидит в форме экономики, а не в боте.

const HOURS = Number(process.argv[2] || 700)
const money = (n) => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? '$' + (n / 1e3).toFixed(2) + 'K' : '$' + n.toFixed(1)
const pad = (s, n) => String(s).padStart(n)

const SLOTS = CLASS_BY_ID.racing.upgrades.map((u) => u.key)

// Прогон намеренно идёт БЕЗ смены класса (classPlan по умолчанию — stayFirst):
// этот файл отвечает на вопрос «решает ли что-нибудь порядок покупок ВНУТРИ
// класса», и примешивать сюда вторую ось значило бы получить разницу и не
// знать, чем она вызвана. Ответ — не решает; с классами политики расходятся,
// но уже по другой причине (см. npm run sim, таблица стратегий).
console.log(`=== расклад покупок по слотам (без смены класса), ${HOURS}ч ===`)
console.log('                 ' + SLOTS.map((k) => pad(k, 5)).join('') + '   итог')
const runs = {}
for (const [name, policy] of Object.entries(POLICIES)) {
  const r = fastSim({ hours: HOURS, policy })
  runs[name] = r
  const lv = SLOTS.map((k) => r.state.cls.levels[k] || 0)
  console.log(pad(name, 15) + '  ' + lv.map((v) => pad(v, 5)).join('') +
    '   ' + pad(money(r.earned), 9) + ' | лига ' + r.state.cls.league)
}

// Совпал ли набор побайтно — это ответ на «оценщик слеп» против «выбора нет».
const key = (r) => SLOTS.map((k) => r.state.cls.levels[k] || 0).join(',')
const same = key(runs.cheapestFirst) === key(runs.roiGreedy)
console.log(`\nнаборы cheapestFirst и roiGreedy ${same ? 'СОВПАДАЮТ' : 'различаются'}` +
  ' — ' + (same ? 'порядок покупок не решает ничего' : 'выбор есть, различие в итоге'))

// --- Из чего сложен приток -------------------------------------------------
console.log('\n=== структура притока (cheapestFirst) ===')
console.log('   час |     пассив |       приз |   плоские |  приз/пассив')
for (const s of runs.cheapestFirst.samples) {
  const h = s.sec / 3600
  if (h < 1 ? s.sec % 1800 : h < 24 ? s.sec % 14400 : s.sec % 172800) continue
  if (h > HOURS) break
  // Доля приза считается той же формулой, что в RaceRewards: приз = доход *
  // prizeSeconds * коэф. места * лига^множитель, приведённый к секунде.
  const prizePerSec = s.incomePerSec * ECONOMY.prizeSeconds * 0.45
    * Math.pow(ECONOMY.leaguePrizeMult, s.league) / RACE.durationSec
  console.log(`  ${pad(h.toFixed(1), 5)} | ${pad(money(s.incomePerSec), 10)} | ` +
    `${pad(money(prizePerSec), 10)} | ${pad(s.league, 9)} | ` +
    pad((prizePerSec / s.incomePerSec).toFixed(2), 12))
}

// --- Эластичность итога по деньгам -----------------------------------------
// Множитель вешаем на призовые: это единственный рычаг, который можно крутить,
// не трогая ни одной наблюдённой [F] величины. Играет тот же cheapestFirst.
console.log('\n=== эластичность: во сколько раз итог растёт от денег ===')
console.log('  множитель приза | заработано | ур. Grandstands | эластичность')
const basePrize = ECONOMY.prizeSeconds
let ref = null
for (const mult of [1, 2, 4, 8, 32]) {
  ECONOMY.prizeSeconds = basePrize * mult
  const r = fastSim({ hours: HOURS, policy: POLICIES.cheapestFirst })
  if (ref === null) ref = r.earned
  // Эластичность d(ln итог)/d(ln деньги): 1.0 — деньги переходят в итог один к
  // одному, 0 — итог упёрся в потолок и деньги не решают ничего.
  const el = mult === 1 ? 1 : Math.log(r.earned / ref) / Math.log(mult)
  console.log(`  ${pad('x' + mult, 15)} | ${pad(money(r.earned), 10)} | ` +
    `${pad(r.state.cls.levels.e2 || 0, 15)} | ${pad(el.toFixed(2), 12)}`)
}
ECONOMY.prizeSeconds = basePrize
