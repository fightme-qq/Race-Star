import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { OUTFIT_STARS } from '../../config/extras.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'

const HEADER_H = 76
const ROW_H = 84
const GAP = 8
const PAD = 14

// Иконки совпадают с остальным интерфейсом: ⚔/🛡 стоят на карточке драйвера и
// в шапке карьеры, 💵 — у награды деньгами, 👥 — у фанатов.
const FX_ICON = { offPct: '⚔', defPct: '🛡', incomePct: '💵', fansPct: '👥' }

const pct = (v) => `+${Math.round(v * 10) / 10}%`

const bonusLine = (bonus) =>
  Object.entries(bonus).map(([k, v]) => `${FX_ICON[k] ?? ''} ${pct(v)}`).join('   ')

// Аутфиты карьерного драйвера [E]: «All outfits have Owned and Equipped
// bonuses. When you own multiple outfits, their Owned stats are combined. Each
// outfit can be upgraded up to 10 stars using Shards.» Отсюда вся композиция:
// у каждой строки ДВЕ строки бонуса, звёзд ровно десять, надет один.
//
// Купить аутфит нельзя — единственные источники это Lucky Draw [E] («no active
// Lucky Draw with Career Driver Outfits») и Ultimate Reward коллекций. Поэтому
// у ненадетой строки не кнопка «Buy», а подсказка, откуда она берётся.
export class OutfitsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, PAD, 12, 'Outfits', { size: 16, bold: true })
    this.count = label(scene, w - PAD, 15, '', { size: 12, color: CSS.muted, align: 'right' })
    this.total = label(scene, PAD, 36, '', { size: 11, bold: true, color: CSS.accent })
    this.hint = label(scene, PAD, 55, 'Owned bonuses stack · one outfit is equipped',
      { size: 10, color: CSS.dim })
    this.add([this.bg, this.title, this.count, this.total, this.hint])

    this.rows = state.outfits.map((row) => {
      const r = {
        id: row.def.id,
        name: label(scene, PAD, 0, row.def.name, { size: 13, bold: true }),
        ownedLine: label(scene, PAD, 0, '', { size: 10, color: CSS.muted }),
        equipLine: label(scene, PAD, 0, '', { size: 10, color: CSS.muted }),
        source: label(scene, w - PAD, 0, 'From Lucky Draw', { size: 9, color: CSS.dim, align: 'right' }),
        btn: new Button(scene, w - PAD - 50, 0, 100, 28, 'Equip', { size: 11 }),
      }
      r.btn.on('press', () => this.equip(r.id))
      this.add([r.name, r.ownedLine, r.equipLine, r.source, r.btn])
      return r
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  equip(id) {
    if (!this.state.equipOutfitId(id)) { this.toast?.('Not owned yet', PAL.muted); return }
    this.toast?.('Outfit equipped', PAL.gold)
    this.onChange?.()
  }

  // Подложка строки — `panelAlt`, а не `panel`, как в магазине: этот вид живёт
  // внутри БЕЛОЙ карточки карьеры, и белое на белом видно только по рамке.
  card(y, h, { stroke = PAL.line, weight = 1 } = {}) {
    this.bg.fillStyle(PAL.panelAlt, 1)
    this.bg.fillRoundedRect(0, y, this.boxW, h, 12)
    this.bg.lineStyle(weight, stroke, 1)
    this.bg.strokeRoundedRect(0, y, this.boxW, h, 12)
  }

  // Десять засечек звёзд рисуются графикой, а не строкой из ★: десять символов
  // одним текстом нельзя покрасить двумя цветами, а «★3/10» не показывает, что
  // предел именно десять.
  pips(x, y, stars) {
    for (let i = 0; i < OUTFIT_STARS; i++) {
      this.bg.fillStyle(i < stars ? PAL.gold : PAL.line, 1)
      this.bg.fillCircle(x + 4 + i * 11, y, 3.5)
    }
  }

  refresh() {
    const s = this.state
    const rows = s.outfits
    const fx = s.outfitFx

    this.bg.clear()
    this.card(0, HEADER_H)
    this.count.setText(`${rows.filter((r) => r.owned).length} / ${rows.length} owned`)
    fitText(this.total.setFontSize(11).setText('TOTAL   ' + bonusLine(fx)), this.boxW - PAD * 2)

    let y = HEADER_H + GAP
    rows.forEach((row, i) => {
      const r = this.rows[i]
      const a = row.owned ? 1 : 0.55
      this.card(y, ROW_H, { stroke: row.equipped ? PAL.gold : PAL.line, weight: row.equipped ? 2 : 1 })

      fitText(r.name.setFontSize(13).setPosition(PAD, y + 10).setText(row.def.name), this.boxW - 130)
      r.name.setAlpha(a)
      this.pips(PAD, y + 36, row.stars)

      r.ownedLine.setPosition(PAD, y + 48).setText('Owned  ' + bonusLine(row.def.owned)).setAlpha(a)
      r.equipLine.setPosition(PAD, y + 64).setText('Equipped  ' + bonusLine(row.def.equip)).setAlpha(a)
      r.equipLine.setColor(row.equipped ? CSS.gold : CSS.muted)
      fitText(r.ownedLine.setFontSize(10), this.boxW - 130)
      fitText(r.equipLine.setFontSize(10), this.boxW - 130)

      r.btn.setPosition(this.boxW - PAD - 50, y + 26)
      r.btn.setText(!row.owned ? 'Not owned' : row.equipped ? 'Equipped' : 'Equip')
      r.btn.setFill(!row.owned ? PAL.line : row.equipped ? PAL.gold : PAL.accent)
      r.btn.setEnabled(row.owned && !row.equipped)
      r.source.setPosition(this.boxW - PAD, y + 52).setVisible(!row.owned)

      y += ROW_H + GAP
    })

    this.boxH = y - GAP
  }
}
