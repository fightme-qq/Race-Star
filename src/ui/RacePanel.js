import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatClock, formatNum } from '../utils/format.js'
import { panel, label } from './widgets.js'
import { TrackView } from './TrackView.js'
import { RACE } from '../config/balance.js'

// Блок гонки: имя команды, счётчик фанатов, бейдж P{n}/10 + таймер, карта трассы.
export class RacePanel extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h) {
    super(scene, 0, 0)
    this.state = state

    panel(scene, x, y, w, h, { fill: PAL.panel, radius: 14, stroke: PAL.line })

    this.teamText = label(scene, x + 14, y + 12, state.teamName, { size: 17, bold: true, color: CSS.red })
    this.fansText = label(scene, x + 14, y + 34, '', { size: 13, color: CSS.text })
    this.lapText = label(scene, x + 120, y + 35, '', { size: 11, color: CSS.muted })
    this.leagueText = label(scene, x + 14, y + 52, '', { size: 10, color: CSS.muted })

    // Бейдж позиции и таймера — правый верхний угол, как на кадрах.
    panel(scene, x + w - 96, y + 10, 86, 58, { fill: PAL.panelAlt, radius: 10, stroke: PAL.line })
    this.posText = label(scene, x + w - 53, y + 15, 'P1/10', { size: 18, bold: true, align: 'center', color: CSS.accent })
    this.timeText = label(scene, x + w - 53, y + 40, '00:60', { size: 16, bold: true, align: 'center' })

    this.track = new TrackView(scene, x + 10, y + 74, w - 20, h - 86)

    this.add([this.teamText, this.fansText, this.lapText, this.leagueText,
      this.posText, this.timeText, this.track])
    scene.add.existing(this)
  }

  refresh(sim) {
    const s = this.state
    this.teamText.setText(s.teamName)
    this.fansText.setText('👥 ' + formatNum(s.cls.fans))
    this.leagueText.setText(
      `${s.league.name}   SEASON ${String(s.cls.season).padStart(3, '0')}   SCORE ${s.cls.seasonScore}`
    )
    if (!sim) return
    const pos = sim.player.position
    this.posText.setText(`P${pos}/${RACE.racers}`)
    this.posText.setColor(pos === 1 ? CSS.accent : pos <= 3 ? CSS.gold : CSS.text)
    this.timeText.setText(formatClock(sim.timeLeft))
    const lap = Math.min(RACE.laps, sim.lapPositionOf(sim.player).lap)
    this.lapText.setText(`LAP ${lap}/${RACE.laps}`)
    this.track.update(sim)
  }
}
