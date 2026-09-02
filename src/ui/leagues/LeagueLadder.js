import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { LEAGUES, ECONOMY } from '../../config/balance.js'
import { formatNum } from '../../utils/format.js'
import { label } from '../widgets.js'

const ROW_H = 34
const HEAD_H = 40

// Лестница лиг целиком. Смысл блока — показать, ЗА ЧТО игрок качает бой:
// каждая ступень умножает призовые на leaguePrizeMult, и до шага 3 это число
// не было видно нигде, хотя оно и есть главный двигатель экономики.
export class LeagueLadder extends Phaser.GameObjects.Container {
  constructor(scene, state, classId, w) {
    super(scene, 0, 0)
    this.state = state
    this.classId = classId
    this.boxW = w
    this.boxH = HEAD_H + ROW_H * LEAGUES.length + 12

    this.bg = scene.add.graphics()
    this.rowsGfx = scene.add.graphics()
    this.title = label(scene, 16, 14, 'League Ladder', { size: 14, bold: true })

    this.rows = LEAGUES.map((lg, i) => {
      const y = HEAD_H + i * ROW_H + 9
      return {
        mark: label(scene, 26, y, '', { size: 13, bold: true, align: 'center' }),
        name: label(scene, 46, y, lg.name, { size: 13 }),
        power: label(scene, w - 96, y, formatNum(lg.power), { size: 12, align: 'right', color: CSS.muted }),
        prize: label(scene, w - 16, y, '×' + Math.pow(ECONOMY.leaguePrizeMult, i).toFixed(2),
          { size: 12, align: 'right', color: CSS.greenDim }),
      }
    })

    this.add([this.bg, this.rowsGfx, this.title,
      ...this.rows.flatMap((r) => [r.mark, r.name, r.power, r.prize])])
    scene.add.existing(this)
  }

  refresh() {
    const cur = this.state.classes[this.classId].league

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    this.rowsGfx.clear()
    this.rows.forEach((row, i) => {
      const y = HEAD_H + i * ROW_H
      if (i === cur) {
        this.rowsGfx.fillStyle(PAL.accent, 0.12)
        this.rowsGfx.fillRoundedRect(8, y, this.boxW - 16, ROW_H - 2, 8)
      }
      const done = i < cur
      const color = i === cur ? CSS.accent : done ? CSS.muted : CSS.text
      row.mark.setText(done ? '✓' : i === cur ? '▶' : '').setColor(done ? CSS.greenDim : CSS.accent)
      row.name.setColor(color).setFontStyle(i === cur ? 'bold' : 'normal')
      row.power.setColor(CSS.muted)
      // Ступени выше текущей приглушены: это ещё не награда, а цель.
      row.prize.setColor(i <= cur ? CSS.greenDim : CSS.dim)
    })
  }
}
