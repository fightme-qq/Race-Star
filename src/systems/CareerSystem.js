import { CAREER, SKILLS, SKILL_BY_ID, TIER_REQ, FX_META } from '../config/career.js'

// Чистая математика карьерного драйвера. Ни одного объекта сцены — этим же
// кодом считает балансный стенд (tools/sim), как и в DriverSystem.
//
// Прогресс: { level, xp, spent: { skillId: rank } } — лежит в cls.career,
// то есть у каждого класса свой карьерный драйвер и своё дерево [F].

export const freshCareer = () => ({ level: 1, xp: 0, spent: {} })

export const careerXpToNext = (level) =>
  level >= CAREER.maxLevel
    ? Infinity
    : Math.round(CAREER.xpBase * Math.pow(CAREER.xpGrowth, level - 1))

export function addCareerXp(career, amount) {
  career.xp += amount
  let gained = 0
  while (career.level < CAREER.maxLevel && career.xp >= careerXpToNext(career.level)) {
    career.xp -= careerXpToNext(career.level)
    career.level++
    gained++
  }
  // На капе полоса XP должна стоять полной и не копить мусор в сейве.
  if (career.level >= CAREER.maxLevel) career.xp = 0
  return gained
}

export const pointsTotal = (career) => (career.level - 1) * CAREER.pointsPerLevel
export const pointsSpent = (career) =>
  Object.values(career.spent).reduce((a, b) => a + b, 0)
export const pointsFree = (career) => pointsTotal(career) - pointsSpent(career)

export const rankOf = (career, id) => career.spent[id] || 0

// Ярус открывается суммой вложенных очков, а не конкретным родителем: узлов
// в ярусе три, и жёсткие связи заставили бы рисовать граф ради двух правил.
export const tierUnlocked = (career, tier) => pointsSpent(career) >= TIER_REQ[tier]

export const canSpend = (career, skill) =>
  pointsFree(career) > 0 && rankOf(career, skill.id) < skill.max
  && tierUnlocked(career, skill.tier)

export function spendPoint(career, skillId) {
  const skill = SKILL_BY_ID[skillId]
  if (!skill || !canSpend(career, skill)) return false
  career.spent[skillId] = rankOf(career, skillId) + 1
  return true
}

export function resetSkills(career) {
  const back = pointsSpent(career)
  career.spent = {}
  return back
}

const ZERO_FX = {
  careerOff: 0, careerDef: 0, teamOffPct: 0, teamDefPct: 0, defToOff: 0,
  incomePct: 0, prizePct: 0, fansPct: 0,
}

// Свод дерева. Дёргается из incomePerSec, то есть несколько раз за кадр —
// вызывающая сторона (GameState) держит результат в кэше и сбрасывает его
// при трате очка, сбросе дерева и смене класса.
export function careerEffects(career) {
  const fx = { ...ZERO_FX }
  for (const skill of SKILLS) {
    const rank = rankOf(career, skill.id)
    if (!rank) continue
    for (const [key, value] of Object.entries(skill.per)) fx[key] += value * rank
  }
  return fx
}

// Статы самого драйвера: он выходит на трассу шестым, поверх пятёрки состава.
export function careerStats(career, fx) {
  const levels = career.level - 1
  return {
    off: CAREER.baseOff + CAREER.statPerLevel * levels + fx.careerOff,
    def: CAREER.baseDef + CAREER.statPerLevel * levels + fx.careerDef,
  }
}

// --- Форматирование для UI ----------------------------------------------
const round1 = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1))

export function effectSummary(skill, rank) {
  return Object.entries(skill.per)
    .map(([key, per]) => {
      const value = per * rank
      const meta = FX_META[key]
      return `${meta.icon}${value > 0 ? '+' : value < 0 ? '−' : ''}${round1(Math.abs(value))}${meta.unit}`
    })
    .join(' ')
}
