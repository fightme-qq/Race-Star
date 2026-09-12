import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { ARENA } from '../../config/compete.js'
import { formatNum, formatPercent } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'

const HEAD_H = 34
const ROW_H = 76
const BTN_W = 124

// `Select an opponent` [E]: трое соперников, у каждого показан Win Chance — его
// считает тот же duelProb, что решает бой (правило 16), поэтому выбор честный.
export class ArenaBoard extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange
    this.boxH = HEAD_H + ROW_H * ARENA.opponents + 54

    this.bg = scene.add.graphics()
    this.title = label(scene, 16, 12, 'Select an opponent', { size: 14, bold: true })

    this.rows = Array.from({ length: ARENA.opponents }, (_, i) => {
      const top = HEAD_H + i * ROW_H
      const btn = new Button(scene, w - BTN_W / 2 - 12, top + ROW_H / 2 - 4, BTN_W, 36, 'Challenge', { size: 12 })
      btn.on('press', () => this.play(i))
      return {
        name: label(scene, 16, top + 10, '', { size: 14, bold: true }),
        power: label(scene, 16, top + 31, '', { size: 11, color: CSS.muted }),
        stats: label(scene, 16, top + 47, '', { size: 11, color: CSS.muted }),
        btn,
      }
    })

    this.refreshBtn = new Button(scene, w / 2, this.boxH - 32, w - 32, 36, '', { size: 13, fill: PAL.panelAlt })
    this.refreshBtn.on('press', () => this.reroll())

    this.add([this.bg, this.title, this.refreshBtn,
      ...this.rows.flatMap((r) => [r.name, r.power, r.stats, r.btn])])
    scene.add.existing(this)
  }

  play(index) {
    const res = this.state.playArena(index)
    if (!res) { this.toast?.('No Arena Tickets', PAL.muted); return }
    const head = res.won ? `Win!  +${res.medals} 🏅` : `Loss  +${res.medals} 🏅`
    this.toast?.(`${head}  vs ${res.opponent.name}`, res.won ? PAL.green : PAL.muted)
    if (res.promoted) this.toast?.('Promoted! ' + this.state.arenaLeagueDef.name, PAL.gold)
    this.onChange?.()
  }

  reroll() {
    if (!this.state.refreshArena()) { this.toast?.('No refreshes left today', PAL.muted); return }
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const a = s.arena
    const opps = s.arenaOpponents
    const canPlay = a.tickets >= ARENA.ticketCost

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    this.rows.forEach((row, i) => {
      const opp = opps[i]
      const top = HEAD_H + i * ROW_H
      this.bg.fillStyle(PAL.panelAlt, 1)
      this.bg.fillRoundedRect(8, top, this.boxW - 16, ROW_H - 8, 10)
      if (!opp) return
      const chance = s.arenaChance(opp) * 100
      // Кегль сбрасывается перед подгонкой: fitText только уменьшает, и ужатая
      // под длинное имя строка осталась бы мелкой для короткого.
      fitText(row.name.setText(opp.name).setFontSize(14), this.boxW - BTN_W - 40)
      fitText(row.power.setText(`Team Power ${formatNum(opp.power)}`).setFontSize(11),
        this.boxW - BTN_W - 40)
      // Статы соперника [E] `Opponent Stats` — половина на половину, как у
      // соперников трассы, и шанс тем же цветовым кодом, что подиум.
      row.stats.setText(`⚔ ${formatNum(opp.off)}   🛡 ${formatNum(opp.def)}   ·   `
        + `Win Chance: ${formatPercent(chance)}`)
        .setColor(chance >= 50 ? CSS.greenDim : CSS.muted)
      fitText(row.stats.setFontSize(11), this.boxW - BTN_W - 36)
      // Подпись кнопки объясняет отказ: серая `Challenge` читается как «ещё не
      // загрузилось», а не как «кончились тикеты».
      row.btn.setText(canPlay ? 'Challenge' : 'No Arena Tickets')
      fitText(row.btn.txt.setFontSize(canPlay ? 12 : 11), BTN_W - 12)
      row.btn.setEnabled(canPlay)
    })

    const left = ARENA.refreshes - a.refreshes
    this.refreshBtn.setText(`Refresh ${a.refreshes}/${ARENA.refreshes}`)
    this.refreshBtn.setEnabled(left > 0)
  }
}
