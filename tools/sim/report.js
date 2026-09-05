import './headless.js'
import { simulate } from './simulate.js'
import { fastSim } from './fastsim.js'
import { POLICIES } from './policies.js'
import { CLASS_PLANS, switchRoi } from './classplan.js'
import { milestoneTargets, unlockSec } from './targets.js'
import { CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'

const HOURS = Number(process.argv[2] || 700)

const money = (n) => {
  const abs = Math.abs(n)
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  return '$' + n.toFixed(1)
}
const dur = (s) => {
  if (s == null) return 'не дошёл'
  if (s >= 86400) return (s / 86400).toFixed(1) + 'д'
  if (s >= 3600) return (s / 3600).toFixed(1) + 'ч'
  return Math.round(s / 60) + 'м'
}
const pad = (s, n) => String(s).padStart(n)
const levelsOf = (run) => Object.values(run.state.cls.levels).reduce((a, b) => a + b, 0)
const allLevels = (run) => Object.values(run.state.classes)
  .reduce((a, c) => a + Object.values(c.levels).reduce((x, y) => x + y, 0), 0)

// 1. Быстрая модель должна совпадать с полной симуляцией, иначе подбор врёт.
console.log('=== сверка моделей на 2ч ===')
const full = simulate({ hours: 2, policy: POLICIES.cheapestFirst })
const fast = fastSim({ hours: 2, policy: POLICIES.cheapestFirst })
console.log(`  полная:  заработано ${pad(money(full.earned), 10)} | побед ` +
  `${pad((100 * full.places[1] / full.races).toFixed(1), 5)}% | уровней ${levelsOf(full)}`)
console.log(`  быстрая: заработано ${pad(money(fast.earned), 10)} | побед ` +
  `${pad((100 * fast.places[1] / fast.races).toFixed(1), 5)}% | уровней ${levelsOf(fast)}`)

// 2. Прогрессия на всю жизнь игрока — по политикам закупки. Класс при этом
// ведёт switchRoi: играть 700 часов одним классом из шести — не «базовая
// стратегия», а отказ от половины игры, и мерить политики закупки на ней
// значит мерить не ту игру.
const runs = {}
for (const [name, policy] of Object.entries(POLICIES)) {
  const r = fastSim({ hours: HOURS, policy, classPlan: switchRoi })
  runs[name] = r
  const podium = r.places[1] + r.places[2] + r.places[3]

  console.log(`\n=== ${name} — ${HOURS}ч =================================`)
  console.log(`гонок ${r.races} | побед ${(100 * r.places[1] / r.races).toFixed(1)}% ` +
    `| подиум ${(100 * podium / r.races).toFixed(1)}% | покупок ${r.purchases}`)
  console.log(`заработано ${money(r.earned)} | класс ${r.state.clsDef.index} | ` +
    `лига ${r.state.cls.league} | уровней ${allLevels(r)} | ` +
    `фанатов ${Math.round(r.state.cls.fans)}`)
  const squad = r.state.roster.squad(r.state.activeClass)
    .map((d) => d.rarity.slice(0, 3) + Math.round((d.off + d.def) / 2) +
      (d.stars ? '*' + d.stars : '') + (d.level ? '+' + d.level : ''))
  console.log(`паков ${r.draws} | состав ${squad.join(' ')}`)
  // Магазин отчитывается ДОЛЕЙ ГЕМОВ, а не только суммой: гемы — общий кошелёк
  // паков и гачи, и «магазин съел вторую ось силы» выглядит по деньгам ровно
  // так же, как «магазин никому не нужен».
  const gemsTotal = r.gemsShop + r.gemsPacks
  console.log(`магазин: сделок ${r.deals} | выдал ${money(r.shopCash)} ` +
    `(${(100 * r.shopCash / Math.max(1, r.earned)).toFixed(1)}% дохода) | ` +
    `гемов в магазин ${(100 * r.gemsShop / Math.max(1, gemsTotal)).toFixed(0)}%, ` +
    `в гачу ${(100 * r.gemsPacks / Math.max(1, gemsTotal)).toFixed(0)}%`)

  // Две колонки намеренно: «накопил» — когда денег стало достаточно, «открыл» —
  // когда игрок действительно перешёл. Расхождение и есть цена перехода.
  console.log('  разблокировка класса:      цель    накопил     открыл')
  for (const t of milestoneTargets()) {
    console.log(`    ${pad(money(t.price), 9)}  ${pad(t.label, 8)}  ` +
      `${pad(dur(r.milestones[t.price]), 9)}  ${pad(dur(unlockSec(r, t.price)), 9)}`)
  }

  console.log('    час |      $/с   |      всего | кл | сила | лига | ур.')
  let shown = 0
  for (const s of r.samples) {
    const h = s.sec / 3600
    if (h < 1 ? s.sec % 1800 : h < 24 ? s.sec % 14400 : s.sec % 86400) continue
    if (shown++ > 18) break
    console.log(`    ${pad(h.toFixed(1), 3)} | ${pad(money(s.incomePerSec), 10)} | ` +
      `${pad(money(s.earned), 10)} | ${pad(s.cls, 2)} | ${pad(Math.round(s.power), 4)} | ` +
      `${pad(s.league, 4)} | ${pad(s.levels, 3)}`)
  }
}

// 3. Стратегии смены класса — ось, которой у стенда не было до этого шага.
// Порядок покупок внутри класса не решает ничего (замер — tools/sim/why.js),
// а вот КОГДА переезжать — единственный настоящий размен: фанаты, лига и
// карьера обнуляются, взамен приток идёт множителем классa.
console.log(`\n=== стратегии смены класса (cheapestFirst) — ${HOURS}ч ===`)
console.log('        план | заработано | класс | лига | побед |  переходы')
for (const [name, plan] of Object.entries(CLASS_PLANS)) {
  const r = plan === switchRoi
    ? runs.cheapestFirst
    : fastSim({ hours: HOURS, policy: POLICIES.cheapestFirst, classPlan: plan })
  console.log(`  ${pad(name, 10)} | ${pad(money(r.earned), 10)} | ` +
    `${pad(r.state.clsDef.index, 5)} | ${pad(r.state.cls.league, 4)} | ` +
    `${pad((100 * r.places[1] / r.races).toFixed(1) + '%', 5)} | ` +
    r.switches.map((s) => dur(s.sec) + '→' + s.to).join(' '))
}

console.log('\nцены разблокировки:', CLASS_UNLOCK_PRICES.map(money).join('  '))
