// 6 классов гонок. Названия апгрейдов — дословно с кадров оригинала [F].
// Схема одинакова во всех классах: 2 атакующих + 2 защитных слота,
// базовые цены $25 / $50 / $35 / $70, шаги +2% / +3% / +2% / +3%.

const COMBAT_SLOTS = [
  { key: 'c0', tag: 'offense', base: 25, step: 2, curve: 'pct2' },
  { key: 'c1', tag: 'offense', base: 50, step: 3, curve: 'pct3' },
  { key: 'c2', tag: 'defense', base: 35, step: 2, curve: 'pct2' },
  { key: 'c3', tag: 'defense', base: 70, step: 3, curve: 'pct3' },
]

// Общая экономическая ветка — названия [F], числа [X] (в кадрах видны
// только несмежные уровни, кривую по ним не восстановить).
const ECONOMY_SLOTS = [
  { key: 'e0', name: 'Ticket Marketing',     tag: 'income', base: 33, pg: 1.35, gain: 3,  gg: 1.30, effect: 'incomePerSec' },
  { key: 'e1', name: 'Parking',              tag: 'income', base: 50, pg: 1.32, gain: 2,  gg: 1.28, effect: 'incomePerSec' },
  { key: 'e2', name: 'Grandstands',          tag: 'fans',   base: 50, pg: 1.30, gain: 10, gg: 1.15, effect: 'fansPerRace' },
  { key: 'e3', name: 'Victory Celebrations', tag: 'income', base: 50, pg: 1.34, gain: 9,  gg: 1.30, effect: 'winBonus' },
]

// Трофейная ветка [F]: цена 1 трофей, Lv.0 -> "0% -> 10%".
const TROPHY_SLOTS = [
  { key: 't0', name: 'Power Launch',  tag: 'offense', trophyCost: 1, step: 10 },
  { key: 't1', name: 'Clutch Launch', tag: 'defense', trophyCost: 1, step: 10 },
]

const COMBAT_NAMES = {
  racing:  ['Overtaking Technique', 'Attacking Moves',    'Defensive Positioning', 'Throttle Control'],
  stock:   ['Finishing Pace',       'Attacking Build-Up', 'Defensive Shape',       'Car Control'],
  rally:   ['Overtaking Accuracy',  'Attacking Pressure', 'Defensive Coverage',    'Throttle Control'],
  bike:    ['Overtaking Precision', 'Attacking Schemes',  'Defensive Coverage',    'Grip Security'],
  speed:   ['Overtake Timing',      'Attacking Systems',  'Defensive Block',       'Car Control'],
  monster: ['Launch Control',       'Race Strategy',      'Cornering Mechanics',   'Car Control'],
}

const CLASS_META = [
  { id: 'racing',  name: 'Racing',        icon: '🏎', color: 0xff7a1a },
  { id: 'stock',   name: 'Stock Car',     icon: '🚗', color: 0x4dd0e1 },
  { id: 'rally',   name: 'Rally',         icon: '🚙', color: 0x2ecc71 },
  { id: 'bike',    name: 'Superbike',     icon: '🏍', color: 0xe63946 },
  { id: 'speed',   name: 'Speedster',     icon: '🏁', color: 0xffc94d },
  { id: 'monster', name: 'Monster Truck', icon: '🛻', color: 0xa06bff },
]

function buildUpgrades(classId) {
  const list = []
  COMBAT_SLOTS.forEach((slot, i) => {
    list.push({ ...slot, kind: 'combat', name: COMBAT_NAMES[classId][i], currency: 'cash' })
  })
  ECONOMY_SLOTS.forEach((slot) => {
    list.push({ ...slot, kind: 'economy', currency: 'cash' })
  })
  TROPHY_SLOTS.forEach((slot) => {
    list.push({ ...slot, kind: 'trophy', currency: 'trophy' })
  })
  return list
}

export const RACE_CLASSES = CLASS_META.map((meta, index) => ({
  ...meta,
  index,
  upgrades: buildUpgrades(meta.id),
}))

export const CLASS_BY_ID = Object.fromEntries(RACE_CLASSES.map((c) => [c.id, c]))

export const getUpgrade = (classId, key) =>
  CLASS_BY_ID[classId].upgrades.find((u) => u.key === key)
