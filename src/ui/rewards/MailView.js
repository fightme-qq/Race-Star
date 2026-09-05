import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { label, Button } from '../widgets.js'
import { rewardText } from './reward.js'

const ROW_H = 76

// `MailboxMessages` [E]. Сейчас сюда падают итоги сезона и повышения в лиге —
// то, что случилось, пока игрок сидел в другой вкладке. С шага 8 тем же
// каналом придут награды арены и турниров.
//
// Список пересобирается ЦЕЛИКОМ при изменении числа писем: гонка идёт под
// модалкой, и сезон закрывается прямо в открытой вкладке.
export class MailView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange
    this.bg = scene.add.graphics()
    this.empty = label(scene, w / 2, 40, 'No messages', { size: 13, color: CSS.muted, align: 'center' })
    this.claimAll = new Button(scene, w / 2, 22, w - 32, 34, 'Claim all', { size: 13 })
    this.claimAll.on('press', () => this.takeAll())
    this.add([this.bg, this.empty, this.claimAll])
    this.rows = []
    this.signature = null
    this.boxH = 0
    scene.add.existing(this)
  }

  build(messages) {
    for (const r of this.rows) { r.title.destroy(); r.body.destroy(); r.btn.destroy() }
    this.rows = messages.map((msg) => {
      const title = label(this.scene, 16, 0, msg.title, { size: 13, bold: true })
      // Перенос по ширине обязателен: текст письма длиннее строки и уезжал
      // под кнопку награды. Ширина — до кнопки, а не до края карточки.
      const body = label(this.scene, 16, 0, msg.body, { size: 11, color: CSS.muted })
      body.setWordWrapWidth(this.boxW - 140)
      const btn = new Button(this.scene, this.boxW - 62, 0, 100, 30, '', { size: 11 })
      btn.on('press', () => this.take(msg.id))
      this.add([title, body, btn])
      return { id: msg.id, title, body, btn }
    })
    this.signature = messages.map((m) => m.id + (m.claimed ? '1' : '0')).join(',')
  }

  take(id) {
    const text = this.state.claimMailReward(id)
    if (!text) return
    this.toast?.('Mail  ' + text, PAL.green)
    this.onChange?.()
  }

  takeAll() {
    const texts = this.state.mailList
      .filter((m) => !m.claimed && m.reward)
      .map((m) => this.state.claimMailReward(m.id))
      .filter(Boolean)
    if (!texts.length) { this.toast?.('Nothing to collect', PAL.muted); return }
    this.toast?.(`Mail  ${texts.length} rewards collected`, PAL.green)
    this.onChange?.()
  }

  refresh() {
    const messages = this.state.mailList
    const sig = messages.map((m) => m.id + (m.claimed ? '1' : '0')).join(',')
    if (sig !== this.signature) this.build(messages)

    this.bg.clear()
    this.empty.setVisible(messages.length === 0)
    const pending = messages.filter((m) => !m.claimed && m.reward).length
    this.claimAll.setVisible(messages.length > 0)
    this.claimAll.setEnabled(pending > 0)
    this.claimAll.setText(pending > 0 ? `Claim all (${pending})` : 'All collected')
    this.claimAll.setFill(pending > 0 ? PAL.accent : PAL.line)

    if (!messages.length) {
      this.bg.fillStyle(PAL.panel, 1)
      this.bg.fillRoundedRect(0, 0, this.boxW, 80, 14)
      this.bg.lineStyle(1, PAL.line, 1)
      this.bg.strokeRoundedRect(0, 0, this.boxW, 80, 14)
      this.boxH = 80
      return
    }

    let y = 48
    messages.forEach((msg, i) => {
      const row = this.rows[i]
      const top = y + i * ROW_H
      this.bg.fillStyle(PAL.panel, 1)
      this.bg.fillRoundedRect(0, top, this.boxW, ROW_H - 8, 14)
      this.bg.lineStyle(1, msg.claimed ? PAL.line : PAL.accent, msg.claimed ? 1 : 0.5)
      this.bg.strokeRoundedRect(0, top, this.boxW, ROW_H - 8, 14)
      row.title.setPosition(16, top + 12)
      row.body.setPosition(16, top + 32)
      row.btn.setPosition(this.boxW - 62, top + 34)
      row.btn.setText(msg.claimed ? '✓' : rewardText(this.state, msg.reward))
      row.btn.setFill(msg.claimed ? PAL.line : PAL.green)
      row.btn.setEnabled(!msg.claimed && !!msg.reward)
    })

    this.boxH = y + messages.length * ROW_H
  }
}
