import Phaser from 'phaser'
import { PAL, FONT } from '../config/palette.js'
import { panel } from './widgets.js'
import { NAV_H } from '../config/layout.js'

// 6 вкладок без подписей — как в оригинале.
export const TABS = [
  { id: 'main',    icon: '📋', title: 'Race' },
  { id: 'gear',    icon: '🎒', title: 'Gear' },
  { id: 'drivers', icon: '🃏', title: 'Drivers' },
  { id: 'leagues', icon: '🏆', title: 'Leagues' },
  // 🏅, а не 🎖: второй — редкий глиф (U+1F396), его нет в шрифтах части
  // систем, и вкладка рисовалась пустым кружком. Поймано `npm run shot`.
  { id: 'rewards', icon: '🏅', title: 'Rewards' },
  { id: 'shop',    icon: '🛒', title: 'Shop' },
]

// [F] На кадре красные точки-нотификации стоят у вкладок 3, 4, 6.
const DOTS = [false, false, true, true, false, true]

export class BottomNav extends Phaser.GameObjects.Container {
  constructor(scene, y, width, onSelect) {
    super(scene, 0, y)
    this.active = 0

    panel(scene, 0, y, width, NAV_H, { fill: PAL.chrome, radius: 0 })
    const line = scene.add.graphics()
    line.lineStyle(1, PAL.line, 1)
    line.lineBetween(0, y, width, y)

    // Иконки чуть выше геометрического центра: снизу у телефона жест-бар,
    // и ряд, посаженный ровно по центру, визуально прижат к краю экрана.
    const cy = y + NAV_H / 2 - 5
    this.items = TABS.map((tab, i) => {
      const cx = (width / TABS.length) * (i + 0.5)
      const glow = scene.add.circle(cx, cy, 23, PAL.panel, 1).setVisible(i === 0)
      const icon = scene.add.text(cx, cy, tab.icon, { fontFamily: FONT, fontSize: '24px' }).setOrigin(0.5)
      icon.setAlpha(i === 0 ? 1 : 0.5)
      const dot = scene.add.circle(cx + 17, cy - 16, 5, PAL.red).setVisible(DOTS[i])
      // Замок поверх иконки закрытой вкладки. Именно значок, а не просто
      // блёклая иконка: блёклая читается как «неактивна сейчас», и игрок жмёт
      // её снова и снова, не понимая, почему ничего не происходит.
      const lock = scene.add.text(cx + 1, cy + 2, '🔒', { fontFamily: FONT, fontSize: '15px' })
        .setOrigin(0.5).setVisible(false)
      const zone = scene.add.zone(cx, cy, width / TABS.length, NAV_H - 6).setInteractive()
      zone.on('pointerdown', () => onSelect(i, tab))
      return { glow, icon, zone, dot, lock }
    })
    scene.add.existing(this)
  }

  // Ворота вкладок. Шесть вкладок сразу на чистом старте — это двадцать пять
  // экранов, ни один из которых не объясняет, зачем он: главная причина, по
  // которой игра читается как «непонятно, что делать». Открываем по одной.
  setLocked(index, on) {
    const it = this.items[index]
    if (!it) return
    it.lock.setVisible(on)
    it.icon.setAlpha(on ? 0.22 : (this.active === index ? 1 : 0.5))
    if (on) it.dot.setVisible(false)
  }

  // Точка на вкладке наград не декоративная: она гаснет, когда забирать
  // нечего. Остальные остаются как на кадре [F] — ими пока нечем управлять.
  setDot(index, on) {
    const it = this.items[index]
    // На закрытой вкладке точка — приглашение нажать туда, где нельзя.
    it?.dot.setVisible(on && !it.lock.visible)
  }

  setActive(index) {
    this.active = index
    this.items.forEach((it, i) => {
      it.glow.setVisible(i === index)
      // Замок сильнее подсветки активной: иначе setActive возвращал бы полную
      // непрозрачность иконке, которую мы только что пригасили воротами.
      it.icon.setAlpha(it.lock.visible ? 0.22 : i === index ? 1 : 0.5)
    })
  }
}
