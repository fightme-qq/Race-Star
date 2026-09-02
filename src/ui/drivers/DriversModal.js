import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { formatNum } from '../../utils/format.js'
import { panel, label, Button } from '../widgets.js'
import { SquadView } from './SquadView.js'
import { PacksView } from './PacksView.js'

const TABS = ['SQUAD', 'PACKS']

// Полноэкранная накладка поверх главного экрана: гонка за ней продолжает
// идти, как в оригинале (вкладки не останавливают заезд).
export class DriversModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast }) {
    super(scene, 0, 0)
    this.state = state
    this.onClose = onClose
    this.setDepth(100)

    const { width, height } = scene.scale
    const bx = 12, by = 96
    const bw = width - 24, bh = height - by - 84

    const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0).setInteractive()
    const box = panel(scene, bx, by, bw, bh, { fill: PAL.panel, radius: 16, stroke: PAL.line })
    const title = label(scene, bx + 14, by + 12, 'DRIVERS', { size: 16, bold: true })
    this.gems = label(scene, bx + bw - 14, by + 14, '', { size: 13, bold: true, color: CSS.cyan, align: 'right' })
    this.add([dim, box, title, this.gems])

    this.autoBtn = new Button(scene, bx + 150, by + 22, 86, 26, 'AUTO', { fill: PAL.panelAlt, size: 11 })
    this.autoBtn.on('press', () => { this.squad.auto(); this.refresh() })

    const close = new Button(scene, bx + bw / 2, by + bh - 22, 130, 32, 'Close', { fill: PAL.line, size: 12 })
    close.on('press', () => this.close())
    this.add([this.autoBtn, close])

    const tw = (bw - 36) / TABS.length
    this.tabs = TABS.map((text, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 62, tw - 6, 32, text, { size: 12 })
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    const cx = bx + 12, cy = by + 92
    const cw = bw - 24, ch = bh - 92 - 46
    const opts = { onChange, toast }
    this.squad = new SquadView(scene, state, cx, cy, cw, ch, opts)
    this.packs = new PacksView(scene, state, cx, cy, cw, ch, opts)
    this.add([this.squad, this.packs])

    this.setTab(0)
    scene.add.existing(this)
  }

  setTab(index) {
    this.tab = index
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.squad.setVisible(index === 0)
    this.squad.scroll.locked = index !== 0
    // Пересобираем при входе, а не по onChange: пока вкладка скрыта, паки
    // успевают насыпать в резерв десяток драйверов, и список устаревает.
    if (index === 0) this.squad.build()
    this.packs.setVisible(index === 1)
    this.autoBtn.setVisible(index === 0)
    this.refresh()
  }

  refresh() {
    this.gems.setText(formatNum(this.state.gems) + ' 💎')
    if (this.tab === 0) this.squad.refresh()
    else this.packs.refresh()
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }

  destroy(fromScene) {
    this.squad?.destroy(fromScene)
    super.destroy(fromScene)
  }
}
