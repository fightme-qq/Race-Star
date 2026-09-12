import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { ARENA } from '../../config/compete.js'
import { formatNum, formatClock, formatHms } from '../../utils/format.js'
import { label, Bar } from '../widgets.js'
import { fitText } from '../layout.js'

// `HH:MM:SS`. В format.js есть только `formatClock` (MM:SS) — у арены сутки, и
// «1439:59» читается как ошибка. Часы отделяем, минуты и секунды отдаёт тот же
// formatClock: второй копии арифметики времени тут нет.

// Шапка арены. Лига — по НАКОПЛЕННЫМ медалям, ранг — по дневным (в попапе [E]
// это два разных предложения), поэтому строки про них стоят врозь: слитые в одну
// они читались бы как «ранг падает каждое утро».
export class ArenaHeader extends Phaser.GameObjects.Container {
  constructor(scene, state, w) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.boxH = 160

    this.bg = scene.add.graphics()
    this.badge = scene.add.graphics()
    this.leagueName = label(scene, 16, 14, '', { size: 18, bold: true })
    this.medals = label(scene, 16, 40, '', { size: 12, color: CSS.muted })

    this.rank = label(scene, w - 16, 14, '', { size: 16, bold: true, align: 'right' })
    this.tickets = label(scene, w - 16, 38, '', { size: 12, align: 'right' })
    this.refill = label(scene, w - 16, 56, '', { size: 11, color: CSS.muted, align: 'right' })

    this.bar = new Bar(scene, 16, 102, w - 32, 14, PAL.gold, PAL.panelAlt)
    this.progress = label(scene, 16, 124, '', { size: 12 })

    this.add([this.bg, this.badge, this.leagueName, this.medals, this.rank,
      this.tickets, this.refill, this.bar, this.progress])
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    const a = s.arena
    const cur = s.arenaLeagueDef
    const next = s.arenaNextLeagueDef

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    // Полоска цвета ступени: пять лиг арены [E] отличаются только названием, и
    // без цвета продвижение не читается (та же причина, что у бейджа лиг трассы).
    this.badge.clear()
    this.badge.fillStyle(cur.color, 1)
    this.badge.fillRoundedRect(0, 78, this.boxW, 4, 2)

    // Цвет ступени берётся из конфига арены, а не выбирается тут.
    this.leagueName.setText(cur.name).setColor('#' + cur.color.toString(16).padStart(6, '0'))
    fitText(this.leagueName.setFontSize(18), this.boxW - 120)
    this.medals.setText(`Medals today ${formatNum(a.medalsToday)}   ·   Lifetime ${formatNum(a.medals)}`)
    fitText(this.medals.setFontSize(12), this.boxW - 32)

    this.rank.setText(`Rank: ${s.arenaRankNow}`)
    this.tickets.setText(`🎟 ${a.tickets}/${ARENA.ticketsRefill}`)
      .setColor(a.tickets > 0 ? CSS.greenDim : CSS.red)
    this.refill.setText(`Refills in ${formatHms(s.arenaResetSec)}`)

    const from = cur.medals
    const to = next ? next.medals : cur.medals
    this.bar.setValue(next ? (a.medals - from) / Math.max(1, to - from) : 1)
    this.progress.setText(next
      ? `${formatNum(a.medals)} / ${formatNum(to)} medals to ${next.name}`
      : `${formatNum(a.medals)} medals · top arena league reached`)
    fitText(this.progress.setFontSize(12), this.boxW - 32)
  }
}
