// Ландшафт расклада offense/defense. Отвечает на один вопрос: существует ли в
// раскладе РЕШЕНИЕ, или одна из сторон — трап при любых обстоятельствах.
//
// Читать так: если строка «лучший расклад» одинакова во всех строках таблицы,
// решения нет — есть просто правильный ответ, и половину слотов можно выкинуть.
// Годная точка — та, где оптимум ЕДЕТ: догоняющему выгодна атака (разброс даёт
// шанс на случайную победу), фавориту — защита (разброс отнимает верную).
//
// Запуск: node tools/sim/split.js [attackWeight] [formSigma]

import { RACE, SEASON } from '../../src/config/balance.js'
import { racerShape, placeDist } from '../../src/systems/RaceModel.js'
import { combatPrice } from '../../src/systems/UpgradeSystem.js'

if (process.argv[2]) RACE.attackWeight = Number(process.argv[2])
if (process.argv[3]) RACE.modeShare = Number(process.argv[3])

const LEAGUE = 400
// Доля атаки в суммарной силе. 0.5 — ровно, 0.8 — почти всё в атаку.
const OFF_SHARES = [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]
const RATIOS = [0.8, 1.0, 1.2, 1.4, 1.6, 1.9, 2.2, 2.6]

const metrics = (ratio, offShare) => {
  const power = LEAGUE * ratio
  const dist = placeDist(racerShape(power * offShare, power * (1 - offShare)), LEAGUE)
  return {
    win: dist[0],
    pts: SEASON.winPoints * dist[0] + SEASON.podiumPoints * (dist[1] + dist[2]),
  }
}

console.log(`attackWeight ${RACE.attackWeight}  ` +
  `modeShare ${RACE.modeShare}  порог повышения ${SEASON.promoteRatio}\n`)

// Очки сезона — то, чем игрок реально платит за лигу, поэтому оптимум ищем по
// ним, а не по доле побед: подиум тоже кормит.
console.log('  очки сезона за гонку по доле атаки (жирная цель — порог повышения)')
console.log('  сила/лига  ' + OFF_SHARES.map((s) => String(Math.round(s * 100)).padStart(6)).join('') +
  '   лучший')
for (const ratio of RATIOS) {
  const row = OFF_SHARES.map((s) => metrics(ratio, s))
  const best = row.reduce((b, m, i) => (m.pts > row[b].pts ? i : b), 0)
  const cells = row.map((m, i) => (i === best ? '*' : ' ') + m.pts.toFixed(2).padStart(5)).join('')
  console.log(`  ${ratio.toFixed(1).padStart(9)}  ${cells}   атака ${Math.round(OFF_SHARES[best] * 100)}%`)
}

console.log('\n  доля побед по доле атаки')
console.log('  сила/лига  ' + OFF_SHARES.map((s) => String(Math.round(s * 100)).padStart(6)).join(''))
for (const ratio of RATIOS) {
  const cells = OFF_SHARES.map((s) => (100 * metrics(ratio, s).win).toFixed(1).padStart(6)).join('')
  console.log(`  ${ratio.toFixed(1).padStart(9)}  ${cells}`)
}

console.log('\n  разброс между лучшим и худшим раскладом, % очков сезона')
for (const ratio of RATIOS) {
  const row = OFF_SHARES.map((s) => metrics(ratio, s).pts)
  const hi = Math.max(...row)
  const lo = Math.min(...row)
  console.log(`  сила/лига ${ratio.toFixed(1)}  ${(100 * (hi / lo - 1)).toFixed(1)}%`)
}

// --- Главный замер: расклад ЗА ДЕНЬГИ ------------------------------------
// Таблица выше врёт в одну сторону: она сравнивает расклады при равной силе, а
// игрок покупает их за разные деньги. Слоты защиты в оригинале дороже в 1.4
// раза ($35/$70 против $25/$50) [F] — значит доллар в атаку приносит больше
// стата, и оптимум по деньгам всегда сдвинут в атаку относительно оптимума по
// силе. Ровно на этом расхождении и живёт решение игрока.
const OFF_SLOTS = [{ base: 25, curve: 'pct2', step: 2 }, { base: 50, curve: 'pct3', step: 3 }]
const DEF_SLOTS = [{ base: 35, curve: 'pct2', step: 2 }, { base: 70, curve: 'pct3', step: 3 }]

// Покупка «что дешевле» внутри стороны — возвращает суммарный процент.
function spend(slots, budget) {
  const levels = slots.map(() => 0)
  let pct = 0
  for (;;) {
    let bi = -1
    let bp = Infinity
    slots.forEach((s, i) => {
      const p = combatPrice(s.base, s.curve, levels[i])
      if (p < bp) { bp = p; bi = i }
    })
    if (bp > budget) return pct
    budget -= bp
    levels[bi]++
    pct += slots[bi].step
  }
}

const BASE_STAT = 100          // стартовая пятёрка даёт 100/100
// Лигу привязываем к силе самой сборки, а не держим постоянной: иначе при
// большом бюджете игрок выигрывает всё подряд, при малом не выигрывает ничего,
// и «лучшая доля» в обоих случаях — шум на нулях. Игрок же по устройству
// повышений всегда сидит в лиге примерно своего роста.
const build = (budget, f) => {
  const off = BASE_STAT * (1 + spend(OFF_SLOTS, budget * f) / 100)
  const def = BASE_STAT * (1 + spend(DEF_SLOTS, budget * (1 - f)) / 100)
  return { off, def }
}
const EVEN_MONEY = 0.42        // 42% бюджета в атаку держит статы ровно 50/50

console.log('\n  лучшая доля бюджета в АТАКУ, лига = сила ровной сборки / отношение')
console.log('     бюджет  сила/лига   доля$   расклад   выигрыш у ровного')
for (const budget of [1e3, 25e3, 1e5, 2e6, 5e7]) {
  const evenBuild = build(budget, EVEN_MONEY)
  for (const ratio of [1.2, 1.6, 2.0]) {
    const league = (evenBuild.off + evenBuild.def) / ratio
    const pts = (b) => {
      const dist = placeDist(racerShape(b.off, b.def), league)
      return SEASON.winPoints * dist[0] + SEASON.podiumPoints * (dist[1] + dist[2])
    }
    let best = null
    for (let f = 0.10; f <= 0.901; f += 0.01) {
      const b = build(budget, f)
      const p = pts(b)
      if (!best || p > best.p) best = { f, b, p }
    }
    const share = 100 * best.b.off / (best.b.off + best.b.def)
    console.log(`  ${String(budget).padStart(9)}  ${ratio.toFixed(1).padStart(9)}   ` +
      `${(100 * best.f).toFixed(0).padStart(4)}%   атака ${share.toFixed(0)}%   ` +
      `${('+' + (100 * (best.p / pts(evenBuild) - 1)).toFixed(1) + '%').padStart(8)}`)
  }
}
