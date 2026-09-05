import { PAL } from '../../config/palette.js'
import { REWARD_ICON } from '../../config/rewards.js'
import { formatMoney, formatNum } from '../../utils/format.js'

// Награда одинаково выглядит в задачах, пассе, ежедневном входе и почте —
// поэтому её подпись считается в одном месте. `cashSec` разворачивается в
// текущие деньги игрока: в конфиге это секунды дохода, а на экране должна
// стоять сумма, которую он получит сейчас.
export function rewardText(state, reward) {
  if (!reward) return ''
  const icon = REWARD_ICON[reward.kind] || ''
  if (reward.kind === 'cashSec') return formatMoney(state.incomePerSec * reward.amount) + ' ' + icon
  return formatNum(reward.amount) + ' ' + icon
}

export function rewardColor(reward) {
  if (!reward) return PAL.muted
  if (reward.kind === 'gems') return PAL.cyan
  if (reward.kind === 'trophy') return PAL.gold
  return PAL.greenDim
}
