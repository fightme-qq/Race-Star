import { PAL } from '../config/palette.js'
import { formatGain, formatMoney, formatNum } from '../utils/format.js'
import { upgradeEffect, isUpgradeLocked } from '../systems/UpgradeSystem.js'
import { TROPHY_UNLOCK_AT } from '../config/balance.js'

// Содержимое справки по ⓘ на карточке апгрейда. Отдельным файлом, как
// gear/gearText.js: текст и производные числа — это содержание, а InfoPopup —
// только раскладка, и смешивать их значит заводить копию формата на каждый
// экран, где справка понадобится ещё.
//
// Описания пишутся по ТЕГУ и эффекту, а не по имени слота: имена боевых слотов
// у каждого класса свои (шесть наборов по четыре — «Overtaking Technique» у
// Racing, «Finishing Pace» у Stock Car), а работа у слота одна и та же.
// По именам пришлось бы держать 24 одинаковых по смыслу текста, и они бы
// разъехались молча — ровно так, как разъезжались формулы заезда.

const SIDE = {
  offense: {
    badge: 'OFFENCE',
    color: PAL.red,
    body: 'Raises your Offence rating. Offence decides how often you win a '
      + 'wheel-to-wheel move and take the place in front of you.',
  },
  defense: {
    badge: 'DEFENCE',
    color: PAL.accent,
    body: 'Raises your Defence rating. Defence decides how often you hold your '
      + 'place when the car behind attacks you.',
  },
}

// Почему процент, а не плоское число: он берётся от ВСЕЙ силы — драйверы, гир,
// детали машины, скиллы карьеры. Игроку это важно знать, иначе «+2%» на фоне
// «+18 Offence» у предмета гира читается как слабее, хотя это наоборот.
const COMBAT_NOTE = 'The bonus is a percentage of your whole team — drivers, '
  + 'gear, car parts and career skills all count, so it keeps growing with '
  + 'everything else you own.'

const ECON = {
  cashPerRace: {
    badge: 'INCOME',
    color: PAL.greenDim,
    body: 'Pays a flat cash bonus when the race ends, whatever position you '
      + 'finish in.',
    note: 'Flat means exactly that: it does not scale with your league or your '
      + 'fans. Strong early, overtaken later by prize money.',
    per: (v) => '+' + formatMoney(v) + ' / race',
  },
  cashPerWin: {
    badge: 'INCOME',
    color: PAL.greenDim,
    body: 'Pays a flat cash bonus, but only when you finish FIRST. Nothing for '
      + 'second place.',
    note: 'Worth taking once you win regularly — it pays about three times what '
      + 'a per-race slot of the same level does.',
    per: (v) => '+' + formatMoney(v) + ' / win',
  },
  fansPerRace: {
    badge: 'FANS',
    color: PAL.gold,
    body: 'Adds fans every race — more of them for a podium finish. Fans are '
      + 'the only thing that raises your Income /s.',
    note: 'This is the compounding slot: fans raise income, income buys every '
      + 'other upgrade. Cheap upgrades come and go, this one pays forever.',
    per: (v) => '+' + formatNum(v) + ' fans / race',
  },
}

const TROPHY_NOTE = 'Bought with trophies, not cash — trophies come from race '
  + 'results, so this slot cannot be rushed with money. Its step is five times '
  + 'a cash slot.'

// Возвращает всё, что рисует InfoPopup. Числа берутся из того же
// upgradeEffect/agg, что и карточка: второго места, где считается «сколько даёт
// слот», не появляется.
export function upgradeInfo(def, state) {
  const level = state.levelOf(def.key)
  const eff = upgradeEffect(def, level)
  const agg = state.agg
  const rows = []
  let spec
  let note

  if (def.kind === 'combat' || def.kind === 'trophy') {
    spec = SIDE[def.tag]
    note = def.kind === 'trophy' ? TROPHY_NOTE : COMBAT_NOTE
    const total = def.tag === 'offense' ? agg.offensePct : agg.defensePct
    rows.push(['Every level', `+${def.step}%`])
    rows.push(['This slot now', level === 0 ? 'not bought' : `+${eff.current}%`])
    rows.push([`All ${spec.badge.toLowerCase()} slots`, `+${total}%`])
  } else {
    spec = ECON[def.effect]
    note = spec.note
    const total = def.effect === 'fansPerRace' ? agg.fansPerRace
      : def.effect === 'cashPerWin' ? agg.cashPerWin
      : agg.cashPerRace
    rows.push(['Every level', spec.per(def.gain)])
    rows.push(['This slot now', spec.per(eff.current)])
    rows.push(['All slots like it', spec.per(total)])
  }

  // Цена следующего уровня — последней строкой, тем же форматом, что в ценнике
  // на кнопке: игрок сверяет их глазами, и «$25» против «25 cash» сбивало бы.
  const price = state.priceOf(def.key)
  rows.push(['Next level', def.currency === 'trophy' ? price + ' 🏆' : formatMoney(price)])

  return {
    key: def.key,
    title: def.name,
    badge: spec.badge,
    color: spec.color,
    body: spec.body,
    note,
    rows,
    // Замок показываем прямо в справке: на кнопке написано «Locked», а ПОЧЕМУ
    // — нигде, и это как раз тот вопрос, ради которого жмут ⓘ.
    lock: isUpgradeLocked(def, state)
      ? `Locked until you have earned ${TROPHY_UNLOCK_AT} trophies `
        + `(${formatGain(state.trophiesEarned)} so far).`
      : null,
  }
}
