import './headless.js'
import { simulate } from './simulate.js'
import { fastSim } from './fastsim.js'
import { POLICIES } from './policies.js'
import { MILESTONE_TARGETS } from './targets.js'
import { CLASS_UNLOCK_PRICES } from '../../src/config/balance.js'

const HOURS = Number(process.argv[2] || 700)

const money = (n) => {
  const abs = Math.abs(n)
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

// 1. Быстрая модель должна совпадать с полной симуляцией, иначе подбор врёт.
console.log('=== сверка моделей на 2ч ===')
const full = simulate({ hours: 2, policy: POLICIES.cheapestFirst })
const fast = fastSim({ hours: 2, policy: POLICIES.cheapestFirst })
console.log(`  полная:  заработано ${pad(money(full.earned), 10)} | побед ` +
  `${pad((100 * full.places[1] / full.races).toFixed(1), 5)}% | уровней ${levelsOf(full)}`)
console.log(`  быстрая: заработано ${pad(money(fast.earned), 10)} | побед ` +
  `${pad((100 * fast.places[1] / fast.races).toFixed(1), 5)}% | уровней ${levelsOf(fast)}`)

// 2. Прогрессия на всю жизнь игрока — по политикам закупки.
for (const [name, policy] of Object.entries(POLICIES)) {
  const r = fastSim({ hours: HOURS, policy })
  const podium = r.places[1] + r.places[2] + r.places[3]

  console.log(`\n=== ${name} — ${HOURS}ч =================================`)
  console.log(`гонок ${r.races} | побед ${(100 * r.places[1] / r.races).toFixed(1)}% ` +
    `| подиум ${(100 * podium / r.races).toFixed(1)}% | покупок ${r.purchases}`)
  console.log(`заработано ${money(r.earned)} | лига ${r.state.cls.league} | ` +
    `уровней ${levelsOf(r)} | фанатов ${Math.round(r.state.cls.fans)}`)
  const squad = r.state.roster.squad(r.state.activeClass)
    .map((d) => d.rarity.slice(0, 3) + Math.round((d.off + d.def) / 2) +
      (d.stars ? '*' + d.stars : '') + (d.level ? '+' + d.level : ''))
  console.log(`паков ${r.draws} | состав ${squad.join(' ')}`)

  console.log('  разблокировка класса:      цель     вышло')
  for (const t of MILESTONE_TARGETS) {
    console.log(`    ${pad(money(t.price), 9)}  ${pad(t.label, 14)}  ${pad(dur(r.milestones[t.price]), 9)}`)
  }

  console.log('    час |      $/с   |      всего |  сила | состав | лига | ур.')
  let shown = 0
  for (const s of r.samples) {
    const h = s.sec / 3600
    if (h < 1 ? s.sec % 1800 : h < 24 ? s.sec % 14400 : s.sec % 86400) continue
    if (shown++ > 18) break
    console.log(`    ${pad(h.toFixed(1), 3)} | ${pad(money(s.incomePerSec), 10)} | ` +
      `${pad(money(s.earned), 10)} | ${pad(Math.round(s.power), 5)} | ` +
      `${pad(Math.round(s.squad), 6)} | ${pad(s.league, 4)} | ${pad(s.levels, 3)}`)
  }
}

console.log('\nцены разблокировки:', CLASS_UNLOCK_PRICES.map(money).join('  '))
