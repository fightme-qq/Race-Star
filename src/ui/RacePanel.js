import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatClock, formatNum } from '../utils/format.js'
import { panel, label } from './widgets.js'
import { TrackView } from './TrackView.js'
import { LapRibbon } from './LapRibbon.js'
import { RACE } from '../config/balance.js'

// Блок гонки — единственный тёмный блок на светлом экране, как в оригинале:
// имя команды красным, счётчик фанатов, бейдж P{n}/10 с таймером, лента
// прогресса кругов, карта трассы.
export class RacePanel extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h) {
    super(scene, 0, 0)
    this.state = state

    panel(scene, x, y, w, h, { fill: PAL.dark, radius: 14 })

    this.teamText = label(scene, x + 16, y + 12, state.teamName, { size: 18, bold: true, color: CSS.red })
    this.fansText = label(scene, x + 16, y + 36, '', { size: 15, bold: true, color: CSS.onDark })
    // Сила команды на главном экране — иначе прокачка драйверов не даёт
    // никакой обратной связи: состав меняется, а на экране ничего не движется.
    // Две стороны разнесены по отдельным меткам не ради красоты: заезд решает
    // ОДНА из них, и подсветить надо ровно ту, что решает этот заезд. Без
    // подсветки деление апгрейдов на атаку и защиту для игрока неотличимо от
    // косметики — чем оно, собственно, и было до Этапа 4.
    this.offText = label(scene, x + 16, y + 58, '', { size: 11, color: CSS.dim })
    this.defText = label(scene, x + 72, y + 58, '', { size: 11, color: CSS.dim })
    this.modeText = label(scene, x + 128, y + 58, '', { size: 10, bold: true, color: CSS.dim })

    // Бейдж позиции и таймера — правый верхний угол, как на кадрах.
    panel(scene, x + w - 148, y + 12, 132, 62, { fill: PAL.darkAlt, radius: 12, stroke: 0x2a3a4d })
    this.posText = label(scene, x + w - 82, y + 18, 'P1/10', { size: 26, bold: true, align: 'center', color: CSS.red })
    this.timeText = label(scene, x + w - 82, y + 50, '00:60', { size: 14, bold: true, align: 'center', color: CSS.onDark })

    const ribbonY = y + 84
    this.ribbon = new LapRibbon(scene, x, ribbonY, w)
    this.track = new TrackView(scene, x + 8, ribbonY + this.ribbon.boxH + 6,
      w - 16, h - (ribbonY - y) - this.ribbon.boxH - 14)

    // [F] Всплывашка прироста фанатов прямо на карте: `👥 443 ⌃ +205`.
    this.fansPop = label(scene, x + w / 2, y + h - 34, '', { size: 15, bold: true, align: 'center', color: CSS.onDark })
    this.fansPop.setAlpha(0)

    this.add([this.teamText, this.fansText, this.offText, this.defText,
      this.modeText, this.posText, this.timeText, this.ribbon, this.track, this.fansPop])
    scene.add.existing(this)
  }

  // Дёргается из RaceRewards через MainScene, когда фанаты реально начислены.
  popFans(total, gain) {
    this.fansPop.setText(`👥 ${formatNum(total)}  ⌃ +${formatNum(gain)}`)
    this.fansPop.setAlpha(1).setY(this.fansPop.y)
    this.scene.tweens.killTweensOf(this.fansPop)
    this.scene.tweens.add({ targets: this.fansPop, alpha: 0, duration: 1600, delay: 700 })
  }

  refresh(sim) {
    const s = this.state
    this.teamText.setText(s.teamName)
    this.fansText.setText('👥 ' + formatNum(s.cls.fans))
    this.offText.setText(`⚔ ${formatNum(s.offense)}`)
    this.defText.setText(`🛡 ${formatNum(s.defense)}`)
    if (!sim) return

    // Какой стороной решается заезд — разыграно на старте, всю гонку не меняется.
    const attacking = sim.player.attacking
    this.modeText.setText(attacking ? 'ATTACK' : 'DEFEND')
    this.modeText.setColor(attacking ? CSS.red : CSS.cyan)
    this.offText.setColor(attacking ? CSS.onDark : CSS.dim)
    this.defText.setColor(attacking ? CSS.dim : CSS.onDark)

    const pos = sim.player.position
    this.posText.setText(`P${pos}/${RACE.racers}`)
    this.posText.setColor(pos === 1 ? CSS.red : pos <= 3 ? CSS.gold : CSS.onDark)
    this.timeText.setText(formatClock(sim.timeLeft))
    this.ribbon.update(sim)
    this.track.update(sim)
  }
}
