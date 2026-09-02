import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { PACKS, RARITY_BY_ID } from '../../config/drivers.js'
import { ratingOf, nameOf } from '../../systems/DriverSystem.js'
import { panel, label, Button } from '../widgets.js'

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Гача. Цены (10/100 и 30/300 гемов) и pity (15 и 13 роллов) — с текста
// баннеров оригинала. Счётчик pity показываем открыто: в оригинале он тоже
// подписан строкой «Guaranteed ... in N draws».
export class PacksView extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h, { onChange, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.toast = toast
    this.onChange = onChange

    this.rows = PACKS.map((pack, i) => {
      const py = y + i * 128
      const bg = panel(scene, x, py, w, 116, { fill: PAL.panelAlt, radius: 12, stroke: pack.color })
      const title = label(scene, x + 14, py + 12, pack.name, { size: 15, bold: true })
      const odds = label(scene, x + 14, py + 34, this.oddsText(pack), { size: 10, color: CSS.muted })
      const pity = label(scene, x + 14, py + 52, '', { size: 10, color: CSS.gold })
      const b1 = new Button(scene, x + w / 2 - 90, py + 88, 168, 36, `x1  ·  ${pack.gems1} 💎`,
        { size: 13, fill: pack.color })
      const b10 = new Button(scene, x + w / 2 + 90, py + 88, 168, 36, `x10  ·  ${pack.gems10} 💎`,
        { size: 13, fill: PAL.accent })
      b1.on('press', () => this.draw(pack.id, 1))
      b10.on('press', () => this.draw(pack.id, 10))
      this.add([bg, title, odds, pity, b1, b10])
      return { pack, pity, b1, b10 }
    })

    this.resultTitle = label(scene, x, y + 268, 'ПОСЛЕДНЕЕ ОТКРЫТИЕ', { size: 11, bold: true, color: CSS.muted })
    this.result = label(scene, x, y + 288, 'Пока пусто', { size: 12, color: CSS.dim })
    this.result.setWordWrapWidth(w)
    this.add([this.resultTitle, this.result])

    this.refresh()
    scene.add.existing(this)
  }

  oddsText(pack) {
    return Object.entries(pack.odds)
      .map(([id, p]) => `${RARITY_BY_ID[id].name} ${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%`)
      .join(' · ')
  }

  draw(packId, count) {
    const got = this.state.drawPack(packId, count)
    if (!got) { this.toast('Не хватает гемов', PAL.red); return }
    // Сортируем по редкости — лучшее первым, как в оригинальной раскладке.
    const best = [...got].sort((a, b) => ratingOf(b) - ratingOf(a))[0]
    this.result.setText(got.map((d) => `${RARITY_BY_ID[d.rarity].name} ${nameOf(d)} (${ratingOf(d)})`).join('\n'))
    this.result.setColor(hex(RARITY_BY_ID[best.rarity].color))
    this.toast(`${RARITY_BY_ID[best.rarity].name} ${nameOf(best)} · ${ratingOf(best)}`,
      RARITY_BY_ID[best.rarity].color)
    this.refresh()
    this.onChange?.()
  }

  refresh() {
    for (const row of this.rows) {
      const { pack } = row
      row.pity.setText(`Гарантия ${RARITY_BY_ID[pack.pityRarity].name} через ` +
        `${this.state.roster.pityLeft(pack.id)} роллов`)
      row.b1.setEnabled(this.state.canDraw(pack.id, 1))
      row.b10.setEnabled(this.state.canDraw(pack.id, 10))
    }
  }
}
