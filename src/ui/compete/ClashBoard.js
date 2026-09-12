import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CLUB } from '../../config/compete.js'
import { REWARD_ICON } from '../../config/rewards.js'
import { positionProtected } from '../../systems/ClubSystem.js'
import { formatNum } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { formatHms } from '../../utils/format.js'

const ROW_H = 44
const BTN_W = 104

// Награды клуба — купоны и осколки, а у них иконок в REWARD_ICON нет: шаг 8
// платит в валюты, которых не знает слой наград. Подписываем словом, а не пустым
// местом после числа.
const rewardLabel = (r) => {
  if (REWARD_ICON[r.kind]) return `${formatNum(r.amount)} ${REWARD_ICON[r.kind]}`
  if (r.coupon) return `${r.amount}× ${r.coupon} coupon`
  if (r.shard) return `${r.amount}× ${r.shard} shards`
  return `${formatNum(r.amount)} ${r.kind}`
}

// Club Clash [E]: доска из CLUB.positions позиций, верхние дороже. Пустая
// позиция берётся без боя, занятая — серией best-of-3 и только когда истекла
// защита; захват освобождает прежнюю позицию игрока сразу.
export class ClashBoard extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.boxH = 0
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, 14, 12, '', { size: 16, bold: true })
    this.challenges = label(scene, w - 14, 15, '', { size: 12, bold: true, align: 'right' })
    this.score = label(scene, 14, 40, '', { size: 14, bold: true })
    this.predicted = label(scene, 14, 60, '', { size: 11, color: CSS.muted })
    this.ends = label(scene, w - 14, 42, '', { size: 11, color: CSS.muted, align: 'right' })
    this.start = new Button(scene, w / 2, 0, w - 28, 40, 'Start Club Clash', { size: 13, fill: PAL.green })
    this.start.on('press', () => this.startClash())
    this.leave = new Button(scene, w / 2, 0, w - 28, 36, 'Leave Club',
      { size: 12, fill: PAL.panelAlt, color: CSS.red })
    this.leave.on('press', () => this.leaveClub())

    this.rows = Array.from({ length: CLUB.positions }, (_, i) => {
      const btn = new Button(scene, w - BTN_W / 2 - 12, 0, BTN_W, 32, '', { size: 11 })
      btn.on('press', () => this.capture(i))
      return {
        pos: label(scene, 14, 0, `#${i + 1}`, { size: 12, bold: true }),
        pts: label(scene, 46, 0, `${CLUB.pointsPerMin[i] ?? 1} pts/min`, { size: 11, color: CSS.muted }),
        owner: label(scene, 132, 0, '', { size: 12, bold: true }),
        guard: label(scene, 132, 0, '', { size: 10, color: CSS.muted }),
        btn,
      }
    })

    this.add([this.bg, this.title, this.challenges, this.score, this.predicted, this.ends,
      this.start, this.leave,
      ...this.rows.flatMap((r) => [r.pos, r.pts, r.owner, r.guard, r.btn])])
    scene.add.existing(this)
  }

  startClash() {
    if (!this.state.startClash()) { this.toast?.('Club Clash is already running', PAL.muted); return }
    this.toast?.('Club Clash started!', PAL.green)
    this.onChange?.()
  }

  leaveClub() {
    this.state.leaveClub()
    this.toast?.('You left the Club', PAL.muted)
    this.onChange?.()
  }

  capture(index) {
    const res = this.state.capturePosition(index)
    if (!res?.ok) {
      const pips = res?.series ? '  ' + res.series.games.map((g) => (g ? '●' : '○')).join(' ') : ''
      this.toast?.((res?.why || 'Could not capture') + pips, PAL.muted)
      this.onChange?.()
      return
    }
    this.toast?.(`Position #${index + 1} captured · +${res.points} pts/min`, PAL.green)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const clash = s.clashOn ? s.club.clash : null
    const now = Date.now()
    fitText(this.title.setText(s.club.name || 'My Club').setFontSize(16), this.boxW - 140)
    this.challenges.setText(`Challenges ${s.clubChallengesLeft}/${CLUB.challengesPerDay}`)
      .setColor(s.clubChallengesLeft > 0 ? CSS.greenDim : CSS.red)

    this.score.setVisible(!!clash)
    this.predicted.setVisible(!!clash)
    this.ends.setVisible(!!clash)
    this.start.setVisible(!clash)
    this.rows.forEach((r) => {
      r.pos.setVisible(!!clash); r.pts.setVisible(!!clash)
      r.owner.setVisible(!!clash); r.guard.setVisible(!!clash); r.btn.setVisible(!!clash)
    })

    let y = 40
    if (!clash) {
      this.start.setY(y + 20)
      y += 52
    } else {
      this.score.setY(y).setText(`My Club ${Math.round(clash.myScore)}`
        + `  —  Rival ${Math.round(clash.foeScore)}`)
      this.ends.setY(y + 4).setText(`Ends in ${formatHms((clash.endsAt - now) / 1000)}`)
      const pred = s.clashPredicted.map(rewardLabel).join('  ·  ')
      this.predicted.setY(y + 22).setText(`Predicted reward: ${pred || 'none'}`)
      fitText(this.predicted.setFontSize(11), this.boxW - 28)
      y = this.layoutRows(clash, now, y + 44)
    }

    this.leave.setY(y + 18)
    this.boxH = y + 44

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)
    if (clash) this.drawRows(clash, y)
  }

  layoutRows(clash, now, y) {
    this.rows.forEach((view, i) => {
      const pos = clash.positions[i]
      const top = y + i * ROW_H
      view.pos.setY(top + 12)
      view.pts.setY(top + 13)
      view.btn.setY(top + ROW_H / 2 - 2)
      const mine = pos.owner === 'me'
      const guarded = positionProtected(pos, now)
      view.owner.setY(guarded ? top + 5 : top + 12)
        .setText(mine ? 'You' : pos.owner === 'foe' ? 'Rival Club' : 'Empty')
        .setColor(mine ? CSS.accent : pos.owner === 'foe' ? CSS.red : CSS.muted)
      view.guard.setY(top + 22).setVisible(guarded)
        .setText(`Protected ${formatHms((pos.until - now) / 1000)}`)
      view.btn.setText(mine ? 'Yours' : guarded ? 'Protected' : pos.owner === 'foe' ? 'Challenge' : 'Claim')
      fitText(view.btn.txt.setFontSize(11), BTN_W - 12)
      view.btn.setFill(pos.owner === 'foe' ? PAL.accent : PAL.green)
      view.btn.setEnabled(!mine && !guarded
        && (pos.owner !== 'foe' || this.state.clubChallengesLeft > 0))
    })
    return y + CLUB.positions * ROW_H
  }

  // Подложки строк рисуются после того, как известна высота блока: лист карточки
  // лежит в том же graphics и должен оказаться под ними.
  drawRows(clash, bottom) {
    const top0 = bottom - CLUB.positions * ROW_H
    clash.positions.forEach((pos, i) => {
      const top = top0 + i * ROW_H
      this.bg.fillStyle(pos.owner === 'me' ? PAL.accent : PAL.panelAlt, pos.owner === 'me' ? 0.12 : 1)
      this.bg.fillRoundedRect(8, top, this.boxW - 16, ROW_H - 6, 10)
    })
  }
}
