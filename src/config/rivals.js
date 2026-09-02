// Имена команд-соперников в лиге. [X] целиком: в оригинале таблица лиги
// (`Current Season Standings`, `Season History` — из локализации билда) есть,
// но ни на одном кадре не показана, значит ни одного настоящего имени у нас нет.
//
// Имена НЕ хранятся в сейве, а выводятся из (класс, лига, сезон) сидированной
// перетасовкой пула. Причина: состав соперников обновляется каждый сезон, и
// хранить девять строк на каждый из шести классов ради того, что однозначно
// считается из трёх чисел, — лишний вес сейва и лишний повод для рассинхрона.

import { mulberry32 } from '../utils/rng.js'

const PREFIX = [
  'Apex', 'Nitro', 'Vortex', 'Crimson', 'Iron', 'Solar', 'Onyx', 'Falcon',
  'Rogue', 'Titan', 'Quartz', 'Delta', 'Havoc', 'Lunar', 'Sable', 'Blitz',
  'Cobalt', 'Ember', 'Phantom', 'Wraith', 'Tundra', 'Zenith', 'Vulcan', 'Nomad',
]

const SUFFIX = ['Racing', 'Motors', 'Squad', 'Works', 'Crew', 'GP', 'Team', 'Garage']

// FNV-1a: нужен стабильный числовой сид из строки класса.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const cache = new Map()

// Девять имён на сезон, гарантированно разных: тасуем пул и берём начало.
// Совпадение имён в таблице читалось бы как баг, поэтому не «хэш по индексу».
export function rivalNames(classId, league, season) {
  const key = `${classId}|${league}|${season}`
  const hit = cache.get(key)
  if (hit) return hit

  const rnd = mulberry32(hash(key))
  const pool = PREFIX.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const names = pool.slice(0, 9).map((p) => `${p} ${SUFFIX[Math.floor(rnd() * SUFFIX.length)]}`)

  // Кэш растёт по одному ключу на сезон — чистим, чтобы за 700-часовой прогон
  // он не набрал тысячи записей.
  if (cache.size > 64) cache.clear()
  cache.set(key, names)
  return names
}
