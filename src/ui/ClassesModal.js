import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { RACE_CLASSES } from '../config/classes.js'
import { panel, label, Button } from './widgets.js'
import { ScrollView } from './ScrollView.js'
import { ClassCard } from './classes/ClassCard.js'

const GAP = 12

// Модалка «Classes» по кадру: белый лист, заголовок по центру, крестик в
// правом верхнем углу, вертикальный список карточек во всю ширину. Сетки 2×3,
// которая была у нас до шага 1, в оригинале нет — карточка слишком высокая.
export class ClassesModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onPick, onUnlock, onClose, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setInteractive()
    dim.on('pointerup', () => this.close())

    const bx = 10, by = 96, bw = width - 20, bh = height - 170
    // Лист кладём В КОНТЕЙНЕР, а не просто на сцену: у модалки глубина 100, а
    // graphics со сцены рисуется на нуле — то есть ПОД затемнением. Старая
    // модалка страдала тем же, на тёмной теме это просто не было заметно.
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 18, 'Classes', { size: 22, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 30, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.add([dim, sheet, title, x])

    this.scroll = new ScrollView(scene, bx + 6, by + 60, bw - 12, bh - 72)
    this.cards = RACE_CLASSES.map((def) => {
      const card = new ClassCard(scene, state, def, bw - 24, {
        onPick: (id) => { onPick(id); this.close() },
        onUnlock: (id) => { if (onUnlock(id)) this.refresh() },
        onRename: (id) => this.rename(id),
        onAdvance: () => this.toast?.('League standings arrive with the Leagues tab', PAL.muted),
        onDetails: () => this.toast?.('Class details arrive with the Leagues tab', PAL.muted),
      })
      this.scroll.inner.add(card)
      return card
    })
    this.add(this.scroll)

    this.refresh()
    scene.add.existing(this)
  }

  // [F] Карандаш в поле Team Name. Ввод текста в Phaser своего поля не имеет,
  // а тащить DOM-оверлей ради одной строки дороже, чем занять системный
  // диалог: в Capacitor-вебвью он работает так же, как в браузере.
  rename(classId) {
    const cs = this.state.classes[classId]
    const next = window.prompt('Team name', cs.teamName)
    if (next === null) return
    const trimmed = String(next).slice(0, 18).trim()
    if (!trimmed) return
    cs.teamName = trimmed
    this.state.save()
    this.refresh()
  }

  // Высота карточки зависит от того, открыт ли класс, поэтому раскладка
  // пересчитывается на каждом refresh — открытие класса двигает список.
  refresh() {
    let y = 0
    for (const card of this.cards) {
      card.refresh()
      card.setPosition(6, y)
      y += card.cardH + GAP
    }
    this.scroll.setContentHeight(y - GAP)
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }
}
