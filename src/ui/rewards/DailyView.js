import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { LOGIN } from '../../config/rewards.js'
import { label, Button } from '../widgets.js'
import { rewardText, rewardColor } from './reward.js'

const HEAD_H = 96
const CELL_H = 74
const MILE_H = 44

// `DailyRewards` с ротацией и майлстоунами [E] — из лога билда известно, что
// такой блок есть (`Expected at least one row in the Milestones_Rotation
// sheet`), сами награды наши [X].
//
// Цикл и стрик РАЗЪЕДИНЕНЫ: пропуск дня рвёт стрик, но не отбрасывает игрока к
// первой награде цикла. Иначе один пропущенный день обнулял бы неделю
// накопления, и блок из поощрения превращался бы в наказание.
export class DailyView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, 16, 14, 'Daily Rewards', { size: 16, bold: true })
    this.sub = label(scene, 16, 38, '', { size: 12, color: CSS.muted })
    this.claimBtn = new Button(scene, w / 2, 74, w - 32, 36, 'Claim', { size: 14 })
    this.claimBtn.on('press', () => this.claim())
    this.add([this.bg, this.title, this.sub, this.claimBtn])

    const cols = 4
    const cw = (w - 20) / cols
    this.cells = LOGIN.cycle.map((reward, i) => {
      const cx = 10 + cw * (i % cols) + cw / 2
      const day = label(scene, cx, 0, `DAY ${i + 1}`, { size: 10, bold: true, color: CSS.muted, align: 'center' })
      const icon = label(scene, cx, 0, '', { size: 13, bold: true, align: 'center' })
      return { reward, day, icon, cx, cw, row: Math.floor(i / cols) }
    })
    this.cells.forEach((c) => this.add([c.day, c.icon]))

    this.mileTitle = label(scene, 16, 0, 'Milestones', { size: 14, bold: true })
    this.miles = LOGIN.milestones.map((m) => ({
      def: m,
      name: label(scene, 16, 0, `${m.days} days played`, { size: 13 }),
      btn: new Button(scene, w - 66, 0, 108, 30, '', { size: 11 }),
    }))
    this.miles.forEach((m) => {
      m.btn.on('press', () => this.claimMilestone(m.def.days))
      this.add([m.name, m.btn])
    })
    this.add(this.mileTitle)

    this.boxH = 0
    scene.add.existing(this)
  }

  claim() {
    const texts = this.state.claimLoginReward()
    if (!texts.length) { this.toast?.('Come back tomorrow', PAL.muted); return }
    this.toast?.('Daily Reward  ' + texts.join('  '), PAL.green)
    this.onChange?.()
  }

  // Майлстоун приезжает ВМЕСТЕ с дневной наградой — отдельного «забрать» у
  // него нет, поэтому кнопка делает тот же вызов и гаснет, когда сегодняшний
  // вход уже забран. Так порог не может обогнать цикл и выдать награду дважды.
  claimMilestone() {
    const texts = this.state.claimLoginReward()
    if (!texts.length) { this.toast?.('Come back tomorrow', PAL.muted); return }
    this.toast?.('Milestone  ' + texts.join('  '), PAL.gold)
    this.onChange?.()
  }

  refresh() {
    const st = this.state.loginInfo
    this.bg.clear()

    const rows = Math.ceil(this.cells.length / 4)
    const gridTop = HEAD_H
    const gridH = rows * CELL_H + 12
    this.panelBox(0, HEAD_H + gridH)

    this.sub.setText(`Streak ${st.streak}   ·   ${st.total} days played`)
    this.claimBtn.setText(st.available ? `Claim  ${rewardText(this.state, st.reward)}` : 'Claimed today')
    this.claimBtn.setEnabled(st.available)
    this.claimBtn.setFill(st.available ? PAL.green : PAL.line)

    this.cells.forEach((c, i) => {
      const y = gridTop + c.row * CELL_H + 8
      const done = i < st.cycleDay
      const isNext = i === st.cycleDay
      this.bg.fillStyle(done ? PAL.panelAlt : isNext ? PAL.green : PAL.panelAlt, done ? 1 : isNext ? 0.16 : 1)
      this.bg.fillRoundedRect(c.cx - c.cw / 2 + 4, y, c.cw - 8, CELL_H - 12, 10)
      if (isNext) {
        this.bg.lineStyle(2, PAL.green, 1)
        this.bg.strokeRoundedRect(c.cx - c.cw / 2 + 4, y, c.cw - 8, CELL_H - 12, 10)
      }
      c.day.setPosition(c.cx, y + 10)
      c.icon.setPosition(c.cx, y + 32)
      c.icon.setText(done ? '✓' : rewardText(this.state, c.reward))
      c.icon.setColor(done ? CSS.muted : '#' + rewardColor(c.reward).toString(16).padStart(6, '0'))
    })

    let y = HEAD_H + gridH + 12
    const mileH = 40 + this.miles.length * MILE_H + 10
    this.panelBox(y, mileH)
    this.mileTitle.setPosition(16, y + 14)
    this.miles.forEach((m, i) => {
      const info = st.milestones[i]
      const top = y + 40 + i * MILE_H
      m.name.setPosition(16, top + 8)
      m.name.setColor(info.done ? CSS.text : CSS.muted)
      m.btn.setPosition(this.boxW - 66, top + 15)
      m.btn.setText(info.claimed ? '✓' : rewardText(this.state, info.reward))
      m.btn.setFill(info.claimed ? PAL.line : info.claimable ? PAL.gold : PAL.panelAlt)
      m.btn.setEnabled(info.claimable && st.available)
    })

    this.boxH = y + mileH
  }

  panelBox(top, h, radius = 14) {
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, top, this.boxW, h, radius)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, top, this.boxW, h, radius)
  }
}
