import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { TasksView } from './TasksView.js'
import { PassView } from './PassView.js'
import { DailyView } from './DailyView.js'
import { MailView } from './MailView.js'
import { AlbumsView } from '../extras/AlbumsView.js'
import { fitText } from '../layout.js'

const TABS = [
  { key: 'tasks', text: 'TASKS', View: TasksView },
  { key: 'pass', text: 'PASS', View: PassView },
  { key: 'daily', text: 'DAILY', View: DailyView },
  { key: 'mail', text: 'MAIL', View: MailView },
  // Коллекции — сезонное событие с наградами, то есть та же вкладка 5, а не
  // магазин: Stars тратятся внутри неё, гемы в ней не участвуют вовсе.
  { key: 'albums', text: 'ALBUMS', View: AlbumsView },
]

// Вкладка 5 нижнего меню — награды. Кадра этого экрана нет ни одного (см.
// FINDINGS: вкладок 2, 4, 5, 6 нет на всех 42 просмотренных). Что известно из
// кадров — только счётчики задач и шкала пасса `10 / 35`; они и стоят в
// TasksView и PassView. Композиция наша, в языке шага 1.
export class RewardsModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.onChange = onChange
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const bx = 10, by = 96, bw = width - 20, bh = height - 170
    this.box = { bx, by, bw, bh }

    const dim = dimmer(scene, width, height, () => this.close())
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 16, 'Rewards', { size: 22, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 28, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    this.closeBtn = x
    x.on('press', () => this.close())
    this.add([dim, sheet, title, x])

    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((tab, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 66, tw - 6, 32, tab.text, { size: 12 })
      // С пятой вкладкой полоса стала тесной: `ALBUMS` в 63px кеглем 12 не
      // влезает. Ужимаем по измеренной ширине, а не выкидываем вкладку.
      fitText(btn.txt, tw - 14)
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    this.scroll = new ScrollView(scene, bx + 6, by + 90, bw - 12, bh - 102, { fade: PAL.bg })
    this.add(this.scroll)

    // Маска ScrollView обрезает ПИКСЕЛИ, но не зону нажатия. Список добавлен в
    // контейнер после полосы вкладок, то есть лежит выше неё, и прокрученная
    // вниз строка перехватывала тап по вкладке: кнопка под маской не видна, но
    // нажимается. Поймано на гараже (PAINT вместо переключения вкладки надевал
    // деталь), проявляется на ПРАВЫХ вкладках — там, где x кнопок строк
    // совпадает с x вкладки. Поднимаем панель управления окном наверх.
    for (const b of this.tabs) this.bringToTop(b)
    this.bringToTop(this.closeBtn)

    this.setTab(0)
    scene.add.existing(this)
  }

  // Вкладка пересобирается целиком, а не прячется: у пасса 35 строк, у почты
  // переменное число писем, и держать все четыре вида живыми ради переключения
  // означало бы четыре набора объектов на экран, где виден один.
  setTab(index) {
    this.tab = index
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.scroll.clearContent()
    const { View } = TABS[index]
    this.view = new View(this.scene, this.state, this.box.bw - 24, {
      toast: this.toast,
      onChange: () => { this.onChange?.(); this.refresh() },
    })
    this.view.setPosition(6, 0)
    this.scroll.inner.add(this.view)
    this.refresh()
  }

  refresh() {
    if (!this.view?.active) return
    this.view.refresh()
    this.scroll.setContentHeight(this.view.boxH)
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }

  destroy(fromScene) {
    this.scroll?.destroy(fromScene)
    super.destroy(fromScene)
  }
}
