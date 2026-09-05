import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { PASS } from '../../config/rewards.js'
import { label, Bar, Button } from '../widgets.js'
import { rewardText, rewardColor } from './reward.js'
import { timeLeft } from './TasksView.js'

const HEAD_H = 132
const ROW_H = 46

// Season Pass. С кадров известны две вещи: сезон идёт ≈10 дней (`9D 19H 11M`)
// и шкала имеет 35 уровней (`10 / 35`) [F]. Ветки в билде названы
// Rookie/Champion/Premium [E] — у нас две колонки: бесплатная и премиум.
//
// Премиум НЕ покупается: в оригинале это IAP `Rookie Pass $4.99` [F], то есть
// он приходит вместе с магазином (шаг 5). Ветка нарисована и заблокирована —
// придумать ей цену в гемах значило бы поставить число, которое придётся
// выбрасывать через шаг.
export class PassView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, 16, 14, '', { size: 16, bold: true })
    this.timer = label(scene, w - 16, 16, '', { size: 11, color: CSS.muted, align: 'right' })
    this.levelCap = label(scene, 16, 42, '', { size: 13, color: CSS.text })
    this.bar = new Bar(scene, 16, 66, w - 32, 12, PAL.gold, PAL.panelAlt)
    // Строка токенов и кнопка премиума стоят В РАЗНЫХ рядах, а не рядом:
    // на 390px они пересекались, и `npm run shot` показал ценник поверх
    // подписи. Ширины тут впритык, поэтому подпись короткая.
    this.tokens = label(scene, 16, 84, '', { size: 11, color: CSS.muted })
    this.buyBtn = new Button(scene, w / 2, 112, w - 32, 30, 'Champion Pass', { size: 11, fill: PAL.panelAlt })
    this.buyBtn.on('press', () => this.toast?.('Champion Pass arrives with the Shop', PAL.muted))

    this.headFree = label(scene, 0, 0, 'FREE', { size: 10, bold: true, color: CSS.muted, align: 'center' })
    this.headPrem = label(scene, 0, 0, 'CHAMPION', { size: 10, bold: true, color: CSS.dim, align: 'center' })

    this.add([this.bg, this.title, this.timer, this.levelCap, this.bar, this.tokens,
      this.buyBtn, this.headFree, this.headPrem])

    const colW = (w - 90) / 2
    this.rows = Array.from({ length: PASS.levels }, (_, i) => {
      const lv = i + 1
      const num = label(scene, 30, 0, String(lv), { size: 12, bold: true, align: 'center' })
      const free = new Button(scene, 62 + colW / 2, 0, colW - 8, 32, '', { size: 11 })
      const prem = new Button(scene, 70 + colW * 1.5, 0, colW - 8, 32, '', { size: 11 })
      free.on('press', () => this.claim(lv, false))
      prem.on('press', () => this.claim(lv, true))
      this.add([num, free, prem])
      return { lv, num, free, prem }
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  claim(level, premium) {
    const text = this.state.claimPassReward(level, premium)
    if (!text) {
      this.toast?.(premium ? 'Champion Pass required' : 'Reach this level first', PAL.muted)
      return
    }
    this.toast?.(`Season Pass Lv.${level}  ${text}`, PAL.gold)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    const p = s.passProgress
    const rows = s.passRows

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, HEAD_H, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, HEAD_H, 14)

    this.title.setText(`Season Pass ${s.rw.pass.season}`)
    this.timer.setText(timeLeft(s.passLeftSec))
    this.levelCap.setText(`Level ${p.level} / ${p.max}`)
    this.bar.setValue(p.need ? p.into / p.need : 1)
    this.tokens.setText(p.need
      ? `${p.into} / ${p.need} 🪙 to next level  ·  ${p.tokens} earned`
      : `Pass complete  ·  ${p.tokens} 🪙 earned`)

    const top = HEAD_H + 12
    this.headFree.setPosition(62 + (this.boxW - 90) / 4, top)
    this.headPrem.setPosition(70 + (this.boxW - 90) * 0.75, top)

    const listTop = top + 18
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, listTop, this.boxW, ROW_H * PASS.levels + 8, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, listTop, this.boxW, ROW_H * PASS.levels + 8, 14)

    rows.forEach((row, i) => {
      const view = this.rows[i]
      const y = listTop + 4 + i * ROW_H + ROW_H / 2
      view.num.setPosition(30, y - 7)
      view.num.setColor(row.unlocked ? CSS.text : CSS.dim)
      // Взятый уровень подсвечен полосой — иначе в 35 одинаковых строках
      // граница «докуда дошёл» не читается вовсе.
      if (row.unlocked) {
        this.bg.fillStyle(PAL.gold, 0.10)
        this.bg.fillRect(8, listTop + 4 + i * ROW_H, this.boxW - 16, ROW_H - 2)
      }
      this.paint(view.free, row.free, row.unlocked)
      this.paint(view.prem, row.premium, row.unlocked && s.rw.pass.premium)
      view.free.setPosition(view.free.x, y)
      view.prem.setPosition(view.prem.x, y)
    })

    this.boxH = listTop + ROW_H * PASS.levels + 8
  }

  paint(btn, track, unlocked) {
    btn.setText(track.claimed ? '✓' : rewardText(this.state, track.reward))
    btn.setFill(track.claimed ? PAL.line : track.claimable ? rewardColor(track.reward) : PAL.panelAlt)
    btn.setEnabled(track.claimable)
    // Заблокированная строка не должна выглядеть выключенной кнопкой: это
    // витрина будущей награды, а не «нажми».
    btn.setAlpha(unlocked || track.claimed ? 1 : 0.6)
  }
}
