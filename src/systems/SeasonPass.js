import { PASS, passReward, DAY_MS, EPOCH_UTC } from '../config/rewards.js'

// Season Pass вынесен из RewardsSystem отдельным файлом: там периоды, задачи,
// вход и почта, и вместе с пассом файл переваливал за 200 строк.
//
// Период считается от общей эпохи, а не от установки: иначе «10 дней» [F] у
// стенда и у игрока начинались бы в разные моменты.
export const passIndex = (now) => Math.floor((now - EPOCH_UTC) / (PASS.days * DAY_MS))
export const passLeftMs = (now) => (passIndex(now) + 1) * PASS.days * DAY_MS + EPOCH_UTC - now

// Цена уровня линейна, поэтому кумулятив — арифметическая прогрессия.
export const passTotalFor = (level) =>
  level * PASS.tokenBase + PASS.tokenStep * level * (level - 1) / 2

export function passProgress(rw) {
  const tokens = rw.pass.tokens
  let level = 0
  while (level < PASS.levels && passTotalFor(level + 1) <= tokens) level++
  const base = passTotalFor(level)
  const need = level >= PASS.levels ? 0 : passTotalFor(level + 1) - base
  return { level, tokens, into: tokens - base, need, max: PASS.levels }
}

export function passRows(rw) {
  const { level } = passProgress(rw)
  return Array.from({ length: PASS.levels }, (_, i) => {
    const lv = i + 1
    return {
      level: lv,
      unlocked: lv <= level,
      free: {
        reward: passReward(lv, false),
        claimed: rw.pass.claimedFree.includes(lv),
        claimable: lv <= level && !rw.pass.claimedFree.includes(lv),
      },
      premium: {
        reward: passReward(lv, true),
        claimed: rw.pass.claimedPremium.includes(lv),
        // Премиум-ветка ждёт магазина (шаг 5): `Rookie Pass $4.99` [F] — IAP.
        claimable: rw.pass.premium && lv <= level && !rw.pass.claimedPremium.includes(lv),
      },
    }
  })
}

export function claimPass(rw, level, premium = false) {
  const row = passRows(rw).find((r) => r.level === level)
  const track = premium ? row?.premium : row?.free
  if (!track?.claimable) return null
  ;(premium ? rw.pass.claimedPremium : rw.pass.claimedFree).push(level)
  return track.reward
}

export function passClaimable(rw) {
  return passRows(rw).filter((r) => r.free.claimable || r.premium.claimable)
}

