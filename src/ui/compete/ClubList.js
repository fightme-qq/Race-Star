import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CLUB } from '../../config/compete.js'
import { formatNum } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'

const HEAD_H = 38
const ROW_H = 66
const BTN_W = 96

// `Club List` [E]. Единственное, что ограничивает вступление в оригинале — порог
// силы (`Your Power Level is too low to join this club`), поэтому он стоит в
// строке, а не в тосте после отказа.
export class ClubList extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    const rows = state.clubRows
    this.boxH = HEAD_H + ROW_H * rows.length + 62

    this.bg = scene.add.graphics()
    this.title = label(scene, 14, 12, 'Club List', { size: 14, bold: true })
    this.power = label(scene, w - 14, 14, '', { size: 11, color: CSS.muted, align: 'right' })

    this.rows = rows.map((row, i) => {
      const top = HEAD_H + i * ROW_H
      const btn = new Button(scene, w - BTN_W / 2 - 12, top + ROW_H / 2 - 4, BTN_W, 34, 'Join', { size: 12 })
      btn.on('press', () => this.join(row.index))
      return {
        name: label(scene, 14, top + 10, row.name, { size: 14, bold: true }),
        members: label(scene, 14, top + 31, '', { size: 11, color: CSS.muted }),
        gate: label(scene, 14, top + 46, '', { size: 11, color: CSS.muted }),
        btn,
      }
    })

    this.create = new Button(scene, w / 2, this.boxH - 32, w - 28, 40, 'Create Club',
      { size: 13, chip: true })
    this.create.on('press', () => this.createOwn())

    this.add([this.bg, this.title, this.power, this.create,
      ...this.rows.flatMap((r) => [r.name, r.members, r.gate, r.btn])])
    scene.add.existing(this)
  }

  join(index) {
    if (!this.state.joinClub(index)) {
      this.toast?.('Your Power Level is too low to join this club', PAL.muted)
      return
    }
    this.toast?.('Joined ' + this.state.club.name, PAL.green)
    this.onChange?.()
  }

  createOwn() {
    if (this.state.gems < CLUB.createGems) {
      this.toast?.(`Need ${CLUB.createGems} 💎 to create a Club`, PAL.muted)
      return
    }
    const name = window.prompt('Club name', 'My Club')
    if (!name) return
    if (!this.state.createClub(name)) { this.toast?.('Could not create the Club', PAL.red); return }
    this.toast?.('Club created · ' + this.state.club.name, PAL.green)
    this.onChange?.()
  }

  refresh() {
    const rows = this.state.clubRows
    this.power.setText(`Your Power Level ${formatNum(this.state.teamPower)}`)

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)

    this.rows.forEach((view, i) => {
      const row = rows[i]
      const top = HEAD_H + i * ROW_H
      this.bg.fillStyle(PAL.panelAlt, 1)
      this.bg.fillRoundedRect(8, top, this.boxW - 16, ROW_H - 8, 10)
      if (!row) return
      const full = row.members >= CLUB.members
      // Недоступный клуб гасится целиком, а не только кнопкой: иначе строка
      // выглядит рабочей, и отказ читается как баг.
      const open = row.canJoin && !full
      fitText(view.name.setText(row.name).setFontSize(14).setColor(open ? CSS.text : CSS.dim),
        this.boxW - BTN_W - 40)
      view.members.setText(`Members ${row.members}/${CLUB.members}`)
        .setColor(full ? CSS.red : CSS.muted)
      view.gate.setText(`Power Level ${formatNum(row.gate)}`)
        .setColor(row.canJoin ? CSS.muted : CSS.red)
      view.btn.setText(full ? 'Club is full' : 'Join')
      fitText(view.btn.txt.setFontSize(12), BTN_W - 12)
      view.btn.setEnabled(open)
    })

    this.create.setChip(`${CLUB.createGems} 💎`)
    this.create.setEnabled(this.state.gems >= CLUB.createGems)
  }
}
