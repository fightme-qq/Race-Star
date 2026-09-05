// 6 классов гонок. Названия апгрейдов — дословно с кадров оригинала [F].
// Схема одинакова во всех классах: 2 атакующих + 2 защитных слота,
// базовые цены $25 / $50 / $35 / $70, шаги +2% / +3% / +2% / +3%.

const COMBAT_SLOTS = [
  { key: 'c0', tag: 'offense', base: 25, step: 2, curve: 'pct2' },
  { key: 'c1', tag: 'offense', base: 50, step: 3, curve: 'pct3' },
  { key: 'c2', tag: 'defense', base: 35, step: 2, curve: 'pct2' },
  { key: 'c3', tag: 'defense', base: 70, step: 3, curve: 'pct3' },
]

// Общая экономическая ветка — на шаге 2 переставлена со своих чисел на СНЯТЫЕ.
//
// Значение слота: value(L) = flat + gain * L. Прибавка плоская, и это больше не
// вывод из «иначе прогон взрывается», а измерение по двум точкам на слот
// (Race Star Lv.0 + Track Star Lv.4/5/8, тот же движок):
//   Ticket Marketing     +$6  -> +$9   и Lv.5 +$21 -> +$24    => 6 + 3L   [F]
//   Victory Celebrations +$0  -> +$9   и Lv.4 +$36 -> +$45    => 0 + 9L   [F]
//   Parking              +$0  -> +$15  и Lv.8 +$120 -> +$135  => 0 + 15L  [F]
//   Grandstands           10  -> 15    и Lv.5 35 -> 40        => 10 + 5L  [F]
//
// Единица — ЗА ГОНКУ, а не за секунду. Это не допущение: у Track Star на кадре
// Marketing Lv.5 (+$21) и Parking Lv.8 (+$120) при "Income /s $104", то есть
// сумма прибавок больше самого дохода. Три денежных слота платят на финише,
// Victory Celebrations — только за победу (отсюда его название).
// Прежняя версия отдавала Victory Celebrations СЕКУНДЫ дохода, чтобы бонус не
// отставал от экономики. Теперь этого не нужно: доход больше не растёт от самой
// ветки, а ранняя игра на плоских выплатах и держится (Parking Lv.8 = $120 за
// гонку против $60 пассива при $1/с).
//
// Цена: price(L) = anchor.price * pg^(L - anchor.level). Якорь — наблюдённая
// цена, а не база: у Parking и Grandstands кадра с Lv.0 нет, зато есть цена на
// известном уровне, и она держится при любом pg.
//   Ticket Marketing     Lv.0 $10 -> Lv.5 $60    => pg 1.431 [F], база $10
//   Victory Celebrations Lv.0 $50 -> Lv.4 $367   => pg 1.646 [F], база $50
//   Parking              Lv.8 $4.86K             => pg [X], база выводится
//   Grandstands          Lv.5 $9.05K             => pg [X], база выводится
// Даже при наклоне денежных слотов (1.43) база Grandstands выходит ~$1.5K
// против $10 у Ticket Marketing — в оригинале ветка фанатов на два порядка
// дороже денежной. У нас было ровно наоборот (фанаты $50 при pg 1.32 против
// денег $50 при pg 2.29), и это, судя по всему, и есть причина, по которой
// множитель фанатов три этапа подряд не доходил до цели: слот стоил слишком
// дёшево, чтобы быть поздней целью.
// Наклоны Parking и Grandstands подобраны перебором (2.499 и 2.227). Они круче
// наблюдённых денежных, и смысл у этого прямой: якорь стоит на Lv.8 и Lv.5, а
// крутой наклон делает уровни ДО якоря почти бесплатными. Ранняя игра тогда
// разгоняется на Parking, а после якоря ветка становится поздней целью — обе
// фазы из кадров сохраняются.
// Оба числа пересобраны на шаге «параллельный доход», и оба обязаны меняться
// ВМЕСТЕ: замер по четырём смесям показал, что шестой класс открывается только
// при обоих пологих (счёт 1.00), а любая смесь со старым наклоном возвращает
// прежний тупик — класс 4 и «не дошёл» (3.57 … 4.21).
const ECONOMY_SLOTS = [
  { key: 'e0', name: 'Ticket Marketing',     tag: 'income', flat: 6,  gain: 3,  unit: '$', effect: 'cashPerRace', anchor: { level: 0, price: 10 },   pg: 1.431 },
  { key: 'e1', name: 'Parking',              tag: 'income', flat: 0,  gain: 15, unit: '$', effect: 'cashPerRace', anchor: { level: 8, price: 4860 }, pg: 2.3068 },
  { key: 'e2', name: 'Grandstands',          tag: 'fans',   flat: 10, gain: 5,  unit: '',  effect: 'fansPerRace', anchor: { level: 5, price: 9050 }, pg: 2.0555 },
  { key: 'e3', name: 'Victory Celebrations', tag: 'income', flat: 0,  gain: 9,  unit: '$', effect: 'cashPerWin',  anchor: { level: 0, price: 50 },   pg: 1.646 },
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
