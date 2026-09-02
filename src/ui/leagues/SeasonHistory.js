import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { LEAGUES } from '../../config/balance.js'
import { HISTORY_LIMIT } from '../../systems/SeasonSystem.js'
import { label } from '../widgets.js'

const ROW_H = 30
const HEAD_H = 40

// `Season History` [E]. Строк ровно HISTORY_LIMIT — блок не меняет высоту по
// ходу игры, иначе список под ним прыгал бы после каждого закрытого сезона.
export class SeasonHistory extends Phaser.GameObjects.Container {
  constructor(scene, state, classId, w) {
    super(scene, 0, 0)
    this.state = state
    this.classId = classId
    this.boxW = w
    // Высота по числу отъезженных сезонов, а не по HISTORY_LIMIT: на старте
    // истории нет вовсе, и блок в 8 строк выглядел бы как сломанная вёрстка —
    // ровно та же причина, по которой ужат закрытый класс в ClassCard.
    this.boxH = HEAD_H + ROW_H + 12

    this.bg = scene.add.graphics()
    this.title = label(scene, 16, 14, 'Season History', { size: 14, bold: true })
    this.empty = label(scene, w / 2, HEAD_H + 8, 'No seasons finished yet',
      { size: 12, color: CSS.muted, align: 'center' })

    this.rows = Array.from({ length: HISTORY_LIMIT }, (_, i) => {
      const y = HEAD_H + i * ROW_H + 8
      return {
        season: label(scene, 16, y, '', { size: 12, bold: true }),
        league: label(scene, 80, y, '', { size: 12, color: CSS.muted }),
        rank: label(scene, w - 108, y, '', { size: 12, align: 'right' }),
        result: label(scene, w - 16, y, '', { size: 12, align: 'right', bold: true }),
      }
    })

    this.add([this.bg, this.title, this.empty,
      ...this.rows.flatMap((r) => [r.season, r.league, r.rank, r.result])])
    scene.add.existing(this)
  }

  refresh() {
    const hist = this.state.classes[this.classId].history || []
    this.boxH = HEAD_H + ROW_H * Math.max(1, Math.min(hist.length, HISTORY_LIMIT)) + 12

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.empty.setVisible(hist.length === 0)

    this.rows.forEach((row, i) => {
      const h = hist[i]
      const on = !!h
      row.season.setVisible(on); row.league.setVisible(on)
      row.rank.setVisible(on); row.result.setVisible(on)
      if (!on) return
      row.season.setText('S' + String(h.season).padStart(3, '0'))
      row.league.setText((LEAGUES[h.league] || LEAGUES[0]).name.replace(' LEAGUE', ''))
      row.rank.setText(`P${h.rank} · ${h.score} pts`).setColor(CSS.muted)
      row.result.setText(h.promoted ? 'PROMOTED' : 'STAYED')
        .setColor(h.promoted ? CSS.greenDim : CSS.dim)
    })
  }
}
