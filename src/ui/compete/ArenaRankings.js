import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { formatNum } from '../../utils/format.js'
import { label } from '../widgets.js'
import { fitText } from '../layout.js'

const ROWS = 10
const HIST = 5
const ROW_H = 28
const HEAD_H = 48

// `Rankings` [E] — ранг по медалям ЗА СУТКИ, плюс короткий `History` последних
// матчей. Окно таблицы центрировано на игроке (arenaRankings): в Bronze он почти
// никогда не в топе, и первые десять строк были бы для него пустым списком.
export class ArenaRankings extends Phaser.GameObjects.Container {
  constructor(scene, state, w) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.boxH = 0

    this.bg = scene.add.graphics()
    this.rowsGfx = scene.add.graphics()
    this.title = label(scene, 16, 12, 'Rankings', { size: 14, bold: true })
    this.heads = [
      label(scene, 26, 34, '#', { size: 10, bold: true, color: CSS.muted, align: 'center' }),
      label(scene, 48, 34, 'RACER', { size: 10, bold: true, color: CSS.muted }),
      label(scene, w - 16, 34, 'MEDALS', { size: 10, bold: true, color: CSS.muted, align: 'right' }),
    ]
    this.rows = Array.from({ length: ROWS }, (_, i) => {
      const y = HEAD_H + i * ROW_H + 6
      return {
        rank: label(scene, 26, y, '', { size: 12, bold: true, align: 'center' }),
        name: label(scene, 48, y, '', { size: 12 }),
        medals: label(scene, w - 16, y, '', { size: 12, bold: true, align: 'right' }),
      }
    })

    this.histTitle = label(scene, 16, 0, 'History', { size: 14, bold: true })
    this.histEmpty = label(scene, w / 2, 0, 'No matches yet', { size: 12, color: CSS.muted, align: 'center' })
    this.hist = Array.from({ length: HIST }, () => ({
      name: label(scene, 16, 0, '', { size: 12 }),
      result: label(scene, w - 16, 0, '', { size: 12, bold: true, align: 'right' }),
    }))

    this.add([this.bg, this.rowsGfx, this.title, ...this.heads, this.histTitle, this.histEmpty,
      ...this.rows.flatMap((r) => [r.rank, r.name, r.medals]),
      ...this.hist.flatMap((r) => [r.name, r.result])])
    scene.add.existing(this)
  }

  refresh() {
    const rows = this.state.arenaRankingRows()
    const history = this.state.arena.history || []
    const tableH = HEAD_H + ROW_H * rows.length + 10
    const histRows = Math.min(history.length, HIST)
    const histH = 34 + ROW_H * Math.max(1, histRows) + 10
    this.boxH = tableH + 12 + histH

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, tableH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, tableH, 14)
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, tableH + 12, this.boxW, histH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, tableH + 12, this.boxW, histH, 14)

    this.rowsGfx.clear()
    this.rows.forEach((view, i) => {
      const row = rows[i]
      const on = !!row
      view.rank.setVisible(on); view.name.setVisible(on); view.medals.setVisible(on)
      if (!on) return
      const y = HEAD_H + i * ROW_H
      // Строка игрока подсвечена — иначе её ищут глазами в десяти похожих.
      if (row.me) {
        this.rowsGfx.fillStyle(PAL.accent, 0.12)
        this.rowsGfx.fillRoundedRect(8, y, this.boxW - 16, ROW_H - 2, 8)
      } else if (i % 2 === 1) {
        this.rowsGfx.fillStyle(PAL.panelAlt, 1)
        this.rowsGfx.fillRoundedRect(8, y, this.boxW - 16, ROW_H - 2, 8)
      }
      const color = row.me ? CSS.accent : row.rank <= 3 ? CSS.text : CSS.muted
      view.rank.setText(String(row.rank)).setColor(color)
      view.name.setText(row.name).setColor(color).setFontStyle(row.me ? 'bold' : 'normal')
      // Кегль возвращаем перед подгонкой: fitText только уменьшает, и ужатая под
      // длинное имя строка осталась бы мелкой для короткого.
      fitText(view.name.setFontSize(12), this.boxW - 110)
      view.medals.setText(formatNum(row.medals)).setColor(color)
    })

    const top = tableH + 12
    this.histTitle.setY(top + 12)
    this.histEmpty.setY(top + 42).setVisible(histRows === 0)
    this.hist.forEach((view, i) => {
      const h = history[i]
      const on = i < histRows
      view.name.setVisible(on); view.result.setVisible(on)
      if (!on) return
      const y = top + 34 + i * ROW_H + 6
      fitText(view.name.setPosition(16, y).setText(h.name).setFontSize(12), this.boxW - 130)
      view.result.setPosition(this.boxW - 16, y)
        .setText(`${h.won ? 'WON' : 'LOST'}  +${h.medals} 🏅`)
        .setColor(h.won ? CSS.greenDim : CSS.dim)
    })
  }
}
