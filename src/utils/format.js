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

// Прибавки экономических апгрейдов дробные (0.58 $/с за уровень), а formatNum
// округляет вниз — карточка показывала «$0/с → $0/с» и выглядела сломанной.
export function formatGain(value) {
  const n = Number(value) || 0
  return n >= 10 ? formatNum(n) : String(Math.round(n * 100) / 100)
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

// Часы:минуты:секунды. Отдельно от formatClock (MM:SS), потому что у арены и
// Club Clash счётчик идёт до суток и дольше: `formatClock` показал бы 1439:59.
// Живёт здесь, а не в экране арены, чтобы второй копии арифметики времени не
// появилось (её уже начали писать в ArenaHeader).
export function formatHms(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  return h > 0 ? h + ':' + formatClock(s % 3600) : formatClock(s)
}
