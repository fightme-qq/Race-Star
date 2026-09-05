import {
  DAILY_TASKS, WEEKLY_TASKS, TASK_TOKENS, METRICS, LOGIN, MAIL, DAY_MS, EPOCH_UTC,
} from '../config/rewards.js'
import { passIndex } from './SeasonPass.js'

// Задачи, Season Pass, ежедневный вход и почта — чистые данные и математика,
// без единого объекта сцены (правило 2). Награду ВЫДАЁТ GameState: здесь мы
// только решаем, что и когда доступно.
//
// Периоды считаются от общей эпохи, а не от момента установки: иначе у
// балансного стенда и у игрока «неделя» начиналась бы в разное время, и сравнивать
// приток токенов было бы не с чем.

const DAY = DAY_MS
const EPOCH = EPOCH_UTC

export const dayKey = (now) => new Date(now).toISOString().slice(0, 10)
export const weekIndex = (now) => Math.floor((now - EPOCH) / (7 * DAY))

const zeroProgress = () => Object.fromEntries(METRICS.map((m) => [m, 0]))

// Сколько осталось до сброса периода. Дневной считается от полуночи UTC — той
// же границы, по которой строится dayKey; считать «24 часа с последнего входа»
// значило бы, что подпись на экране и реальный сброс расходятся.
export function resetInSec(scope, now = Date.now()) {
  if (scope === 'weekly') return ((weekIndex(now) + 1) * 7 * DAY + EPOCH - now) / 1000
  return (Math.floor(now / DAY) * DAY + DAY - now) / 1000
}

export function freshRewards(now = Date.now()) {
  return {
    daily: { key: dayKey(now), progress: zeroProgress(), claimed: [] },
    weekly: { key: weekIndex(now), progress: zeroProgress(), claimed: [] },
    pass: { key: passIndex(now), season: 1, tokens: 0, claimedFree: [], claimedPremium: [], premium: false },
    login: { key: '', cycleDay: 0, streak: 0, total: 0, milestones: [] },
    mail: [],
  }
}

// Сбрасывает то, чей период кончился. Зовётся при каждом обращении к системе:
// вкладка может быть открыта в момент, когда наступают новые сутки, и
// счётчики обязаны обнулиться под курсором, а не при следующем запуске.
export function rollover(rw, now = Date.now()) {
  const changed = { daily: false, weekly: false, pass: false }
  const dk = dayKey(now)
  if (rw.daily.key !== dk) {
    rw.daily = { key: dk, progress: zeroProgress(), claimed: [] }
    changed.daily = true
  }
  const wk = weekIndex(now)
  if (rw.weekly.key !== wk) {
    rw.weekly = { key: wk, progress: zeroProgress(), claimed: [] }
    changed.weekly = true
  }
  const pk = passIndex(now)
  if (rw.pass.key !== pk) {
    // Незабранные уровни сгорают вместе с сезоном — иначе шкала перестаёт быть
    // сроком и превращается в накопительный счётчик.
    rw.pass = {
      key: pk, season: rw.pass.season + 1, tokens: 0,
      claimedFree: [], claimedPremium: [], premium: false,
    }
    changed.pass = true
  }
  return changed
}

export function trackMetric(rw, metric, amount = 1) {
  if (!METRICS.includes(metric)) return
  rw.daily.progress[metric] = (rw.daily.progress[metric] || 0) + amount
  rw.weekly.progress[metric] = (rw.weekly.progress[metric] || 0) + amount
}

const defsOf = (scope) => (scope === 'weekly' ? WEEKLY_TASKS : DAILY_TASKS)

export function tasksOf(rw, scope) {
  const bucket = rw[scope]
  return defsOf(scope).map((def) => {
    const value = bucket.progress[def.metric] || 0
    const claimed = bucket.claimed.includes(def.id)
    return {
      def, value: Math.min(value, def.goal), goal: def.goal, claimed,
      done: value >= def.goal,
      claimable: value >= def.goal && !claimed,
      tokens: TASK_TOKENS[scope],
    }
  })
}

// Забирает задачу и КЛАДЁТ ТОКЕНЫ В ПАСС. Отдельного кошелька у 🪙 нет: на
// кадре шкала пасса — единственное место, где эта валюта встречается.
export function claimTask(rw, scope, id) {
  const task = tasksOf(rw, scope).find((t) => t.def.id === id)
  if (!task || !task.claimable) return 0
  rw[scope].claimed.push(id)
  rw.pass.tokens += task.tokens
  return task.tokens
}

export function claimAllTasks(rw) {
  let tokens = 0
  for (const scope of ['daily', 'weekly']) {
    for (const t of tasksOf(rw, scope)) {
      if (t.claimable) tokens += claimTask(rw, scope, t.def.id)
    }
  }
  return tokens
}

// --- Ежедневный вход -----------------------------------------------------
export function loginState(rw, now = Date.now()) {
  const dk = dayKey(now)
  const available = rw.login.key !== dk
  // Пропуск дня рвёт стрик, но не цикл: цикл — это витрина наград, а стрик —
  // счётчик подряд. Разъединены намеренно, иначе пропуск отбрасывал бы игрока
  // к первой награде цикла и обесценивал бы весь блок.
  return {
    available,
    cycleDay: rw.login.cycleDay % LOGIN.cycle.length,
    streak: rw.login.streak,
    total: rw.login.total,
    reward: LOGIN.cycle[rw.login.cycleDay % LOGIN.cycle.length],
    milestones: LOGIN.milestones.map((m) => ({
      ...m,
      done: rw.login.total >= m.days,
      claimed: rw.login.milestones.includes(m.days),
      claimable: rw.login.total >= m.days && !rw.login.milestones.includes(m.days),
    })),
  }
}

// Возвращает список наград: сама дневная плюс майлстоун, если он в этот день
// закрылся. Списком, а не одной наградой, — иначе седьмой день молча съедал бы
// майлстоун недели.
export function claimLogin(rw, now = Date.now()) {
  const st = loginState(rw, now)
  if (!st.available) return []
  const yesterday = dayKey(now - DAY)
  rw.login.streak = rw.login.key === yesterday ? rw.login.streak + 1 : 1
  rw.login.key = dayKey(now)
  rw.login.total++
  const out = [st.reward]
  rw.login.cycleDay = (rw.login.cycleDay + 1) % LOGIN.cycle.length
  for (const m of loginState(rw, now).milestones) {
    if (m.claimable) { rw.login.milestones.push(m.days); out.push(m.reward) }
  }
  return out
}

// --- Почта ---------------------------------------------------------------
export function pushMail(rw, { title, body, reward = null }, now = Date.now()) {
  rw.mail.unshift({ id: `${now}-${rw.mail.length}`, title, body, reward, claimed: false, at: now })
  if (rw.mail.length > MAIL.max) rw.mail.length = MAIL.max
}

export function claimMail(rw, id) {
  const msg = rw.mail.find((m) => m.id === id)
  if (!msg || msg.claimed) return null
  msg.claimed = true
  return msg.reward
}

export function mailUnread(rw) {
  return rw.mail.filter((m) => !m.claimed && m.reward).length
}
