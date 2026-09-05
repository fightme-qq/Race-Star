import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { TASK_TOKENS } from '../../config/rewards.js'
import { label, Bar, Button } from '../widgets.js'

const ROW_H = 58
const HEAD_H = 40

// `9D 19H 11M` — так оставшееся время подписано на кадре шкалы пасса [F].
export function timeLeft(sec) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}D ${h}H`
  if (h > 0) return `${h}H ${m}M`
  return `${m}M`
}

// Daily/Weekly Tasks. Пять дневных и три недельных счётчика — числа с кадров
// [F], см. config/rewards.js. Награда задачи — 🪙, и они уходят прямо в шкалу
// пасса: отдельного кошелька у этой валюты в оригинале нигде не видно.
export class TasksView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.add(this.bg)

    this.groups = [
      this.buildGroup(scene, 'daily', 'DAILY', 'Resets in'),
      this.buildGroup(scene, 'weekly', 'WEEKLY', 'Resets in'),
    ]
    this.boxH = 0
    scene.add.existing(this)
  }

  buildGroup(scene, scope, title, resetCaption) {
    const count = this.state.tasksIn(scope).length
    const head = label(scene, 16, 0, title, { size: 14, bold: true })
    const timer = label(scene, this.boxW - 16, 0, '', { size: 11, color: CSS.muted, align: 'right' })
    const items = Array.from({ length: count }, () => ({
      name: label(scene, 16, 0, '', { size: 13, bold: true }),
      count: label(scene, this.boxW - 100, 0, '', { size: 11, color: CSS.muted, align: 'right' }),
      bar: new Bar(scene, 16, 0, this.boxW - 132, 8, PAL.accent, PAL.panelAlt),
      btn: new Button(scene, this.boxW - 54, 0, 84, 30, 'Claim', { size: 12 }),
    }))
    items.forEach((it, i) => {
      it.btn.on('press', () => this.claim(scope, i))
      this.add([it.name, it.count, it.bar, it.btn])
    })
    this.add([head, timer])
    return { scope, head, timer, items, resetCaption }
  }

  claim(scope, index) {
    const task = this.state.tasksIn(scope)[index]
    if (!task?.claimable) return
    const tokens = this.state.claimTaskReward(scope, task.def.id)
    this.toast?.(`+${tokens} 🪙 to Season Pass`, PAL.gold)
    this.onChange?.()
  }

  refresh() {
    const s = this.state
    let y = 0
    this.bg.clear()

    for (const group of this.groups) {
      const tasks = s.tasksIn(group.scope)
      const boxTop = y
      const boxH = HEAD_H + tasks.length * ROW_H + 10
      this.bg.fillStyle(PAL.panel, 1)
      this.bg.fillRoundedRect(0, boxTop, this.boxW, boxH, 14)
      this.bg.lineStyle(1, PAL.line, 1)
      this.bg.strokeRoundedRect(0, boxTop, this.boxW, boxH, 14)

      group.head.setPosition(16, y + 14)
      group.timer.setPosition(this.boxW - 16, y + 16)
      group.timer.setText(`${group.resetCaption} ${timeLeft(s.resetInSec(group.scope))}`)
      y += HEAD_H

      tasks.forEach((task, i) => {
        const it = group.items[i]
        const top = y + i * ROW_H
        it.name.setPosition(16, top + 8).setText(task.def.title)
        it.count.setPosition(this.boxW - 100, top + 10)
          .setText(`${task.value} / ${task.goal}`)
        it.bar.setPosition(16, top + 32)
        it.bar.color = task.done ? PAL.green : PAL.accent
        it.bar.setValue(task.value / task.goal)
        it.btn.setPosition(this.boxW - 54, top + 22)
        // Забранная задача не исчезает: счётчик до конца периода остаётся на
        // виду, иначе список каждый день прыгает и «сколько осталось» не
        // прочесть. Кнопка при этом гаснет с другой подписью.
        it.btn.setText(task.claimed ? 'Done' : `+${TASK_TOKENS[group.scope]} 🪙`)
        it.btn.setFill(task.claimed ? PAL.line : PAL.accent)
        it.btn.setEnabled(task.claimable)
      })

      y += tasks.length * ROW_H + 10 + 12
    }

    this.boxH = y - 12
  }
}
