import { SeededRandom, randomSeed } from '../utils/rng.js'

// Инвентарь снаряжения — ЧИСТАЯ математика, без единого объекта сцены
// (правило 2): по нему ходит и игрок, и балансный стенд.
//
// Класс намеренно СЛЕПОЙ к тому, что в нём лежит. Домен описывается объектом
// `kind` (редкости, слоты, паки, множитель), и таких доменов два: гир драйверов
// (10 слотов, config/gear.js) и части машины (8 слотов, config/garage.js).
// Вторая копия этой логики для гаража разошлась бы с первой молча — ровно так,
// как расходились три копии формулы заезда до RaceModel.js (правило 16).
//
// [X] Упрощение, которое надо знать: предмет привязан к НОМЕРУ слота, а не к
// классу. В оригинале у каждого класса свой набор имён (`Balaclava` у Racing,
// `Helmet` у Rally), и из этого можно было бы заключить, что и предметы разные.
// Тогда инвентарь пришлось бы набивать шесть раз, а переход между классами —
// который шаг 3b сделал главным решением игры — стал бы запретительно дорогим.
// Поэтому предмет носится любым классом, а имя слота берётся из набора класса.

export class GearBag {
  constructor(kind, saved) {
    this.kind = kind
    this.seed = saved?.seed ?? randomSeed()
    this.seq = saved?.seq ?? 1
    this.rolls = saved?.rolls ?? 0
    this.items = saved?.items ?? []
    this.equip = saved?.equip ?? {}
    this.shards = { ...kind.freshShards(), ...(saved?.shards ?? {}) }
    this.coupons = { ...kind.freshCoupons(), ...(saved?.coupons ?? {}) }
    this.pity = saved?.pity ?? {}
    this.rebuild()
  }

  toJSON() {
    const { seed, seq, rolls, items, equip, shards, coupons, pity } = this
    return { seed, seq, rolls, items, equip, shards, coupons, pity }
  }

  // Статы снаряжения дёргает powerOf(), то есть несколько раз за кадр, —
  // кэшируем по владельцу так же, как Roster кэширует пятёрку.
  rebuild() {
    this.index = new Map(this.items.map((it) => [it.uid, it]))
    this.cache = new Map()
  }

  touch() { this.cache = new Map() }

  get(uid) { return this.index.get(uid) }

  // Сид хранится номером ролла, а не состоянием ГПСЧ: сейв остаётся простым
  // JSON, а выпадения воспроизводимы (как в Roster).
  nextRng() {
    const mixed = (Math.imul(this.seed ^ (this.rolls++ + 0x9e3779b9), 0x85ebca6b) >>> 0)
    return new SeededRandom(mixed)
  }

  // --- предметы -----------------------------------------------------------

  create(slot, rarityId) {
    const it = { uid: this.seq++, slot, rarity: rarityId, level: 0, plus: 0 }
    this.items.push(it)
    this.index.set(it.uid, it)
    this.touch()
    return it
  }

  remove(uid) {
    const i = this.items.findIndex((it) => it.uid === uid)
    if (i >= 0) this.items.splice(i, 1)
    this.index.delete(uid)
    // Снятым со всех владельцев: иначе в equip остаётся висячая ссылка, и слот
    // читается как занятый, хотя силы не даёт.
    for (const map of Object.values(this.equip)) {
      for (const [slot, u] of Object.entries(map)) if (u === uid) delete map[slot]
    }
    this.touch()
  }

  // Сила предмета. Уровень даёт плоскую прибавку, плюс-ступень — долю от базы.
  valueOf(it) {
    const r = this.kind.rarityOf(it.rarity)
    if (!r) return 0
    return (r.base + r.perLevel * it.level) * (1 + it.plus * this.kind.plusGain) * this.kind.statMult()
  }

  // Сумма по надетому: {off, def}. Сторону слота задаёт домен.
  statsOf(owner) {
    let hit = this.cache.get(owner)
    if (!hit) {
      hit = { off: 0, def: 0 }
      for (const [slot, uid] of Object.entries(this.equip[owner] ?? {})) {
        const it = this.get(uid)
        if (!it) continue
        hit[this.kind.sideOf(Number(slot))] += this.valueOf(it)
      }
      this.cache.set(owner, hit)
    }
    return hit
  }

  equippedUid(owner, slot) { return this.equip[owner]?.[slot] ?? null }

  // Где предмет надет: [owner, slot] или null. [E] `Already equipped`.
  whereEquipped(uid) {
    for (const [owner, map] of Object.entries(this.equip)) {
      for (const [slot, u] of Object.entries(map)) if (u === uid) return [owner, Number(slot)]
    }
    return null
  }

  // Надеть. Если предмет уже занят у другого владельца — ОБМЕН, а не изъятие:
  // та же причина, что у Roster.assign (правило 22). Снять предмет с чужого
  // слота молча значило бы ослабить класс, в который игрок не смотрит.
  equipItem(owner, slot, uid) {
    const it = this.get(uid)
    if (!it || it.slot !== slot) return false
    const map = (this.equip[owner] ??= {})
    const prev = map[slot] ?? null
    if (prev === uid) return false
    const busy = this.whereEquipped(uid)
    map[slot] = uid
    if (busy) {
      const other = this.equip[busy[0]]
      if (prev) other[busy[1]] = prev
      else delete other[busy[1]]
    }
    this.touch()
    return true
  }

  unequip(owner, slot) {
    const map = this.equip[owner]
    if (!map?.[slot]) return false
    delete map[slot]
    this.touch()
    return true
  }

  // --- уровни и осколки ---------------------------------------------------

