import { SeededRandom, randomSeed } from '../utils/rng.js'
import {
  SQUAD_SIZE, STARTER_STATS, PACK_BY_ID, RARITY_INDEX, STARS,
} from '../config/drivers.js'
import {
  makeDriver, effStats, ratingOf, addXp, feedXpOf, drawRarity, resetsPity, canMerge,
} from './DriverSystem.js'

// Состав и резерв. Драйверы живут в ОДНОМ общем пуле, а `squads` держит по
// пять uid на класс — в оригинале драйвер назначается классу
// («Assign your driver to a class»), а не дублируется.

const mix = (a, b) => (Math.imul(a ^ (b + 0x9e3779b9), 0x85ebca6b) >>> 0)

export class Roster {
  constructor(saved) {
    this.seed = saved?.seed ?? randomSeed()
    this.seq = saved?.seq ?? 1
    this.rolls = saved?.rolls ?? 0
    this.drivers = saved?.drivers ?? []
    this.squads = saved?.squads ?? {}
    this.pity = saved?.pity ?? {}
    this.rebuild()
  }

  toJSON() {
    const { seed, seq, rolls, drivers, squads, pity } = this
    return { seed, seq, rolls, drivers, squads, pity }
  }

  // Индекс uid -> драйвер и кэш статов состава. Статы дёргает incomePerSec,
  // то есть несколько раз за кадр — пересчитывать пятёрку каждый раз незачем.
  rebuild() {
    this.index = new Map(this.drivers.map((d) => [d.uid, d]))
    this.statsCache = new Map()
  }

  touch() { this.statsCache = new Map() }

  get(uid) { return this.index.get(uid) }

  // Гача сидированная: состояние ГПСЧ не храним, вместо него — номер ролла.
  // Так сейв остаётся простым JSON, а последовательность воспроизводима.
  nextRng() { return new SeededRandom(mix(this.seed, this.rolls++)) }

  create(rarityId, defId = null) {
    const d = makeDriver(this.seq++, rarityId, this.nextRng(), defId)
    this.drivers.push(d)
    this.index.set(d.uid, d)
    this.touch()
    return d
  }

  // Пятёрка стартовых на класс [F]. Статы фиксированные (STARTER_STATS):
  // их сумма — точка калибровки экономики, случайный ролл сдвинул бы вехи.
  ensureStarters(classId, classIndex) {
    // Отсеиваем битые ссылки: если сейв пережил удаление драйвера из состава,
    // слот должен заполниться заново, а не остаться дырой в силе команды.
    const uids = (this.squads[classId] ?? []).filter((uid) => this.get(uid))
    this.squads[classId] = uids
    if (uids.length >= SQUAD_SIZE) return
    for (let i = uids.length; i < SQUAD_SIZE; i++) {
      const d = this.create('amateur', classIndex * SQUAD_SIZE + i)
      Object.assign(d, STARTER_STATS[i])
      uids.push(d.uid)
    }
    this.squads[classId] = uids
    this.touch()
  }

  squadUids(classId) { return this.squads[classId] ?? [] }

  squad(classId) {
    return this.squadUids(classId).map((uid) => this.get(uid)).filter(Boolean)
  }

  inSquad(uid) {
    return Object.values(this.squads).some((list) => list.includes(uid))
  }

  reserves() { return this.drivers.filter((d) => !this.inSquad(d.uid)) }

  // Сила команды = сумма эффективных статов пятёрки. Проценты боевых
  // апгрейдов накладываются поверх — в GameState.
  teamStats(classId) {
    let hit = this.statsCache.get(classId)
    if (!hit) {
      hit = { off: 0, def: 0 }
      for (const d of this.squad(classId)) {
        const e = effStats(d)
        hit.off += e.off
        hit.def += e.def
      }
      this.statsCache.set(classId, hit)
    }
    return hit
  }

