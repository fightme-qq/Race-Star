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
    // Сила команды на главном экране — иначе прокачка драйверов не даёт
    // никакой обратной связи: состав меняется, а на экране ничего не движется.
    // Две стороны разнесены по отдельным меткам не ради красоты: заезд решает
    // ОДНА из них, и подсветить надо ровно ту, что решает этот заезд. Без
    // подсветки деление апгрейдов на атаку и защиту для игрока неотличимо от
    // косметики — чем оно, собственно, и было до Этапа 4.
    this.offText = label(scene, x + 92, y + 35, '', { size: 11, color: CSS.muted })
    this.defText = label(scene, x + 148, y + 35, '', { size: 11, color: CSS.muted })
    this.modeText = label(scene, x + 208, y + 35, '', { size: 10, bold: true, color: CSS.muted })
    this.leagueText = label(scene, x + 14, y + 52, '', { size: 10, color: CSS.muted })

    // Бейдж позиции и таймера — правый верхний угол, как на кадрах.
    panel(scene, x + w - 96, y + 10, 86, 58, { fill: PAL.panelAlt, radius: 10, stroke: PAL.line })
    this.posText = label(scene, x + w - 53, y + 15, 'P1/10', { size: 18, bold: true, align: 'center', color: CSS.accent })
    this.timeText = label(scene, x + w - 53, y + 40, '00:60', { size: 16, bold: true, align: 'center' })

    this.track = new TrackView(scene, x + 10, y + 74, w - 20, h - 86)

    this.add([this.teamText, this.fansText, this.leagueText, this.offText,
      this.defText, this.modeText, this.posText, this.timeText, this.track])
    scene.add.existing(this)
  }

  refresh(sim) {
    const s = this.state
    this.teamText.setText(s.teamName)
    this.fansText.setText('👥 ' + formatNum(s.cls.fans))
    this.offText.setText(`⚔ ${formatNum(s.offense)}`)
    this.defText.setText(`🛡 ${formatNum(s.defense)}`)
    const lap = sim ? Math.min(RACE.laps, sim.lapPositionOf(sim.player).lap) : 1
    this.leagueText.setText(
      `${s.league.name}  S${String(s.cls.season).padStart(3, '0')}  ` +
      `SCORE ${s.cls.seasonScore}  LAP ${lap}/${RACE.laps}`
    )
    if (!sim) return

    // Какой стороной решается заезд — разыграно на старте, всю гонку не меняется.
    const attacking = sim.player.attacking
    this.modeText.setText(attacking ? 'ОБГОН' : 'ЗАЩИТА')
    this.modeText.setColor(attacking ? CSS.red : CSS.cyan)
    this.offText.setColor(attacking ? CSS.text : CSS.dim)
    this.defText.setColor(attacking ? CSS.dim : CSS.text)

    const pos = sim.player.position
    this.posText.setText(`P${pos}/${RACE.racers}`)
    this.posText.setColor(pos === 1 ? CSS.accent : pos <= 3 ? CSS.gold : CSS.text)
    this.timeText.setText(formatClock(sim.timeLeft))
    this.track.update(sim)
  }
}
