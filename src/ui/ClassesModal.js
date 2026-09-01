import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { RACE_CLASSES } from '../config/classes.js'
import { formatMoney, formatNum } from '../utils/format.js'
import { panel, label, Button } from './widgets.js'

// Модалка "Choose Your Sport": сетка 2x3, счётчик "N of 6 unlocked",
// на карточке — фанаты, лига, кнопка Watch / Unlock $X.
export class ClassesModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onPick, onUnlock, onClose }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.setDepth(100)

    const { width, height } = scene.scale
    const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive()
    dim.on('pointerup', () => this.close())

    const bx = 16, by = 120, bw = width - 32, bh = 600
    panel(scene, bx, by, bw, bh, { fill: PAL.panel, radius: 16, stroke: PAL.line })
    this.title = label(scene, width / 2, by + 16, 'CHOOSE YOUR CLASS', { size: 16, bold: true, align: 'center' })
    this.counter = label(scene, width / 2, by + 38, '', { size: 11, color: CSS.muted, align: 'center' })

    this.add([dim, this.title, this.counter])

    this.cards = RACE_CLASSES.map((def, i) => {
      const col = i % 2, row = Math.floor(i / 2)
      const cw = (bw - 36) / 2, ch = 150
      const cx = bx + 12 + col * (cw + 12)
      const cy = by + 62 + row * (ch + 10)
      const g = scene.add.graphics()
      const icon = label(scene, cx + cw / 2, cy + 10, def.icon, { size: 30, align: 'center' })
      const name = label(scene, cx + cw / 2, cy + 52, def.name, { size: 13, bold: true, align: 'center' })
      const info = label(scene, cx + cw / 2, cy + 70, '', { size: 10, color: CSS.muted, align: 'center' })
      const btn = new Button(scene, cx + cw / 2, cy + ch - 24, cw - 20, 32, '', { size: 12 })
      btn.on('press', () => {
        const cs = state.classes[def.id]
        if (cs.unlocked) { onPick(def.id); this.close() }
        else if (onUnlock(def.id)) this.refresh()
      })
      this.add([g, icon, name, info, btn])
      return { def, g, name, info, btn, rect: { cx, cy, cw, ch } }
    })

    const close = new Button(scene, width / 2, by + bh - 26, 120, 34, 'Закрыть', { fill: PAL.line, size: 12 })
    close.on('press', () => this.close())
    this.add(close)

    this.refresh()
    scene.add.existing(this)
  }

  refresh() {
    const s = this.state
    const unlocked = Object.values(s.classes).filter((c) => c.unlocked).length
    this.counter.setText(`${unlocked} of ${RACE_CLASSES.length} unlocked`)

    for (const card of this.cards) {
      const cs = s.classes[card.def.id]
      const active = s.activeClass === card.def.id
      const { cx, cy, cw, ch } = card.rect
      card.g.clear()
      card.g.fillStyle(cs.unlocked ? PAL.panelAlt : PAL.bg, 1)
      card.g.fillRoundedRect(cx, cy, cw, ch, 12)
      card.g.lineStyle(2, active ? PAL.accent : PAL.line, 1)
      card.g.strokeRoundedRect(cx, cy, cw, ch, 12)

      if (cs.unlocked) {
        card.info.setText(`👥 ${formatNum(cs.fans)}   SEASON ${cs.season}`)
        card.btn.setText(active ? 'Активен' : 'Watch').setFill(active ? PAL.line : PAL.accent).setEnabled(!active)
      } else {
        const price = s.unlockPriceFor(card.def.id)
        card.info.setText('Заблокирован')
        card.btn.setText('Unlock ' + formatMoney(price)).setFill(PAL.green).setEnabled(s.cash >= price)
      }
    }
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }
}
