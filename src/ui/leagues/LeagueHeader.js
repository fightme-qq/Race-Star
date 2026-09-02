import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { ECONOMY } from '../../config/balance.js'
import { formatNum } from '../../utils/format.js'
import { label, Button, Bar } from '../widgets.js'

// Шапка вкладки лиг: где игрок стоит, что даёт следующая ступень и сколько до
// неё осталось. Ради этого блока шаг и делался — лестница лиг умножает
// призовые в 1.45 раза за ступень, а игрок до сих пор видел только её название.
export class LeagueHeader extends Phaser.GameObjects.Container {
  constructor(scene, state, classId, w, { onAdvance }) {
    super(scene, 0, 0)
    this.state = state
    this.classId = classId
    this.boxW = w
    this.boxH = 158

    this.bg = scene.add.graphics()
    this.badge = scene.add.graphics()
    this.badgeText = label(scene, 40, 27, '', { size: 17, bold: true, align: 'center', color: CSS.onDark })
    this.nameText = label(scene, 74, 14, '', { size: 18, bold: true })
    this.sub = label(scene, 74, 40, '', { size: 12, color: CSS.muted })

    this.seasonCap = label(scene, 16, 76, '', { size: 11, bold: true, color: CSS.muted })
    this.rankCap = label(scene, w - 16, 76, '', { size: 11, bold: true, color: CSS.muted, align: 'right' })

    this.bar = new Bar(scene, 16, 100, w - 136, 14, PAL.green, PAL.panelAlt)
    this.progress = label(scene, 16, 122, '', { size: 12, color: CSS.text })

    this.advance = new Button(scene, w - 68, 110, 108, 40, 'Advance', { size: 14 })
    this.advance.on('press', () => onAdvance())

    this.add([this.bg, this.badge, this.badgeText, this.nameText, this.sub,
      this.seasonCap, this.rankCap, this.bar, this.progress, this.advance])
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    const id = this.classId
    const cls = s.classes[id]
    const league = s.leagueOf(id)
    const next = s.nextLeagueOf(id)
    const target = s.seasonTarget
    const can = s.canAdvance(id)

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    // Кружок-бейдж заливается цветом ступени: ранние лиги синие, поздние
    // золотые — чтобы продвижение читалось без чтения названия.
    const hot = Math.min(1, cls.league / 8)
    this.badge.clear()
    this.badge.fillStyle(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(PAL.accent),
      Phaser.Display.Color.IntegerToColor(PAL.gold), 100, Math.round(hot * 100)
    ).color, 1)
    this.badge.fillCircle(40, 38, 24)
    this.badgeText.setText(String(cls.league + 1))

    this.nameText.setText(league.name)
    const prize = Math.pow(ECONOMY.leaguePrizeMult, cls.league)
    this.sub.setText(`Rivals ${formatNum(league.power)} power   ·   Prize ×${prize.toFixed(2)}`)

    this.seasonCap.setText(`SEASON ${String(cls.season).padStart(3, '0')}`
      + `   ·   RACE ${cls.seasonRaces + 1} / ${s.seasonLength}`)
    this.rankCap.setText(`RANK ${s.rankOf(id)} / 10`)

    this.bar.setValue(cls.seasonScore / target)
    this.progress.setText(next
      ? `${cls.seasonScore} / ${target} pts to ${next.name}`
      : `${cls.seasonScore} pts · top league reached`)

    // Подпись всегда одна и та же: серая «Advance» читается как «пока рано»,
    // а подменённая на «Locked» — как другая кнопка, которой тут нет.
    this.advance.setEnabled(can)
  }
}
