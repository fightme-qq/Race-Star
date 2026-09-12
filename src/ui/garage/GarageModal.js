import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { MODAL } from '../../config/layout.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { formatMoney } from '../../utils/format.js'
import { CarsView } from './CarsView.js'
import { PartsView } from './PartsView.js'
import { PaintView } from './PaintView.js'

const TABS = [
  { key: 'cars', text: 'CARS', View: CarsView },
  { key: 'parts', text: 'PARTS', View: PartsView },
  { key: 'paint', text: 'PAINT', View: PaintView },
]

// Шаг 7 — гараж. Экрана нет ни на одном публичном кадре (билд видео 1.2-1.3,
// гаража в нём ещё нет), поэтому композиция целиком наша; имена машин, слотов,
// осколков и косметики — из локализации билда [E], см. шапку config/garage.js.
//
// Порядок вкладок = порядок решений игрока: сначала КАКАЯ машина (это выбор
// расклада off/def, единственный обратимый во всей игре), потом чем её набить,
// и только потом косметика, которая силы не даёт вовсе.
export class GarageModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.onChange = onChange
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const bx = MODAL.side, by = MODAL.top
    const bw = width - MODAL.side * 2, bh = height - MODAL.top - MODAL.bottom + 10
    this.box = { bx, by, bw, bh }

    // Затемнение — через dimmer(): вкладка нижнего меню срабатывает на
    // нажатии, и наивный pointerup закрыл бы окно тем же тапом (правило 18).
    const dim = dimmer(scene, width, height, () => this.close())
    // Лист окна добавляется В КОНТЕЙНЕР: panel() кладёт графику на сцену с
    // глубиной 0, то есть под собственное затемнение модалки (правило 12).
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 16, 'Garage', { size: 22, bold: true, align: 'center' })
    this.wallet = label(scene, bx + 16, by + 22, '', { size: 12, color: CSS.muted })
    this.add([dim, sheet, title, this.wallet])

    this.scroll = new ScrollView(scene, bx + 6, by + 90, bw - 12, bh - 102, { fade: PAL.bg })
    this.add(this.scroll)

    // Шапка окна добавляется ПОСЛЕ списка, и это не косметика.
    // Маска ScrollView режет ТОЛЬКО картинку: hit-area уехавшей вверх строки
    // остаётся там, куда её увёл скролл, а Phaser отдаёт тап верхнему по
    // порядку отрисовки. При списке, добавленном последним, тап по вкладке
    // PAINT попадал в невидимую кнопку `Equip` восьмого слота — вкладка не
    // переключалась, зато молча надевалась деталь. Замер: после `wheel` на
    // вкладке PARTS `tabs[2]` не получал ни одного pointerdown.
    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((tab, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 66, tw - 6, 32, tab.text, { size: 12 })
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    const x = new Button(scene, bx + bw - 34, by + 28, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.add(x)

    this.setTab(0)
    scene.add.existing(this)
  }

  // Вкладка пересобирается целиком, как в RewardsModal: у частей восемь строк с
  // паками, у косметики — тринадцать плиток, и держать все три вида живыми ради
  // переключения значило бы три набора объектов там, где виден один.
  setTab(index) {
    this.tab = index
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.scroll.clearContent()
    const { View } = TABS[index]
    // Содержимое кладётся в scroll.inner и считается ОТ УГЛА списка, а не от
    // угла экрана (правило 13).
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
    this.wallet.setText(`${formatMoney(this.state.cash)}   ${Math.floor(this.state.gems)} 💎`)
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
