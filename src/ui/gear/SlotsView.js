import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SP, R } from '../../config/layout.js'
import { SLOT_COUNT, SHARD_KINDS } from '../../config/gear.js'
import { label, Button } from '../widgets.js'
import { fitText, flowRow } from '../layout.js'
import { SlotRow, SLOT_ROW_H } from './SlotRow.js'
import { hex, fmt, levelText, rarityOf, shardKind, SHARD_ICON, SIDE_ICON } from './gearText.js'

const HEAD_H = 74
const AUTO_W = 88
const PITCH = SLOT_ROW_H + SP.sm

// Десять слотов гира АКТИВНОГО класса [E]. Набор имён у каждого класса свой
// (`Balaclava` у Racing, `Helmet` у Rally), поэтому вид всегда показывает
// активный: гир, как и состав, у класса свой, и «общий список» врал бы.
//
// Тап по слоту надевает лучшее свободное из сумки — это единственное место, где
// переодевание делается одним движением. Полный разбор предмета живёт на
// вкладке BAG, здесь только то, что нужно для «одеться и поехать».
export class SlotsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.head = label(scene, SP.lg, SP.md + 2, 'GEAR BONUS', { size: 11, bold: true, color: CSS.muted })
    this.slotsTxt = label(scene, w - SP.md - AUTO_W - SP.md, SP.md + 2, '',
      { size: 11, color: CSS.muted, align: 'right' })
    this.total = label(scene, SP.lg, 26, '', { size: 15, bold: true })
    // Осколки — три отдельные метки, покрашенные по SHARD_KINDS, и разложенные
    // flowRow от ИЗМЕРЕННЫХ ширин: «⬢ 1248 Legendary Shards» длиннее «⬢ 0», и
    // посчитанный на глаз шаг сложил бы их друг на друга.
    this.shards = SHARD_KINDS.map((k) => label(scene, SP.lg, 52, '', { size: 10, color: hex(k.color) }))
    this.auto = new Button(scene, w - SP.md - AUTO_W / 2, HEAD_H / 2 - 6, AUTO_W, 30, 'Auto', { size: 12 })
    this.auto.on('press', () => this.runAuto())
    this.add([this.bg, this.head, this.slotsTxt, this.total, ...this.shards, this.auto])

    this.rows = Array.from({ length: SLOT_COUNT }, () => new SlotRow(scene, w, {
      onTap: (slot) => this.tap(slot),
      onUnequip: (slot) => this.unequip(slot),
      onUpgrade: (slot) => this.upgrade(slot),
    }))
    this.add(this.rows)

    this.boxH = 0
    scene.add.existing(this)
  }

  get races() { return this.state.cls.races || 0 }

  // Лучшее свободное (нигде не надетое) для слота. Занятое другим классом не
  // берём: обмен ослабил бы класс, в который игрок не смотрит, — та же причина,
  // по которой так же ведёт себя autoManage.
  bestFor(slot) {
    const bag = this.state.gear
    return bag.items
      .filter((it) => it.slot === slot && !bag.whereEquipped(it.uid))
      .sort((a, b) => bag.valueOf(b) - bag.valueOf(a))[0] ?? null
  }

  tap(slot) {
    const s = this.state
    const row = s.gearRows()[slot]
    if (!row.open) {
      this.toast?.(`Play ${Math.max(0, row.needs - this.races)} races to unlock ${row.name}`, PAL.muted)
      return
    }
    const best = this.bestFor(slot)
    if (!best || (row.item && s.gear.valueOf(best) <= row.value)) {
      // Тап по занятому слоту, когда лучше в сумке нет, снимает предмет: так
      // сам слот остаётся переключателем, а ✕ — явной подсказкой, что так можно.
      if (row.item) { this.unequip(slot); return }
      this.toast?.(`No ${row.name} in the bag yet`, PAL.muted)
      return
    }
    if (!s.equipGear(slot, best.uid)) return
    this.toast?.(`${rarityOf(best).name} ${row.name} equipped`, rarityOf(best).color)
    this.onChange?.()
  }

  unequip(slot) {
    const row = this.state.gearRows()[slot]
    if (!this.state.unequipGear(slot)) return
    this.toast?.(`${row.name} unequipped`, PAL.muted)
    this.onChange?.()
  }

  upgrade(slot) {
    const s = this.state
    const row = s.gearRows()[slot]
    if (!row.item) return
    const cost = s.gear.upgradeCost(row.item)
    if (!cost) return
    if (!s.upgradeGear(row.item.uid)) {
      this.toast?.(`Need ${SHARD_ICON} ${cost.amount} ${shardKind(cost.kind).name}`, PAL.red)
      return
    }
    this.toast?.(`${row.name} ${levelText(row.item)}`, PAL.green)
    this.onChange?.()
  }

  runAuto() {
    const n = this.state.autoGear()
    this.toast?.(n ? `Auto: ${n} changes` : 'Gear is already optimal', n ? PAL.accent : PAL.muted)
    if (n) this.onChange?.()
  }

  refresh() {
    const s = this.state
    const rows = s.gearRows()
    const races = this.races

    // Вклад гира считается из тех же строк, что рисуются: вторая сумма рядом с
    // powerOf() разошлась бы с ней молча.
    let off = 0
    let def = 0
    for (const row of rows) {
      if (!row.item) continue
      if (row.side === 'off') off += row.value
      else def += row.value
    }

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, HEAD_H, R.lg)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, HEAD_H, R.lg)

    this.slotsTxt.setText(`Slots ${s.gearOpenSlots} / ${SLOT_COUNT}`)
    fitText(this.total.setFontSize(15)
      .setText(`${SIDE_ICON.off} ${fmt(off)}     ${SIDE_ICON.def} ${fmt(def)}`),
    this.boxW - AUTO_W - SP.lg - SP.md * 2)

    const cellW = (this.boxW - SP.lg * 2) / SHARD_KINDS.length
    SHARD_KINDS.forEach((kind, i) => {
      const t = this.shards[i]
      fitText(t.setFontSize(10).setText(`${SHARD_ICON} ${s.gear.shards[kind.id] ?? 0} ${kind.name}`),
        cellW - SP.sm)
    })
    // Кегль у всех трёх одинаковый — по самой длинной: разный размер в одном
    // ряду читается как «у легендарных осколков подпись другого сорта».
    const size = Math.min(...this.shards.map((t) => parseInt(t.style.fontSize, 10)))
    for (const t of this.shards) t.setFontSize(size)
    flowRow(this.shards, SP.lg, SP.md)

    const top = HEAD_H + SP.md
    rows.forEach((row, i) => {
      const cost = row.item ? s.gear.upgradeCost(row.item) : null
      this.rows[i].place(top + i * PITCH, row, {
        cost,
        affordable: !!row.item && s.gear.canUpgrade(row.item),
        racesLeft: Math.max(0, row.needs - races),
      })
    })

    this.boxH = top + SLOT_COUNT * PITCH - SP.sm
  }
}
