import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label } from '../widgets.js'

const ROW_H = 30
const HEAD_H = 52

// `Current Season Standings` [E]. Десять строк: игрок и девять соперников,
// которые реально ехали заезды этого сезона (индекс строки = индекс в
// OPPONENT_SPREAD). Колонки W и PTS — из `W/L` локализации билда.
export class StandingsTable extends Phaser.GameObjects.Container {
  constructor(scene, state, classId, w) {
    super(scene, 0, 0)
    this.state = state
    this.classId = classId
    this.boxW = w
    this.boxH = HEAD_H + ROW_H * 10 + 12

    this.bg = scene.add.graphics()
    this.rowsGfx = scene.add.graphics()
    this.title = label(scene, 16, 14, 'Current Season Standings', { size: 14, bold: true })
    this.heads = [
      label(scene, 26, 38, '#', { size: 10, bold: true, color: CSS.muted, align: 'center' }),
      label(scene, 48, 38, 'TEAM', { size: 10, bold: true, color: CSS.muted }),
      label(scene, w - 74, 38, 'W', { size: 10, bold: true, color: CSS.muted, align: 'center' }),
      label(scene, w - 32, 38, 'PTS', { size: 10, bold: true, color: CSS.muted, align: 'center' }),
    ]

    this.rows = Array.from({ length: 10 }, (_, i) => {
      const y = HEAD_H + i * ROW_H + 8
      return {
        rank: label(scene, 26, y, '', { size: 12, bold: true, align: 'center' }),
        name: label(scene, 48, y, '', { size: 13 }),
        wins: label(scene, w - 74, y, '', { size: 12, align: 'center' }),
        pts: label(scene, w - 32, y, '', { size: 12, bold: true, align: 'center' }),
      }
    })

    this.add([this.bg, this.rowsGfx, this.title, ...this.heads,
      ...this.rows.flatMap((r) => [r.rank, r.name, r.wins, r.pts])])
    scene.add.existing(this)
  }

  refresh() {
    const rows = this.state.standingsOf(this.classId)

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    this.rowsGfx.clear()
    rows.forEach((row, i) => {
      const view = this.rows[i]
      const y = HEAD_H + i * ROW_H
      // Строка игрока подсвечена — иначе в десяти похожих строках её ищут
      // глазами каждый раз заново.
      if (row.isPlayer) {
        this.rowsGfx.fillStyle(PAL.accent, 0.12)
        this.rowsGfx.fillRoundedRect(8, y, this.boxW - 16, ROW_H - 2, 8)
      } else if (i % 2 === 1) {
        this.rowsGfx.fillStyle(PAL.panelAlt, 1)
        this.rowsGfx.fillRoundedRect(8, y, this.boxW - 16, ROW_H - 2, 8)
      }
      // Зона повышения — первые три места, как и подиум в заезде.
      const color = row.isPlayer ? CSS.accent : row.rank <= 3 ? CSS.text : CSS.muted
      view.rank.setText(String(row.rank)).setColor(color)
      view.name.setText(row.name).setColor(color)
        .setFontStyle(row.isPlayer ? 'bold' : 'normal')
      view.wins.setText(String(row.wins)).setColor(color)
      view.pts.setText(String(row.pts)).setColor(color)
    })
  }
}
