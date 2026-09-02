import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { TIER_REQ } from '../../config/career.js'
import { rankOf, canSpend, effectSummary, pointsSpent } from '../../systems/CareerSystem.js'
import { label, Button } from '../widgets.js'

export const NODE_H = 70
const BTN_W = 54

// Карточка узла дерева: название, короткое описание, «сейчас → после» по всем
// эффектам узла и кнопка вложения одного очка.
// Тапается только кнопка — карточку интерактивной не делаем, чтобы не плодить
// вторую hit-area внутри скролла (грабля из AGENTS.md п.10).
export class SkillNode extends Phaser.GameObjects.Container {
  constructor(scene, skill, y, w, onSpend) {
    super(scene, 0, y)
    this.skill = skill
    this.boxW = w

    this.bg = scene.add.graphics()
    this.nameText = label(scene, 12, 9, skill.name, { size: 12, bold: true })
    this.rankText = label(scene, w - BTN_W - 20, 10, '', { size: 11, color: CSS.muted, align: 'right' })
    this.descText = label(scene, 12, 27, skill.desc, { size: 10, color: CSS.dim })
    this.descText.setWordWrapWidth(w - BTN_W - 34)
    this.effText = label(scene, 12, NODE_H - 22, '', { size: 11, bold: true, color: CSS.accent })

    this.btn = new Button(scene, w - BTN_W / 2 - 10, NODE_H / 2, BTN_W, 34, '+1', { size: 14 })
    this.btn.on('press', () => onSpend(skill.id))

    this.add([this.bg, this.nameText, this.rankText, this.descText, this.effText, this.btn])
    scene.add.existing(this)
  }

  refresh(career) {
    const rank = rankOf(career, this.skill.id)
    const locked = pointsSpent(career) < TIER_REQ[this.skill.tier]
    const maxed = rank >= this.skill.max
    const active = rank > 0

    this.bg.clear()
    this.bg.fillStyle(PAL.panelAlt, locked ? 0.4 : 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, NODE_H, 12)
    this.bg.lineStyle(1, active ? PAL.accent : PAL.line, locked ? 0.4 : 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, NODE_H, 12)

    this.nameText.setAlpha(locked ? 0.5 : 1)
    this.descText.setAlpha(locked ? 0.5 : 1)
    this.rankText.setText(`${rank} / ${this.skill.max}`)
    this.effText.setText(maxed
      ? effectSummary(this.skill, rank)
      : `${effectSummary(this.skill, rank)} → ${effectSummary(this.skill, rank + 1)}`)
    this.effText.setColor(locked ? CSS.dim : active ? CSS.accent : CSS.muted)

    if (locked) this.btn.setText('🔒').setEnabled(false)
    else if (maxed) this.btn.setText('MAX').setEnabled(false)
    else this.btn.setText('+1').setEnabled(canSpend(career, this.skill))
  }
}