  upgradeCost(it) {
    const r = this.kind.rarityOf(it.rarity)
    if (!r || it.level >= r.maxLevel) return null
    return { kind: r.shard, amount: Math.round(r.shardCost * Math.pow(this.kind.shardGrowth, it.level)) }
  }

  canUpgrade(it) {
    const c = this.upgradeCost(it)
    return !!c && (this.shards[c.kind] ?? 0) >= c.amount
  }

  upgrade(uid) {
    const it = this.get(uid)
    if (!it || !this.canUpgrade(it)) return false
    const c = this.upgradeCost(it)
    this.shards[c.kind] -= c.amount
    it.level++
    this.touch()
    return true
  }

  addShards(kind, amount) { this.shards[kind] = (this.shards[kind] ?? 0) + amount }

  // --- merge --------------------------------------------------------------
  // [E] `Rarity Upgrades` / `Merge`: дубликат поднимает плюс-ступень. Когда
  // ступени кончились, дубликат НЕ мусор — он рассыпается в осколки своей
  // редкости (`dust`), иначе топовый предмет с третьего выпадения обесценен,
  // и дожимать пак становится незачем.
  mergePartner(it) {
    return this.items.find((o) => o.uid !== it.uid && o.slot === it.slot
      && o.rarity === it.rarity && !this.whereEquipped(o.uid)) ?? null
  }

  merge(targetUid, victimUid) {
    const t = this.get(targetUid)
    const v = this.get(victimUid)
    if (!t || !v || t.uid === v.uid) return false
    if (t.slot !== v.slot || t.rarity !== v.rarity) return false
    if (this.whereEquipped(v.uid)) return false
    const r = this.kind.rarityOf(t.rarity)
    if (t.plus >= r.maxPlus) { this.addShards(r.shard, r.dust); this.remove(v.uid); return true }
    t.plus++
    this.remove(v.uid)
    this.touch()
    return true
  }

  // Рассыпать предмет в осколки вручную — [E] `Parts`. Надетый не рассыпается.
  scrap(uid) {
    const it = this.get(uid)
    if (!it || this.whereEquipped(uid)) return false
    const r = this.kind.rarityOf(it.rarity)
    this.addShards(r.shard, r.dust * (1 + it.plus) + Math.round(r.shardCost * it.level * 0.5))
    this.remove(uid)
    return true
  }

  // --- паки ---------------------------------------------------------------

  drawOne(packId) {
    const pack = this.kind.packOf(packId)
    const pityCount = this.pity[packId] ?? 0
    const rng = this.nextRng()
    let rarity = null
    if (pityCount + 1 >= pack.pityAt) rarity = pack.pityRarity
    else {
      let roll = rng.float(0, 1)
      for (const [id, p] of Object.entries(pack.odds)) { roll -= p; if (roll <= 0) { rarity = id; break } }
      rarity ??= Object.keys(pack.odds)[0]
    }
    const reached = this.kind.indexOf(rarity) >= this.kind.indexOf(pack.pityRarity)
    this.pity[packId] = reached ? 0 : pityCount + 1
    const slot = Math.floor(rng.float(0, this.kind.slotCount))
    return this.create(Math.min(this.kind.slotCount - 1, slot), rarity)
  }

  draw(packId, count) {
    const out = []
    for (let i = 0; i < count; i++) out.push(this.drawOne(packId))
    return out
  }

  pityLeft(packId) { return this.kind.packOf(packId).pityAt - (this.pity[packId] ?? 0) }

  couponsOf(packId) {
    const def = this.kind.couponFor(packId)
    return def ? (this.coupons[def.id] ?? 0) : 0
  }

  spendCoupon(packId) {
    const def = this.kind.couponFor(packId)
    if (!def || (this.coupons[def.id] ?? 0) < 1) return false
    this.coupons[def.id]--
    return true
  }

  addCoupon(id, amount = 1) { this.coupons[id] = (this.coupons[id] ?? 0) + amount }

  // --- авто ---------------------------------------------------------------
  // Один ход «разобраться с инвентарём»: merge дубликатов, надеть лучшее в
  // каждый открытый слот, лишнее рассыпать. Этим же ходит бот стенда, поэтому
  // логика здесь, а не в UI (как autoManage у Roster).
  autoManage(owner, openSlots) {
    let changed = 0
    for (const it of [...this.items]) {
      if (!this.get(it.uid)) continue
      let partner
      while ((partner = this.mergePartner(it))) { this.merge(it.uid, partner.uid); changed++ }
    }
    for (let slot = 0; slot < this.kind.slotCount; slot++) {
      if (!openSlots(slot)) continue
      const best = this.items
        .filter((it) => it.slot === slot)
        .sort((a, b) => this.valueOf(b) - this.valueOf(a))[0]
      if (best && this.equippedUid(owner, slot) !== best.uid) {
        const where = this.whereEquipped(best.uid)
        // Чужой слот не трогаем: обмен здесь ослабил бы другой класс без
        // ведома игрока, а автокнопка должна быть безопасной.
        if (!where || where[0] === owner) { this.equipItem(owner, slot, best.uid); changed++ }
      }
    }
    return changed
  }

  // Лучшее вложение осколков: самый дешёвый апгрейд среди НАДЕТОГО. Апгрейд
  // предмета в сумке силы не даёт — оценщик, который этого не видит, сливал бы
  // осколки в запас (правило 15).
  bestUpgrade(owner) {
    const worn = Object.values(this.equip[owner] ?? {}).map((uid) => this.get(uid)).filter(Boolean)
    let best = null
    for (const it of worn) {
      const c = this.upgradeCost(it)
      if (!c || (this.shards[c.kind] ?? 0) < c.amount) continue
      if (!best || c.amount < best.cost.amount) best = { it, cost: c }
    }
    return best
  }
}
