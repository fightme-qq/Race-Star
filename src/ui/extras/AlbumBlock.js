import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { CardChip, CHIP_H } from './CardChip.js'

const PAD = 14
const GAP = 6
const COLS = 3
const TOP = 44

export const BLOCK_H = TOP + 3 * CHIP_H + 2 * GAP + 12

// Один альбом сезона: имя, `have/total`, сетка 3x3 из карт и награда за
// завершение. Отдельный контейнер, а не ряд в общем виде: карт 36 на сезон, и
// раскладка «сетка внутри списка» иначе расползается по двум файлам.
export class AlbumBlock extends Phaser.GameObjects.Container {
  constructor(scene, y, w, { onClaim, onWild }) {
    super(scene, 0, y)
    this.boxW = w
    this.boxH = BLOCK_H
    this.onClaim = onClaim

    this.bg = scene.add.graphics()
    this.nameText = label(scene, PAD, 10, '', { size: 14, bold: true })
    this.countText = label(scene, w - PAD, 12, '', { size: 11, color: CSS.muted, align: 'right' })
    this.claimBtn = new Button(scene, w - PAD - 48, 24, 96, 26, 'Claim', { size: 11, fill: PAL.gold })
    this.claimBtn.on('press', () => this.onClaim?.(this.albumIndex))
    this.add([this.bg, this.nameText, this.countText, this.claimBtn])

    const chipW = (w - PAD * 2 - GAP * (COLS - 1)) / COLS
    this.chips = Array.from({ length: 9 }, (_, i) => {
      const cx = PAD + (chipW + GAP) * (i % COLS)
      const cy = TOP + (CHIP_H + GAP) * Math.floor(i / COLS)
      const chip = new CardChip(scene, cx, cy, chipW, {
        onTap: (card) => onWild?.(this.albumIndex, card),
      })
      this.add(chip)
      return chip
    })
    scene.add.existing(this)
  }

  // `album` — строка из state.albums, `wild` — сколько Wild Cards на руках.
  refresh(album, wild) {
    this.albumIndex = album.index
    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, BLOCK_H, 14)
    this.bg.lineStyle(album.complete ? 2 : 1, album.complete ? PAL.green : PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, BLOCK_H, 14)

    fitText(this.nameText.setFontSize(14).setText(album.name), this.boxW - 130)
    this.countText.setText(`${album.have} / ${album.total}${album.claimed ? '  ✓' : ''}`)
    this.countText.setColor(album.complete ? CSS.green : CSS.muted)

    // Кнопка есть только у собранного альбома: пустая серая «Claim» под каждым
    // альбомом читалась бы как «награда сломана», а не «собери карты».
    const show = album.complete && !album.claimed
    this.claimBtn.setVisible(show)
    this.claimBtn.setEnabled(show)
    this.countText.setPosition(show ? this.boxW - PAD - 104 : this.boxW - PAD, 12)

    for (let i = 0; i < this.chips.length; i++) this.chips[i].refresh(album.cards[i], wild > 0)
    return this
  }
}
