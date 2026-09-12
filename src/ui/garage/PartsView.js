import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CAR_SHARD_KINDS, PART_BY_ID } from '../../config/garage.js'
import { SP } from '../../config/layout.js'
import { label, Button } from '../widgets.js'
import { fitText, flowRow, vcenter } from '../layout.js'
import { formatGain } from '../../utils/format.js'
import { card } from './cardBg.js'
import { PartPacks } from './PartPacks.js'

const HEAD_H = 38
const ROW_H = 46
const TOP_H = 78            // шапка: имя машины, Auto, баланс осколков
const BTN_W = 104
const BTN_H = 28
const SIDE_ICON = { off: '⚔', def: '🛡' }

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Части АКТИВНОЙ машины: восемь слотов [E], по сторонам ровно половина на
// половину (CAR_SLOT_SIDE), поэтому набор сам себя не штрафует перекосом.
// Владелец частей — машина, а не класс: купив новую, игрок переставляет части
// руками (см. partOwner в GarageSystem.js), и `Select a car first` [E] — это
// штатное состояние экрана, а не ошибка.
export class PartsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.hint = label(scene, w / 2, 40, 'Select a car first', { size: 13, color: CSS.muted, align: 'center' })
    this.add([this.bg, this.hint])

    this.carName = label(scene, SP.lg, 0, '', { size: 15, bold: true })
    this.auto = new Button(scene, 0, 0, BTN_W, BTN_H, 'Auto', { size: 12, fill: PAL.green })
    this.auto.on('press', () => this.doAuto())
    this.shards = CAR_SHARD_KINDS.map((kind) =>
      label(scene, SP.lg, 0, '', { size: 11, bold: true, color: hex(kind.color) }))
    this.slotsHead = label(scene, SP.lg, 0, 'PARTS', { size: 13, bold: true })
    this.add([this.carName, this.auto, ...this.shards, this.slotsHead])

    this.rows = state.carPartRows(state.car?.id ?? '').map((row, i) => {
      const side = label(scene, SP.lg, 0, SIDE_ICON[row.side] ?? '', { size: 12 })
      const name = label(scene, SP.lg + 20, 0, row.name, { size: 12, bold: true })
      const info = label(scene, SP.lg + 20, 0, '', { size: 10, color: CSS.muted })
      const btn = new Button(scene, 0, 0, BTN_W, BTN_H, '', { size: 11 })
      btn.on('press', () => this.act(i))
      this.add([side, name, info, btn])
      return { side, name, info, btn }
    })

    // Паки живут отдельным виджетом: вместе со слотами файл переваливал за 200
    // строк, а это две разные работы — «разобраться с надетым» и «добрать ещё».
    this.packs = new PartPacks(scene, state, w, { toast, onChange })
    this.add(this.packs)

    this.boxH = 0
    scene.add.existing(this)
  }

  // Лучшее, что лежит в сумке под этот слот. Надеть — это equipItem, то есть
  // ОБМЕН, если предмет занят другой машиной (см. GearBag.equipItem).
  bestFor(slot) {
    return this.state.parts.items
      .filter((it) => it.slot === slot)
      .sort((a, b) => this.state.parts.valueOf(b) - this.state.parts.valueOf(a))[0] ?? null
  }

  act(index) {
    const car = this.state.car
    if (!car) return
    const row = this.state.carPartRows(car.id)[index]
    if (row.item) {
      if (!this.state.upgradePart(row.item.uid)) { this.toast?.('Not enough shards', PAL.red); return }
      this.toast?.(`${row.name} · Lv. ${row.item.level}`, PAL.accent)
    } else {
      const best = this.bestFor(index)
      if (!best || !this.state.equipPart(car.id, index, best.uid)) return
      this.toast?.(`${PART_BY_ID[best.rarity].name} ${row.name} equipped`, PAL.green)
    }
    this.onChange?.()
  }

  doAuto() {
    const n = this.state.autoGarage()
    this.toast?.(n ? `Auto: ${n} changes` : 'Auto: nothing to do', PAL.accent)
    this.onChange?.()
  }

  // Кнопка строки: надетое апгрейдится осколками своей редкости, пустой слот
  // предлагает надеть лучшее из сумки, и только пустой слот без подходящего
  // предмета гаснет совсем.
  buttonFor(row, slot) {
    if (row.item) {
      const cost = this.state.parts.upgradeCost(row.item)
      if (!cost) return { text: 'Max', fill: PAL.line, enabled: false }
      return {
        text: `Upgrade ${cost.amount}◆`,
        fill: PART_BY_ID[row.item.rarity].color,
        enabled: this.state.parts.canUpgrade(row.item),
      }
    }
    return this.bestFor(slot)
      ? { text: 'Equip', fill: PAL.accent, enabled: true }
      : { text: 'Empty', fill: PAL.line, enabled: false }
  }

  infoFor(row) {
    if (!row.item) return { text: 'Empty slot', color: CSS.dim }
    const r = PART_BY_ID[row.item.rarity]
    const plus = row.item.plus ? ` +${row.item.plus}` : ''
    return {
      text: `${r.name}${plus} · Lv. ${row.item.level} / ${r.maxLevel} · ${formatGain(row.value)}`,
      color: hex(r.color),
    }
  }

  refresh() {
    const s = this.state
    const car = s.car
    this.bg.clear()
    this.hint.setVisible(!car)
    for (const o of [this.carName, this.auto, this.slotsHead, ...this.shards]) o.setVisible(!!car)
    for (const r of this.rows) for (const o of Object.values(r)) o.setVisible(!!car)
    this.packs.setVisible(!!car)
    if (!car) {
      card(this.bg, 0, this.boxW, 80)
      vcenter(this.hint.setPosition(this.boxW / 2, 0), 0, 80)
      this.boxH = 80
      return
    }

    let y = 0
    card(this.bg, y, this.boxW, TOP_H)
    this.carName.setPosition(SP.lg, y + SP.md).setText(car.name)
    fitText(this.carName.setFontSize(15), this.boxW - BTN_W - SP.lg * 3)
    this.auto.setPosition(this.boxW - SP.lg - BTN_W / 2, y + SP.md + BTN_H / 2)
    flowRow(this.shards.map((t, i) => t.setText(
      `${CAR_SHARD_KINDS[i].name.replace(' Garage Shards', '')} ${Math.floor(s.parts.shards[CAR_SHARD_KINDS[i].id] ?? 0)}◆`
    )), SP.lg, SP.md)
    for (const t of this.shards) t.setY(y + TOP_H - SP.md - t.height)
    y += TOP_H + SP.md

    const rows = s.carPartRows(car.id)
    card(this.bg, y, this.boxW, HEAD_H + ROW_H * rows.length + SP.sm)
    this.slotsHead.setPosition(SP.lg, y + 13)
    rows.forEach((row, i) => {
      const c = this.rows[i]
      const top = y + HEAD_H + i * ROW_H
      c.side.setPosition(SP.lg, top + SP.md)
      c.name.setPosition(SP.lg + 20, top + SP.sm).setText(row.name)
      const info = this.infoFor(row)
      c.info.setPosition(SP.lg + 20, top + 24).setText(info.text).setColor(info.color)
      fitText(c.info.setFontSize(10), this.boxW - BTN_W - SP.lg * 3 - 20)
      const b = this.buttonFor(row, i)
      c.btn.setPosition(this.boxW - SP.lg - BTN_W / 2, top + ROW_H / 2 - 2)
      c.btn.setText(b.text)
      c.btn.setFill(b.fill)
      c.btn.setEnabled(b.enabled)
      fitText(c.btn.txt.setFontSize(11), BTN_W - SP.md)
    })
    y += HEAD_H + ROW_H * rows.length + SP.sm + SP.md

    // Паки подклеиваются снизу измеренной высотой, а не константой: их число
    // задаёт config/garage.js.
    this.packs.setPosition(0, y)
    this.packs.refresh()
    this.boxH = y + this.packs.boxH
  }
}
