// Форматирование чисел в стиле оригинала: 219M, 8.05K, $1.21K.

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatNum(value) {
  const n = Math.floor(Number(value) || 0)
  if (n < 1000) return String(n)
  let tier = 0
  let v = n
  while (v >= 1000 && tier < SUFFIX.length - 1) { v /= 1000; tier++ }
  // 3 значащих цифры: 1.21K, 12.1K, 121K
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  return v.toFixed(digits).replace(/\.0+$/, '') + SUFFIX[tier]
}

export function formatMoney(value) {
  return '$' + formatNum(value)
}

// Секунды -> 00:59
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

export function formatPercent(value, digits = 0) {
  return value.toFixed(digits) + '%'
}

// P1 / P2 / P3 ...
export function ordinalPos(pos) {
  return 'P' + pos
}
