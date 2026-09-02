import './headless.js'
import { fastSim } from './fastsim.js'
import { cheapestFirst, resetPolicyCache } from './policies.js'
import { MILESTONE_TARGETS, scoreRun } from './targets.js'
import { ECONOMY, LEAGUES, SEASON } from '../../src/config/balance.js'
import { RACE_CLASSES } from '../../src/config/classes.js'
import { SeededRandom } from '../../src/utils/rng.js'

// Конфиги — обычные объекты, правим на месте перед прогоном.
export function applyTune(p) {
  resetPolicyCache()
  ECONOMY.fansPerFanBonus = p.fansK
  ECONOMY.leagueIncomeMult = p.leagueMult
  SEASON.promoteRatio = p.promoteRatio
  // Первая ступень 190 — ROOKIE снята с кадров [F], дальше геометрия [X].
  LEAGUES.forEach((l, i) => { l.power = Math.round(190 * Math.pow(p.leagueStep, i)) })
  for (const cls of RACE_CLASSES) {
    for (const u of cls.upgrades) {
      if (u.key === 'e0') { u.gain = 1.4 * p.ecoGain; u.pg = p.ecoPg }
      if (u.key === 'e1') { u.gain = 1.9 * p.ecoGain; u.pg = p.ecoPg - 0.005 }
      if (u.key === 'e3') { u.gain = 0.9 * p.ecoGain; u.pg = p.ecoPg + 0.015 }
      if (u.key === 'e2') { u.gain = p.fanGain; u.pg = p.fanPg }
    }
  }
}

export function evaluate(p, { hours = 700, seeds = [1, 2] } = {}) {
  applyTune(p)
  let score = 0
  let last = null
  for (const seed of seeds) {
    last = fastSim({ hours, policy: cheapestFirst, seed })
    score += scoreRun(last)
  }
  return { score: score / seeds.length, run: last }
}

const SPACE = {
  ecoGain:    [0.02, 1.5],
  ecoPg:      [1.20, 1.90],
  fanGain:    [0.05, 3.0],
  fanPg:      [1.14, 1.32],   // выше — ветка фанатов вырождается в ловушку
  fansK:      [200, 200000],
  leagueMult:   [1.2, 3.0],
  leagueStep:   [1.20, 1.90],
  promoteRatio: [0.6, 2.6],   // счёт сезона для повышения = races * ratio
}

// Найденные предыдущими прогонами точки — чтобы расширение пространства
// поиска не теряло уже достигнутый результат.
const SEED_POINTS = [
  { ecoGain: 0.2177, ecoPg: 1.3555, fanGain: 0.30, fanPg: 1.26,
    fansK: 40000, leagueMult: 2.1825, leagueStep: 1.2602, promoteRatio: 1.7329 },
  // Точка Этапа 1 — счёт 0.214 на 700ч БЕЗ драйверов. С появлением второй оси
  // силы она перестала попадать в вехи (все пришли вдвое раньше), но остаётся
  // в списке как ориентир: перебор не должен уходить от неё далеко по
  // экономическим коэффициентам, иначе едет то, что уже сошлось.
  { ecoGain: 0.5523, ecoPg: 1.6664, fanGain: 0.7726, fanPg: 1.2975,
    fansK: 112991, leagueMult: 1.5848, leagueStep: 1.2487, promoteRatio: 1.7221 },
  // Та же экономика, но лестница лиг растянута под драйверов — стартовая
  // точка перебора Этапа 2.
  { ecoGain: 0.5523, ecoPg: 1.6664, fanGain: 0.7726, fanPg: 1.2975,
    fansK: 112991, leagueMult: 1.5848, leagueStep: 1.4183, promoteRatio: 1.7221 },
]

const sampleLog = (rng, [lo, hi]) => Math.exp(rng.float(Math.log(lo), Math.log(hi)))

// Случайный поиск в логарифмическом пространстве + покоординатный спуск.
export function search({ iters = 200, refine = 3, hours = 700 } = {}) {
  const rng = new SeededRandom(20260902)
  let best = null

  for (const p of SEED_POINTS) {
    const { score } = evaluate(p, { hours, seeds: [1] })
    if (!best || score < best.score) best = { score, p }
  }

  for (let i = 0; i < iters; i++) {
    const p = Object.fromEntries(Object.entries(SPACE).map(([k, r]) => [k, sampleLog(rng, r)]))
    const { score } = evaluate(p, { hours, seeds: [1] })
    if (!best || score < best.score) { best = { score, p }; process.stderr.write(`  ${i}: ${score.toFixed(2)}\n`) }
  }

  // Покоординатный спуск обязан держаться внутри SPACE. Без clamp он уводил
  // fanPg на 1.52 при границе 1.32 — то есть ровно в ту «ловушку», от которой
  // граница и поставлена: цена ветки фанатов x1.5 за уровень при +0.7 фаната.
  const clamp = (key, v) => Math.min(SPACE[key][1], Math.max(SPACE[key][0], v))

  for (let pass = 0; pass < refine; pass++) {
    const step = 0.16 / (pass + 1)
    for (const key of Object.keys(SPACE)) {
      for (const dir of [-1, 1]) {
        const p = { ...best.p, [key]: clamp(key, best.p[key] * Math.exp(dir * step)) }
        const { score } = evaluate(p, { hours, seeds: [1, 2] })
        if (score < best.score) { best = { score, p }; process.stderr.write(`  ${key}${dir > 0 ? '+' : '-'}: ${score.toFixed(2)}\n`) }
      }
    }
  }
  return best
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const best = search({ iters: Number(process.argv[2] || 200) })
  console.log('\nлучший счёт', best.score.toFixed(3))
  for (const [k, v] of Object.entries(best.p)) console.log(`  ${k}: ${v.toFixed(4)}`)

  const { run } = evaluate(best.p, { hours: 700, seeds: [1] })
  console.log('\n  веха     цель    вышло')
  for (const t of MILESTONE_TARGETS) {
    const a = run.milestones[t.price]
    console.log(`  ${String(t.price).padStart(11)}  ${t.label.padStart(5)}  ` +
      (a ? (a / 3600).toFixed(1) + 'ч' : 'не дошёл'))
  }
  const levels = Object.values(run.state.cls.levels).reduce((a, b) => a + b, 0)
  console.log(`\n  уровней ${levels} | побед ${(100 * run.places[1] / run.races).toFixed(1)}% ` +
    `| лига ${run.state.cls.league} | фанатов ${Math.round(run.state.cls.fans)}`)
  console.log('  лиги:', LEAGUES.map((l) => l.power).join(' '))
}
