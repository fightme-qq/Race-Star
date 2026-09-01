// Заглушки браузерного окружения + виртуальные часы.
// Импортируется ПЕРВЫМ, до любых src/systems — GameState зовёт Date.now()
// в конструкторе, а SaveSystem лезет в localStorage.

const RealDate = Date
const EPOCH = RealDate.UTC(2026, 0, 1, 9, 0, 0)
let virtualMs = EPOCH

export const clock = {
  now: () => virtualMs,
  advance: (ms) => { virtualMs += ms },
  reset: () => { virtualMs = EPOCH },
}

class VirtualDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(virtualMs)
    else super(...args)
  }
  static now() { return virtualMs }
}
globalThis.Date = VirtualDate

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: (k) => { store.delete(k) },
  clear: () => { store.clear() },
}
