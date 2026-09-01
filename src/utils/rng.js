// Сидированный ГПСЧ. В оригинале симуляция матча сидированная
// (SeededMatchRandom) — сервер и клиент считают один и тот же заезд.
// Держим ту же форму: гонка воспроизводима по сиду.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class SeededRandom {
  constructor(seed) { this.next = mulberry32(seed) }

  float(min = 0, max = 1) { return min + this.next() * (max - min) }

  int(min, max) { return Math.floor(this.float(min, max + 1)) }

  pick(arr) { return arr[this.int(0, arr.length - 1)] }

  // Нормальное распределение (Box-Muller) — нужно для шума скорости в гонке.
  gauss(mean = 0, sigma = 1) {
    const u = Math.max(1e-9, this.next())
    const v = this.next()
    return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

export const randomSeed = () => (Math.random() * 0xffffffff) >>> 0
