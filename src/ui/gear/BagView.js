import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SP, R } from '../../config/layout.js'
import { SLOT_COUNT } from '../../config/gear.js'
import { slotName } from '../../systems/GearSystem.js'
import { label, Button } from '../widgets.js'
import { columns, fitText } from '../layout.js'
import { GearCard, GCARD_H } from './GearCard.js'
import { levelText, rarityOf, shardKind, SHARD_ICON } from './gearText.js'

const COLS = 3
const HEAD_H = 62
const STRIP_H = 32
const PITCH = GCARD_H + SP.sm

// Сумка: всё, что НЕ надето ни одним классом. Надетое показано на вкладке GEAR,
// и второй раз здесь оно только путало бы — «Merge» и «Scrap» к нему неприменимы
// (GearBag отказывает надетому), а кнопка, которая всегда отказывает, хуже
// отсутствующей.
//
// Панель действий вставляется В СЕТКУ под ряд выбранного предмета, а не прибита
// к низу вида: вид целиком лежит в ScrollView модалки, прибитая панель уехала бы
// вместе с содержимым (у SquadView для этого свой внутренний скролл, и второй
// вложенный скролл здесь означал бы два набора слушателей на одном жесте).
export class BagView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange
    this.pickUid = null
    this.signature = null
    this.cards = []

    this.bg = scene.add.graphics()
    this.summary = label(scene, SP.lg, 12, '', { size: 14, bold: true })
    this.count = label(scene, w - SP.lg, 15, '', { size: 11, color: CSS.muted, align: 'right' })
    this.hint = label(scene, SP.lg, 36, '', { size: 10, color: CSS.dim })
    this.add([this.bg, this.summary, this.count, this.hint])

    this.cols = columns(0, w, COLS, SP.sm)
    this.actions = ['Merge', 'Scrap', 'Equip'].map((text, i) => {
      const btn = new Button(this.scene, this.cols[i].cx, 0, this.cols[i].w, STRIP_H, text,
        { size: 12, fill: i === 1 ? PAL.line : PAL.accent })
      btn.on('press', () => this.act(i))
      this.add(btn)
      return btn
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  get bag() { return this.state.gear }

  // Предметы в сумке: сначала по слоту, внутри — сильнейшие сверху. Порядок
  // выпадения не несёт смысла, а прыгающая сетка после каждого открытия
  // пака делала бы выбор невозможным.
  bagItems() {
    const bag = this.bag
    return bag.items
      .filter((it) => !bag.whereEquipped(it.uid))
      .sort((a, b) => a.slot - b.slot || bag.valueOf(b) - bag.valueOf(a))
  }

  build(items) {
    for (const c of this.cards) c.destroy()
    this.cards = items.map((it) => new GearCard(this.scene, it, this.cols[0].w, {
      title: slotName(this.state.activeClass, it.slot),
      value: this.bag.valueOf(it),
      onTap: (item) => {
        this.pickUid = this.pickUid === item.uid ? null : item.uid
        this.refresh()
      },
    }))
    this.add(this.cards)
    this.signature = this.sigOf(items)
  }

  // Подпись списка: пересобираем сетку только когда она правда изменилась —
  // refresh зовётся пять раз в секунду (MainScene), и пересборка на каждом
  // тике рвала бы выбор игрока.
  sigOf(items) { return items.map((it) => `${it.uid}.${it.level}.${it.plus}`).join(',') }

  get pick() { return this.pickUid === null ? null : this.bag.get(this.pickUid) }

  act(index) {
    const it = this.pick
    if (!it) return
    if (index === 0) this.merge(it)
    else if (index === 1) this.scrap(it)
    else this.equip(it)
  }

  merge(it) {
    const partner = this.bag.mergePartner(it)
    if (!partner) return
    const r = rarityOf(it)
    const maxed = it.plus >= r.maxPlus
    if (!this.state.mergeGear(it.uid, partner.uid)) return
    this.toast?.(maxed
      ? `Duplicate → ${SHARD_ICON} ${r.dust} ${shardKind(r.shard).name}`
      : `${r.name} ${slotName(this.state.activeClass, it.slot)} +${it.plus}`, PAL.gold)
    this.onChange?.()
  }

  scrap(it) {
    const r = rarityOf(it)
    if (!this.state.scrapGear(it.uid)) return
    this.pickUid = null
    this.toast?.(`${r.name} scrapped into ${shardKind(r.shard).name}`, PAL.muted)
    this.onChange?.()
  }

  equip(it) {
    const name = slotName(this.state.activeClass, it.slot)
    if (!this.state.equipGear(it.slot, it.uid)) {
      this.toast?.(`${name}: slot not available yet`, PAL.muted)
      return
    }
    this.pickUid = null
    this.toast?.(`${rarityOf(it).name} ${name} equipped`, rarityOf(it).color)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const items = this.bagItems()
    if (this.sigOf(items) !== this.signature) this.build(items)
    if (this.pickUid !== null && !this.bag.get(this.pickUid)) this.pickUid = null

    const rows = s.gearRows()
    const worn = rows.filter((r) => r.item).length
    this.summary.setText(`Equipped ${worn} / ${s.gearOpenSlots}`)
    this.count.setText(`${items.length} in bag  ·  ${SLOT_COUNT} slots`)
    fitText(this.hint.setFontSize(10).setText(items.length
      ? 'Tap an item — actions appear under it'
      : 'Empty. Gear comes from packs on the PACKS tab.'), this.boxW - SP.lg * 2)

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, HEAD_H, R.lg)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, HEAD_H, R.lg)

    const top = HEAD_H + SP.md
    const pickIndex = this.cards.findIndex((c) => c.item.uid === this.pickUid)
    const pickRow = pickIndex < 0 ? -1 : Math.floor(pickIndex / COLS)
    this.cards.forEach((card, i) => {
      const row = Math.floor(i / COLS)
      const shift = pickRow >= 0 && row > pickRow ? STRIP_H + SP.sm : 0
      card.setPosition(this.cols[i % COLS].x, top + row * PITCH + shift)
      card.setSelected(card.item.uid === this.pickUid)
    })

    const gridRows = Math.ceil(this.cards.length / COLS)
    this.placeStrip(pickRow < 0 ? -1 : top + (pickRow + 1) * PITCH)
    this.boxH = top + gridRows * PITCH - SP.sm + (pickRow >= 0 ? STRIP_H + SP.sm : 0)
  }

  placeStrip(y) {
    const it = this.pick
    const shown = y >= 0 && !!it
    for (const btn of this.actions) btn.setVisible(shown)
    if (!shown) return
    const r = rarityOf(it)
    const partner = this.bag.mergePartner(it)
    this.actions.forEach((btn, i) => btn.setPosition(this.cols[i].cx, y + STRIP_H / 2))
    // `Merge` с исчерпанными плюс-ступенями не исчезает, а меняет смысл:
    // дубликат рассыпается в осколки (GearBag.merge), и прятать это значило бы
    // прятать единственный выход для третьего Legendary.
    this.actions[0].setText(!partner ? 'Merge'
      : it.plus < r.maxPlus ? `Merge +${it.plus + 1}` : `Merge ${SHARD_ICON}`)
    this.actions[0].setEnabled(!!partner)
    this.actions[0].setFill(partner ? PAL.gold : PAL.line)
    this.actions[1].setText('Scrap')
    this.actions[1].setEnabled(true)
    this.actions[2].setText(`Equip ${levelText(it)}`)
    this.actions[2].setEnabled(this.state.gearSlotOpen(it.slot))
    for (const btn of this.actions) fitText(btn.txt.setFontSize(12), this.cols[0].w - SP.md)
  }
}
