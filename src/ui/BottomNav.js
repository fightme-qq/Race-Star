import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'
import { panel } from './widgets.js'

// 6 вкладок без подписей — как в оригинале. На Этапе 1 живая только первая.
export const TABS = [
  { id: 'main',    icon: '📋', title: 'Гонка' },
  { id: 'gear',    icon: '🎒', title: 'Снаряжение' },
  { id: 'drivers', icon: '🃏', title: 'Драйверы' },
  { id: 'leagues', icon: '🏆', title: 'Лиги' },
  { id: 'rewards', icon: '🎖', title: 'Награды' },
  { id: 'shop',    icon: '🛒', title: 'Магазин' },
]

export class BottomNav extends Phaser.GameObjects.Container {
  constructor(scene, y, width, onSelect) {
    super(scene, 0, y)
    this.active = 0

    panel(scene, 0, y, width, 70, { fill: PAL.panelAlt, radius: 0 })
    const line = scene.add.graphics()
    line.lineStyle(1, PAL.line, 1)
    line.lineBetween(0, y, width, y)

    this.items = TABS.map((tab, i) => {
      const cx = (width / TABS.length) * (i + 0.5)
      const glow = scene.add.circle(cx, y + 26, 22, PAL.accent, 0.18).setVisible(i === 0)
      const icon = scene.add.text(cx, y + 26, tab.icon, { fontFamily: FONT, fontSize: '22px' }).setOrigin(0.5)
      icon.setAlpha(i === 0 ? 1 : 0.45)
      const zone = scene.add.zone(cx, y + 30, width / TABS.length, 60).setInteractive()
      zone.on('pointerdown', () => onSelect(i, tab))
      return { glow, icon, zone }
    })
    scene.add.existing(this)
  }

  setActive(index) {
    this.active = index
    this.items.forEach((it, i) => {
      it.glow.setVisible(i === index)
      it.icon.setAlpha(i === index ? 1 : 0.45)
    })
  }
}
