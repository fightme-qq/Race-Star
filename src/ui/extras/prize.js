import { PAL } from '../../config/palette.js'
import { formatMoney, formatNum } from '../../utils/format.js'

// Приз шага 9 подписывается в двух местах — в сетке Lucky Draw и в строке
// Ultimate Reward коллекций. Подпись считается здесь, как `rewards/reward.js`
// делает это для задач и пасса: вторая копия таблицы икон разъехалась бы молча.
// Набор видов шире наградного: у Lucky Draw в сетке есть машина и звезда машины
// [F], которых в наградах нет.
export const PRIZE_ICON = {
  gems: '💎', shards: '⬢', carShards: '⚙', coupon: '🎫', cashSec: '💵',
  cores: '⬣', carStar: '⭐', car: '🏎', outfit: '👕',
}

export const PRIZE_NAME = {
  gems: 'Gems', shards: 'Gear Shards', carShards: 'Car Shards',
  coupon: 'Coupons', cashSec: 'Cash', cores: 'Unique Cores',
  carStar: 'Car Star', car: 'Legend Car', outfit: 'Outfit',
}

// Количество. `cashSec` разворачивается в деньги игрока: в конфиге это секунды
// дохода (правило 24), а на экране должна стоять сумма, которую он получит.
export function prizeAmount(state, prize) {
  if (!prize) return ''
  if (prize.kind === 'cashSec') return formatMoney(state.incomePerSec * prize.amount)
  // У приза без количества (аутфит, машина) цифры нет вовсе: «1 👕» читается
  // как «одна штука из многих», а это уникальный предмет.
  if (prize.amount == null) return ''
  return formatNum(prize.amount)
}

export function prizeText(state, prize) {
  if (!prize) return ''
  return `${prizeAmount(state, prize)} ${PRIZE_ICON[prize.kind] ?? ''}`.trim()
}

export function prizeName(prize) {
  return prize ? (PRIZE_NAME[prize.kind] ?? prize.kind) : ''
}

export function prizeColor(prize) {
  if (!prize) return PAL.muted
  if (prize.kind === 'gems') return PAL.cyan
  if (prize.kind === 'car' || prize.kind === 'carStar' || prize.kind === 'outfit') return PAL.gold
  if (prize.kind === 'cores') return PAL.purple
  return PAL.greenDim
}
