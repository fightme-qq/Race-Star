import {
  CORES, OUTFITS, OUTFIT_STARS, OUTFIT_STAR_GAIN, LUCKY, GIFT_CODES, AVATARS,
} from '../config/extras.js'

// Доборы шага 9, кроме коллекций: аутфиты, Lucky Draw, гифт-коды, аватары,
// Unique Cores. Чистые функции над блоком состояния (правило 2).

export const freshExtras = () => ({
  cores: 0,
  outfits: {},          // id -> {owned, stars}
  equipped: null,       // [E] `For equipping` — надет ровно один
  lucky: { key: 0, taken: [] },
  codes: [],            // использованные коды [E] `This Gift Code already used`
  avatar: 'rookie',
  frame: 'starter',
  frames: ['starter'],  // [E] `Starter Frame` / «Your starter frame.»
})

// --- Аутфиты -------------------------------------------------------------
// [E] «All outfits have Owned and Equipped bonuses. When you own multiple
// outfits, their Owned stats are combined. Each outfit can be upgraded up to 10
// stars using Shards.» То есть коллекционирование платит само по себе, а
// надевается один — ровно как в оригинале.
export const outfitState = (ex, id) => (ex.outfits[id] ??= { owned: false, stars: 0 })

export function outfitRows(ex) {
  return OUTFITS.map((def) => {
    const st = outfitState(ex, def.id)
    return { def, st, owned: st.owned, stars: st.stars, equipped: ex.equipped === def.id }
  })
}

const scaled = (bonus, stars) => {
  const out = {}
  for (const [k, v] of Object.entries(bonus)) out[k] = v * (1 + stars * OUTFIT_STAR_GAIN)
  return out
}

// Свод: сумма `Owned` по всем купленным + `Equipped` у надетого.
export function outfitEffects(ex) {
  const fx = { offPct: 0, defPct: 0, incomePct: 0, fansPct: 0 }
  for (const def of OUTFITS) {
    const st = outfitState(ex, def.id)
    if (!st.owned) continue
    for (const [k, v] of Object.entries(scaled(def.owned, st.stars))) fx[k] += v
    if (ex.equipped === def.id) {
      for (const [k, v] of Object.entries(scaled(def.equip, st.stars))) fx[k] += v
    }
  }
  return fx
}

export function grantOutfit(ex, id) {
  const st = outfitState(ex, id)
  if (!st.owned) { st.owned = true; if (!ex.equipped) ex.equipped = id; return 'new' }
  // [E] `Duplicate outfit converted` — дубликат идёт в звёзды.
  if (st.stars < OUTFIT_STARS) { st.stars++; return 'star' }
  return 'max'
}

export function equipOutfit(ex, id) {
  if (!outfitState(ex, id).owned) return false
  ex.equipped = id
  return true
}

// --- Unique Cores --------------------------------------------------------
// [E] «Unique driver upgrades permanently consume one driver to strengthen
// another!» — ядра И жертва, а не одно из двух.
export const coreSteps = (driver) => driver.coreSteps ?? 0

export const canCore = (ex, driver) =>
  !!driver && driver.rarity === 'unique'
  && coreSteps(driver) < CORES.maxSteps && ex.cores >= CORES.perStep

export function applyCore(ex, driver, victimStats) {
  if (!canCore(ex, driver)) return false
  ex.cores -= CORES.perStep
  driver.coreSteps = coreSteps(driver) + 1
  // Жертва не испаряется зря: её статы частично переносятся, как опыт при
  // тренировке [F]. Иначе «permanently consume» читается как наказание.
  if (victimStats) {
    driver.off += victimStats.off * CORES.gainPerStep
    driver.def += victimStats.def * CORES.gainPerStep
  }
  return true
}

export const coreBonus = (driver) => 1 + coreSteps(driver) * CORES.gainPerStep

// --- Lucky Draw ----------------------------------------------------------
// [E] «All rewards have been claimed» — сетка ВЫЧЕРПЫВАЕТСЯ. Поэтому хранится
// список взятых ячеек, а не счётчик прокрутов: последние призы дорожают по
// ожиданию сами собой, и легендарная машина [F] достижима, но не быстро.
const DAY = 86400000
export const luckyKey = (now = Date.now()) => Math.floor(now / (LUCKY.resetDays * DAY))

export function luckyRollover(lucky, now = Date.now()) {
  const key = luckyKey(now)
  if (lucky.key === key) return false
  lucky.key = key
  lucky.taken = []
  return true
}

export const luckyRows = (lucky) => LUCKY.prizes.map((prize, i) => ({
  index: i, prize, taken: lucky.taken.includes(i),
}))

export const luckyLeft = (lucky) => LUCKY.prizes.length - lucky.taken.length

export function luckyDraw(lucky, rnd) {
  const free = luckyRows(lucky).filter((r) => !r.taken)
  if (!free.length) return null
  const pick = free[Math.floor(rnd() * free.length)]
  lucky.taken.push(pick.index)
  return pick
}

// --- Гифт-коды -----------------------------------------------------------
// [E] `Gift Code not found`, `This Gift Code already used`,
// `GiftCode must be between {0} and {1} characters`.
export function redeemCode(ex, raw) {
  const code = String(raw || '').trim().toUpperCase()
  if (code.length < GIFT_CODES.minLen || code.length > GIFT_CODES.maxLen) {
    return { ok: false, why: `GiftCode must be between ${GIFT_CODES.minLen} and ${GIFT_CODES.maxLen} characters` }
  }
  if (ex.codes.includes(code)) return { ok: false, why: 'This Gift Code already used' }
  const rewards = GIFT_CODES.codes[code]
  if (!rewards) return { ok: false, why: 'Gift Code not found' }
  ex.codes.push(code)
  return { ok: true, rewards }
}

// --- Аватары и рамки -----------------------------------------------------
export function avatarRows(ex, stats) {
  return AVATARS.map((def) => {
    const need = def.need
    const open = !need
      || (need.races !== undefined && stats.races >= need.races)
      || (need.wins !== undefined && stats.wins >= need.wins)
      || (need.league !== undefined && stats.league >= need.league)
      || (need.albums !== undefined && stats.albums >= need.albums)
    return { def, open, active: ex.avatar === def.id }
  })
}

export function setAvatar(ex, id, stats) {
  const row = avatarRows(ex, stats).find((r) => r.def.id === id)
  if (!row?.open) return false
  ex.avatar = id
  return true
}

export function addFrame(ex, id) {
  if (!ex.frames.includes(id)) ex.frames.push(id)
  return true
}

export function setFrame(ex, id) {
  if (!ex.frames.includes(id)) return false
  ex.frame = id
  return true
}
