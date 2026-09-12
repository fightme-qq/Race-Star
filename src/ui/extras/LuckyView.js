import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { sectionCard } from '../shop/ShopRow.js'
import { PRIZE_ICON, prizeAmount, prizeName, prizeText, prizeColor } from './prize.js'

const HEADER_H = 104
const COLS = 4
const CELL_H = 72
const PAD = 10
const GAP = 8

// Lucky Draw [E]: `Play Lucky Draw to win amazing rewards`, `All rewards have
// been claimed`. Сетка ВЫЧЕРПЫВАЕТСЯ — один приз дважды не выпадает, поэтому
// взятая ячейка остаётся на виду с галочкой, а не исчезает: иначе не видно, что
// осталось, а именно это и есть вся механика (последние призы дорожают по
// ожиданию сами собой).
export class LuckyView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange
    this.lastIndex = -1

    this.bg = scene.add.graphics()
    this.title = label(scene, 14, 12, 'Lucky Draw', { size: 16, bold: true })
    this.left = label(scene, w - 14, 15, '', { size: 12, bold: true, color: CSS.accent, align: 'right' })
    this.note = label(scene, 14, 36, '', { size: 11, color: CSS.muted })
    this.drawBtn = new Button(scene, w / 2, 76, w - 32, 36, '', { size: 14, fill: PAL.gold })
    this.drawBtn.on('press', () => this.draw())
    this.add([this.bg, this.title, this.left, this.note, this.drawBtn])

    const cw = (w - PAD * 2 - GAP * (COLS - 1)) / COLS
    this.cells = state.luckyRowsNow.map((row, i) => {
      const cx = PAD + (cw + GAP) * (i % COLS) + cw / 2
      const cell = {
        index: i,
        cx,
        cw,
        row: Math.floor(i / COLS),
        icon: label(scene, cx, 0, PRIZE_ICON[row.prize.kind] ?? '🎁', { size: 20, align: 'center' }),
        amount: label(scene, cx, 0, '', { size: 11, bold: true, align: 'center' }),
        name: label(scene, cx, 0, '', { size: 9, color: CSS.muted, align: 'center' }),
      }
      this.add([cell.icon, cell.amount, cell.name])
      return cell
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  draw() {
    if (this.state.luckyLeftNow <= 0) {
      this.toast?.('All rewards have been claimed', PAL.muted)
      return
    }
    const res = this.state.playLucky()
    if (!res) { this.toast?.('Not enough Gems', PAL.red); return }
    this.lastIndex = res.index
    const text = res.text || `${prizeText(this.state, res.prize)} ${prizeName(res.prize)}`
    this.toast?.('Lucky Draw  ' + text, prizeColor(res.prize))
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const rows = s.luckyRowsNow
    const left = s.luckyLeftNow
    const empty = left <= 0

    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, HEADER_H)
    this.left.setText(`${left} rewards left`)
    fitText(this.note.setFontSize(11).setText(empty
      ? 'All rewards have been claimed'
      : `Every reward can be won only once  ·  ${rows.length} in the grid`), this.boxW - 28)
    this.drawBtn.setText(empty ? 'All rewards have been claimed' : `Draw  ·  ${s.luckyPrice} 💎`)
    fitText(this.drawBtn.txt.setFontSize(14), this.boxW - 48)
    this.drawBtn.setEnabled(!empty && s.gems >= s.luckyPrice)

    const gridTop = HEADER_H + 12
    const gridRows = Math.ceil(rows.length / COLS)
    const gridH = gridRows * CELL_H + (gridRows - 1) * GAP + PAD * 2
    sectionCard(this.bg, gridTop, this.boxW, gridH)

    rows.forEach((row, i) => {
      const cell = this.cells[i]
      const top = gridTop + PAD + cell.row * (CELL_H + GAP)
      const x = cell.cx - cell.cw / 2
      const color = prizeColor(row.prize)
      this.bg.fillStyle(row.taken ? PAL.panelAlt : color, row.taken ? 1 : 0.14)
      this.bg.fillRoundedRect(x, top, cell.cw, CELL_H, 10)
      // Последний выигрыш обведён: в сетке из тринадцати ячеек иначе не понять,
      // какая именно только что закрылась.
      this.bg.lineStyle(i === this.lastIndex ? 2 : 1, i === this.lastIndex ? PAL.accent : PAL.line, 1)
      this.bg.strokeRoundedRect(x, top, cell.cw, CELL_H, 10)

      cell.icon.setPosition(cell.cx, top + 8).setAlpha(row.taken ? 0.35 : 1)
      cell.amount.setPosition(cell.cx, top + 36)
      cell.amount.setText(row.taken ? '✓' : prizeAmount(this.state, row.prize))
      cell.amount.setColor(row.taken ? CSS.muted : CSS.text)
      fitText(cell.amount.setFontSize(11), cell.cw - 6)
      cell.name.setPosition(cell.cx, top + 52).setText(prizeName(row.prize))
      cell.name.setColor(row.taken ? CSS.dim : CSS.muted)
      fitText(cell.name.setFontSize(9), cell.cw - 4)
    })

    this.boxH = gridTop + gridH
  }
}
