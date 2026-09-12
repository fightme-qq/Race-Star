import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { fitText } from '../layout.js'
import { ScrollView } from '../ScrollView.js'
import { SlotsView } from './SlotsView.js'
import { PacksView } from './PacksView.js'
import { BagView } from './BagView.js'

const TABS = [
  { key: 'gear', text: 'GEAR', View: SlotsView },
  { key: 'packs', text: 'PACKS', View: PacksView },
  { key: 'bag', text: 'BAG', View: BagView },
  // Четвёртая кнопка — не вкладка, а ПЕРЕХОД в гараж (шаг 7). Вкладок нижнего
  // меню ровно шесть [F], седьмую добавлять нельзя, а гараж и гир — две части
  // одной работы «снаряди команду»: у них общая механика предметов (GearBag) и
  // общий гемовый кошелёк. Отдельный вход с главного экрана занял бы место в
  // шапке, где с шага 1 уже нет свободного слота.
  { key: 'garage', text: 'GARAGE', View: null },
]

// Вкладка 2 нижнего меню — гир драйверов (`SportTeamGear` [D]). Кадра этого
// экрана нет ни одного (вкладок 2, 4, 5, 6 нет на всех 42 просмотренных, см.
// ref/index.json), зато слой локализации билда [E] дал состав: десять слотов со
// своими именами у каждого класса, `Slot not available`, два пака с
// `Open x1 / Open x10`, купоны, `Shards to upgrade`, `Rarity Upgrades`.
// Композиция наша, в языке шага 1; разбор границы источников — в config/gear.js.
//
// Порядок вкладок — по частоте обращения: сначала то, что надето (и чинится
// одним тапом), потом где взять ещё, и только потом разбор сумки.
export class GearModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast, onGarage }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.onChange = onChange
    this.toast = toast
    this.toGarage = onGarage
    this.setDepth(100)

    const { width, height } = scene.scale
    const bx = 10, by = 96, bw = width - 20, bh = height - 170
    this.box = { bx, by, bw, bh }

    // Затемнение через dimmer: вкладка нижнего меню открывает окно по
    // pointerdown, и отпускание того же тапа закрыло бы его в тот же кадр
    // (правило 18). Вся графика окна идёт В КОНТЕЙНЕР (правило 12).
    const dim = dimmer(scene, width, height, () => this.close())
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 16, 'Gear', { size: 22, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 28, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    // Класс подписан в шапке окна: имена слотов у каждого класса свои, и без
    // подписи «Balaclava» вместо «Helmet» читается как ошибка.
    this.sub = label(scene, bx + 16, by + 22, '', { size: 12, color: CSS.muted })
    this.add([dim, sheet, title, x, this.sub])

    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((tab, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 66, tw - 6, 32, tab.text, { size: 12 })
      btn.on('press', () => {
        if (!tab.View) { this.toGarage?.(); return }
        this.setTab(i)
      })
      this.add(btn)
      return btn
    })

    this.scroll = new ScrollView(scene, bx + 6, by + 90, bw - 12, bh - 102, { fade: PAL.bg })
    this.add(this.scroll)

    this.setTab(0)
    scene.add.existing(this)
  }

  // Вид пересобирается целиком, а не прячется: в сумке переменное число
  // предметов, и держать три набора объектов ради переключения значило бы
  // платить за то, чего не видно (как в RewardsModal).
  setTab(index) {
    this.tab = index
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.scroll.clearContent()
    const { View } = TABS[index]
    this.view = new View(this.scene, this.state, this.box.bw - 24, {
      toast: this.toast,
      onChange: () => { this.onChange?.(); this.refresh() },
    })
    // Содержимое ScrollView позиционируется от угла списка (правило 13).
    this.view.setPosition(6, 0)
    this.scroll.inner.add(this.view)
    this.refresh()
  }

  refresh() {
    if (!this.view?.active) return
    fitText(this.sub.setFontSize(12)
      .setText(`${this.state.clsDef.name}  ·  ${Math.floor(this.state.gems)} 💎`),
    this.box.bw / 2 - 30)
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