  // Swap Driver: резервный встаёт в слот, прежний уходит в резерв.
  assign(classId, slot, uid) {
    const list = this.squads[classId]
    if (!list || slot < 0 || slot >= SQUAD_SIZE) return false
    if (!this.get(uid) || this.inSquad(uid)) return false
    list[slot] = uid
    this.touch()
    return true
  }

  // Тренировка: корм исчезает, его опыт переходит цели без потерь [F].
  train(targetUid, feedUids) {
    const target = this.get(targetUid)
    if (!target) return null
    let xp = 0
    let levels = 0
    for (const uid of feedUids) {
      const feed = this.get(uid)
      if (!feed || feed.uid === targetUid || this.inSquad(uid)) continue
      xp += feedXpOf(feed)
      levels += addXp(target, feedXpOf(feed))
      this.remove(uid)
    }
    this.touch()
    return { xp, levels }
  }

  // Merge дубликатов: та же пара (имя, редкость) -> +1 звезда.
  // «Drivers in Squad cannot be used for upgrades» — жертва только из резерва.
  merge(targetUid, victimUid) {
    const target = this.get(targetUid)
    const victim = this.get(victimUid)
    if (!canMerge(target, victim) || this.inSquad(victimUid)) return false
    target.stars = Math.min(STARS.max, target.stars + 1)
    // Опыт жертвы тоже не пропадает — иначе merge конфликтовал бы с тренировкой.
    addXp(target, victim.totalXp)
    this.remove(victimUid)
    this.touch()
    return true
  }

  mergePartner(target) {
    return this.reserves().find((d) => canMerge(target, d)) ?? null
  }

  remove(uid) {
    const i = this.drivers.findIndex((d) => d.uid === uid)
    if (i >= 0) this.drivers.splice(i, 1)
    this.index.delete(uid)
    this.touch()
  }

  // Открытие пака. Гемы списывает GameState — здесь только выдача.
  draw(packId, count) {
    const pack = PACK_BY_ID[packId]
    const out = []
    for (let i = 0; i < count; i++) {
      const pity = this.pity[packId] ?? 0
      const rarity = drawRarity(pack, pity, this.nextRng())
      this.pity[packId] = resetsPity(pack, rarity) ? 0 : pity + 1
      out.push(this.create(rarity))
    }
    return out
  }

  pityLeft(packId) {
    const pack = PACK_BY_ID[packId]
    return pack.pityAt - (this.pity[packId] ?? 0)
  }

  // Автосостав: merge дубликатов -> топ-5 по рейтингу в состав -> остальных
  // скормить сильнейшему. Этим же ходит бот в балансном стенде, поэтому
  // логика живёт здесь, а не в UI.
  autoManage(classId) {
    const list = this.squads[classId]
    if (!list) return null

    for (const d of [...this.drivers]) {
      if (d.stars >= STARS.max || !this.get(d.uid)) continue
      let partner
      while ((partner = this.mergePartner(d))) this.merge(d.uid, partner.uid)
    }

    const ranked = [...this.drivers].sort((a, b) => ratingOf(b) - ratingOf(a))
    const wanted = []
    for (const d of ranked) {
      if (wanted.length >= SQUAD_SIZE) break
      // Драйвер, занятый в составе другого класса, не забираем.
      if (this.inSquad(d.uid) && !list.includes(d.uid)) continue
      wanted.push(d.uid)
    }
    for (let i = 0; i < wanted.length; i++) list[i] = wanted[i]
    this.touch()

    const best = this.squad(classId).sort((a, b) => ratingOf(b) - ratingOf(a))[0]
    const feed = this.reserves().map((d) => d.uid)
    const trained = best && feed.length ? this.train(best.uid, feed) : null
    return { trained, best }
  }

  // Сортировка резерва для UI: сильные сверху, но дубликаты — рядом.
  sortedReserves() {
    return this.reserves().sort((a, b) =>
      RARITY_INDEX[b.rarity] - RARITY_INDEX[a.rarity] || ratingOf(b) - ratingOf(a))
  }
}
