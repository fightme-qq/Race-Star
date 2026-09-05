import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { RACE_CLASSES } from '../config/classes.js'
import { formatMoney } from '../utils/format.js'
import { panel, label, Button, dimmer } from './widgets.js'
import { ScrollView } from './ScrollView.js'
import { ClassCard } from './classes/ClassCard.js'

const GAP = 12

// Модалка «Classes» по кадру: белый лист, заголовок по центру, крестик в
// правом верхнем углу, вертикальный список карточек во всю ширину. Сетки 2×3,
// которая была у нас до шага 1, в оригинале нет — карточка слишком высокая.
export class ClassesModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onPick, onUnlock, onClose, onLeagues, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.onLeagues = onLeagues
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const dim = dimmer(scene, width, height, () => this.close())

    const bx = 10, by = 96, bw = width - 20, bh = height - 170
    // Лист кладём В КОНТЕЙНЕР, а не просто на сцену: у модалки глубина 100, а
    // graphics со сцены рисуется на нуле — то есть ПОД затемнением. Старая
    // модалка страдала тем же, на тёмной теме это просто не было заметно.
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 14, 'Classes', { size: 22, bold: true, align: 'center' })
    // [F] Под заголовком на кадре стоит счётчик «3 of 6 unlocked» — до этого
    // шага его у нас не было вовсе. Сумма дохода рядом с ним [X]: с шагом
    // «параллельный доход» открытые классы платят, даже когда игрок в них не
    // едет, и это единственное место, где сумма видна целиком.
    this.subtitle = label(scene, width / 2, by + 40, '', { size: 12, align: 'center', color: CSS.muted })
    const x = new Button(scene, bx + bw - 34, by + 30, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.add([dim, sheet, title, this.subtitle, x])

    this.scroll = new ScrollView(scene, bx + 6, by + 62, bw - 12, bh - 74)
    this.cards = RACE_CLASSES.map((def) => {
      const card = new ClassCard(scene, state, def, bw - 24, {
        onPick: (id) => { onPick(id); this.close() },
        onUnlock: (id) => { if (onUnlock(id)) this.refresh() },
        onRename: (id) => this.rename(id),
        // Обе кнопки ведут на вкладку лиг: `Advance` — сразу к повышению,
        // `Details` — к таблице сезона. Забирать повышение прямо с карточки
        // нельзя: игрок не увидит, откуда взялись очки и куда он поднялся.
        onAdvance: (id) => this.openLeagues(id),
        onDetails: (id) => this.openLeagues(id),
      })
      this.scroll.inner.add(card)
      return card
    })
    this.add(this.scroll)

    this.refresh()
    scene.add.existing(this)
  }

  openLeagues(classId) {
    this.onClose?.()
    this.destroy(true)
    this.onLeagues?.(classId)
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
    const s = this.state
    this.subtitle.setText(`${s.unlockedCount} of ${RACE_CLASSES.length} unlocked` +
      `   ·   total ${formatMoney(s.incomePerSec)} /s`)
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
