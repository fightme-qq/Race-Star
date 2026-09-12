import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { RARITY_BY_ID, STARS } from '../../config/drivers.js'
import { CORES } from '../../config/extras.js'
import { effStats, statBonus, ratingOf, nameOf, xpToNext } from '../../systems/DriverSystem.js'
import { coreSteps } from '../../systems/ExtrasSystem.js'
import { label, Button } from '../widgets.js'

export const DCARD_H = 64
// Полоса Unique Cores. Пристёгнута к карточке, а не вынесена в панель действий
// внизу списка: действие относится к ОДНОМУ драйверу (апгрейд уникального), и
// пятая кнопка в ряду из четырёх ужала бы подписи до нечитаемых 8px.
export const CORE_H = 34

const fmt = (v) => (Math.round(v * 10) / 10).toFixed(v % 1 ? 1 : 0)

// Карточка драйвера один в один с оригиналом: рейтинг в круге (цвет =
// редкость), ⚔ Offense и 🛡 Defense с приростом в скобках, Lv. N и полоса XP.
// Третьего стата на карточке в оригинале нет — не выдумываем.
export class DriverCard extends Phaser.GameObjects.Container {
  constructor(scene, driver, x, y, w, { onTap = null, badge = '', onCore = null } = {}) {
    super(scene, x, y)
    this.driver = driver
    this.boxW = w
    this.selected = false
    // Ядра показываются только у Unique [E] «Get more unique drivers to
    // upgrade» — у остальных редкостей этого апгрейда не существует.
    this.hasCore = !!onCore && driver.rarity === 'unique'
    this.boxH = DCARD_H + (this.hasCore ? CORE_H : 0)

    this.bg = scene.add.graphics()
    this.ring = scene.add.graphics()
    this.rating = label(scene, 30, 24, '', { size: 15, bold: true, align: 'center' })
    this.nameText = label(scene, 58, 8, '', { size: 13, bold: true })
    this.sub = label(scene, 58, 26, '', { size: 10, color: CSS.muted })
    this.xpBar = scene.add.graphics()
    this.xpText = label(scene, 58, 42, '', { size: 9, color: CSS.dim })
    this.offText = label(scene, w - 12, 9, '', { size: 11, align: 'right' })
    this.defText = label(scene, w - 12, 27, '', { size: 11, align: 'right' })
    this.badge = label(scene, w - 12, 45, badge, { size: 9, color: CSS.accent, align: 'right' })

    this.add([this.bg, this.ring, this.rating, this.nameText, this.sub,
      this.xpBar, this.xpText, this.offText, this.defText, this.badge])

    if (this.hasCore) {
      this.coreInfo = label(scene, 12, DCARD_H + 10, '', { size: 10, bold: true, color: CSS.purple })
      this.coreBtn = new Button(scene, w - 76, DCARD_H + CORE_H / 2, 136, 24, '', { size: 11, fill: PAL.purple })
      this.coreBtn.on('press', () => onCore(this.driver))
      this.add([this.coreInfo, this.coreBtn])
    }

    if (onTap) {
      // Точка нормализуется на displayOrigin контейнера (см. widgets.js), а
      // карточка нарисована от 0,0 — поэтому зону сдвигаем на полразмера.
      this.setSize(w, DCARD_H)
      this.setInteractive(
        new Phaser.Geom.Rectangle(w / 2, DCARD_H / 2, w, DCARD_H), Phaser.Geom.Rectangle.Contains)
      // Тот же порог, что у Button: список скроллится, и без него протяжка
      // выбирала бы карточку, за которую тянут.
      let downAt = null
      this.on('pointerdown', (p) => { downAt = { x: p.x, y: p.y } })
      this.on('pointerup', (p) => {
        if (!downAt) return
        const moved = Phaser.Math.Distance.Between(downAt.x, downAt.y, p.x, p.y)
        downAt = null
        if (moved <= 12) onTap(this.driver)
      })
    }

    this.refresh()
    scene.add.existing(this)
  }

  setSelected(on) {
    if (this.selected === on) return
    this.selected = on
    this.refresh()
  }

  refresh() {
    const d = this.driver
    const r = RARITY_BY_ID[d.rarity]
    const e = effStats(d)
    const b = statBonus(d)

    this.bg.clear()
    this.bg.fillStyle(PAL.panelAlt, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 10)
    this.bg.lineStyle(this.selected ? 2 : 1, this.selected ? PAL.accent : PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 10)
    if (this.hasCore) {
      // Разделитель: полоса ядер — отдельное действие, и без линии она читается
      // как продолжение строки XP.
      this.bg.lineStyle(1, PAL.line, 1)
      this.bg.lineBetween(10, DCARD_H, this.boxW - 10, DCARD_H)
      this.coreInfo.setText(`⬣ Unique Core  ${coreSteps(d)} / ${CORES.maxSteps}`)
    }

    // [F] Круг рейтинга окрашен по редкости. На светлой теме прежняя заливка
    // с полупрозрачным фоном давала одинаковый серый у всех редкостей —
    // кольцо цветное, середина белая, число цветом редкости.
    this.ring.clear()
    this.ring.fillStyle(r.color, 1)
    this.ring.fillCircle(30, 32, 18)
    this.ring.fillStyle(PAL.panel, 1)
    this.ring.fillCircle(30, 32, 14)
    this.rating.setText(String(ratingOf(d)))
    this.rating.setColor('#' + r.color.toString(16).padStart(6, '0'))

    this.nameText.setText(nameOf(d))
    const stars = d.stars ? '  ' + '★'.repeat(Math.min(d.stars, STARS.max)) : ''
    this.sub.setText(`${r.name}${stars}   Lv. ${d.level + 1}${d.level ? ` (+${d.level})` : ''}`)

    const need = xpToNext(d.level)
    this.xpText.setText(`${Math.round(d.xp)} / ${need} XP`)
    this.xpBar.clear()
    this.xpBar.fillStyle(PAL.line, 1)
    this.xpBar.fillRoundedRect(120, 45, 90, 5, 2.5)
    const ratio = Phaser.Math.Clamp(d.xp / need, 0, 1)
    if (ratio > 0.02) {
      this.xpBar.fillStyle(PAL.cyan, 1)
      this.xpBar.fillRoundedRect(120, 45, Math.max(5, 90 * ratio), 5, 2.5)
    }

    this.offText.setText(`⚔ ${Math.round(e.off)}` + (b.off ? ` (+${fmt(b.off)})` : ''))
    this.defText.setText(`🛡 ${Math.round(e.def)}` + (b.def ? ` (+${fmt(b.def)})` : ''))
  }
}
