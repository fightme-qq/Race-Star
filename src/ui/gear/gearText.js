import { GEAR_BY_ID, SHARD_KINDS, SLOT_SIDE } from '../../config/gear.js'

// Общие подписи вкладки 2. Держим их в одном месте: строка «Epic +1 · Lv. 5»
// рисуется и в слоте, и в сумке, и в тосте гачи, а три копии формата
// расходятся молча — ровно так, как расходились формулы заезда (правило 16).

// Цвет числом → строкой для style Phaser.Text (как в drivers/PacksView).
export const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Статы гира дробные (base 2.0 … 16.6 при perLevel 0.30), поэтому один знак
// после запятой: округление до целого показывало бы «уровень ничего не дал».
export const fmt = (v) => {
  const r = Math.round(v * 10)
  return (r / 10).toFixed(r % 10 ? 1 : 0)
}

export const rarityOf = (it) => GEAR_BY_ID[it.rarity]

// Уровень подписан 1-based — тем же языком, что `Lv. ${level + 1}` на карточке
// драйвера. «Lv. 0» у только что выпавшего предмета читается как поломка.
export const levelText = (it) => `Lv. ${it.level + 1}`

export const plusText = (it) => (it.plus ? `+${it.plus}` : '')

// Сторона слота. В сводных числах — та же пара эмодзи, что на карточке
// драйвера и в карьере (⚔ / 🛡): менять язык в одном окне нельзя.
export const SIDE_ICON = { off: '⚔', def: '🛡' }

// А вот на КАРТОЧКЕ предмета сторона рисуется векторной иконкой сетки
// апгрейдов (красная мишень = offense, синий щит = defense): рядом с числом
// монохромный ⚔ читается как знак умножения («Lv. 1 ⚔ 2» → «Lv. 1 x2»),
// и это ловится только кадром — см. шапку UpgradeIcon.js.
export const SIDE_ICON_KEY = { off: 'c0', def: 'c2' }

export const sideOf = (slot) => SLOT_SIDE[slot] ?? 'off'

// Осколки: значок один на все три вида, вид различается цветом и подписью
// (SHARD_KINDS), иначе три одинаковых серых числа в шапке не прочесть.
export const SHARD_ICON = '⬢'

export const shardKind = (id) => SHARD_KINDS.find((k) => k.id === id)

export const shardText = (cost) => `${SHARD_ICON} ${cost.amount}`

// `Epic +1 · Lv. 5 · 12.3` — одна строка про надетый предмет. Стороны в ней
// НЕТ: в строке слота она нарисована векторной иконкой слева (drawUpgradeIcon),
// а второй значок ⚔ в восьми пикселях от кнопки ✕ читался как второй крестик —
// это видно только на кадре (`npm run shot`), в консоли молчит.
export const itemLine = (it, value) => {
  const r = rarityOf(it)
  const plus = plusText(it)
  return [r.name + (plus ? ' ' + plus : ''), levelText(it), fmt(value)].join('  ·  ')
}
