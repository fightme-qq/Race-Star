// Проверка узлов скилл-дерева принудительным вложением.
//
// Отвечает на два разных вопроса, которые легко перепутать:
//   1. Узел — ловушка? Принудительная раскладка в него ХУЖЕ жадного бота.
//   2. Оценщик слеп? Принудительная раскладка ЛУЧШЕ жадного бота — значит бот
//      не видит эффект, и виноват `ratePerSec`, а не сам узел.
// Второе уже случалось дважды: `Crowd Work` при горизонте 850 гонок выглядел
// бесполезным, а ручная раскладка обыгрывала бота на 63%. Правило записано в
// AGENTS.md п.14, но выполнялось на глазок — теперь это команда.
//
// Запуск: node tools/sim/skills.js [часов]

import './headless.js'
import { fastSim } from './fastsim.js'
import { cheapestFirst, careerBot } from './policies.js'
import { SKILLS } from '../../src/config/career.js'
import { canSpend, pointsFree, rankOf } from '../../src/systems/CareerSystem.js'

const HOURS = Number(process.argv[2] || 700)
const SEEDS = [1, 2]

// Сначала льём очки в целевой узел, пока он берётся, дальше — обычный бот.
// Именно «дальше бот», а не «остаток в никуда»: иначе замер показал бы цену
// потерянных очков, а не ценность узла.
const forced = (skillId) => (state) => {
  const career = state.cls.career
  const skill = SKILLS.find((s) => s.id === skillId)
  let spent = 0
  while (pointsFree(career) > 0 && rankOf(career, skillId) < skill.max) {
    if (!canSpend(career, skill) || !state.spendSkill(skillId)) break
    spent++
  }
  return spent + careerBot(state)
}

const runAvg = (career) => {
  let earned = 0
  for (const seed of SEEDS) {
    earned += fastSim({ hours: HOURS, policy: cheapestFirst, seed, career }).earned
  }
  return earned / SEEDS.length
}

const money = (n) => '$' + (n / 1e9).toFixed(2) + 'B'

const base = runAvg(careerBot)
console.log(`жадный бот: ${money(base)} за ${HOURS}ч (среднее по сидам ${SEEDS.join(',')})`)
// Читать колонку «против бота» как приговор нельзя: залить МАКСИМУМ рангов в
// любой один узел заведомо хуже, чем разложить очки смесью. Поэтому нижняя
// планка — не ноль, а медиана по всем узлам; отклонение от неё и есть сигнал.
console.log('минус относительно бота есть у всех — это цена перекоса в один узел,')
console.log('а не приговор узлу. Сравнивать надо с медианой по столбцу.\n')
console.log('  узел                 принудительно   против бота   против медианы')

const rows = SKILLS.map((s) => ({ skill: s, earned: runAvg(forced(s.id)) }))
rows.sort((a, b) => b.earned - a.earned)
const median = rows[Math.floor(rows.length / 2)].earned
for (const { skill, earned } of rows) {
  const delta = 100 * (earned / base - 1)
  const rel = 100 * (earned / median - 1)
  const mark = delta > 5 ? '  <- оценщик слеп' : rel < -5 ? '  <- слабее пачки' : ''
  const pct = (v) => ((v >= 0 ? '+' : '') + v.toFixed(1) + '%').padStart(7)
  console.log(`  ${skill.name.padEnd(20)} ${money(earned).padStart(9)}   ` +
    `${pct(delta)}       ${pct(rel)}${mark}`)
}

// Разброс между лучшим и худшим открытием — мера того, есть ли в ветке выбор.
// Если он близок к нулю, узлы взаимозаменяемы и дерево ничего не решает.
const hi = rows[0].earned
const lo = rows[rows.length - 1].earned
console.log(`\n  разброс между лучшим и худшим узлом: ${(100 * (hi / lo - 1)).toFixed(1)}%`)
