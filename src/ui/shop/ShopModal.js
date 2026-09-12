import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { DealsView } from './DealsView.js'
import { CashView } from './CashView.js'
import { GemsView } from './GemsView.js'
import { PassesView } from './PassesView.js'
import { LuckyView } from '../extras/LuckyView.js'
import { CodesView } from '../extras/CodesView.js'
import { fitText } from '../layout.js'

const TABS = [
  { key: 'deals', text: 'DEALS', View: DealsView },
  { key: 'cash', text: 'CASH', View: CashView },
  { key: 'gems', text: 'GEMS', View: GemsView },
  { key: 'passes', text: 'PASSES', View: PassesView },
  // Lucky Draw и гифт-коды — тот же кошелёк гемов, что и весь магазин: розыгрыш
  // стоит гемов [F], код выдаёт их [E]. Поэтому они здесь, а не пятой модалкой.
  { key: 'lucky', text: 'LUCKY', View: LuckyView },
  { key: 'codes', text: 'CODES', View: CodesView },
]

// Вкладка 6 нижнего меню — магазин. Кадра этого экрана нет ни одного (см.
// ref/index.json: вкладок 2, 4, 5, 6 нет на всех 42 просмотренных), но состав
// позиций восстановлен из локализации билда [E], а десять цен — с витрины
// App Store [F]. Композиция наша, в языке шага 1.
//
// Порядок вкладок не случайный: первыми идут те две, где что-то происходит
// (бесплатное и деньги за гемы), витрина реальных денег — за ними.
export class ShopModal extends Phaser.GameObjects.Container {
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
    const title = label(scene, width / 2, by + 16, 'Shop', { size: 22, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 28, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.wallet = label(scene, bx + 16, by + 22, '', { size: 12, color: CSS.muted })
    this.add([dim, sheet, title, x, this.wallet])

    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((tab, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 66, tw - 6, 32, tab.text, { size: 11 })
      // Шесть вкладок на 390px дают по 52px на кнопку, а `PASSES` кеглем 12
      // занимает 54 — подпись вылезала за плашку. Кегль ужимается по
      // ИЗМЕРЕННОЙ ширине; выкидывать вкладку нельзя, она единственный вход.
      fitText(btn.txt, tw - 12)
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    this.scroll = new ScrollView(scene, bx + 6, by + 90, bw - 12, bh - 102, { fade: PAL.bg })
    this.add(this.scroll)

    this.setTab(0)
    scene.add.existing(this)
  }

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
    this.wallet.setText(`${Math.floor(this.state.gems)} 💎`)
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
