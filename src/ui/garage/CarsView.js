import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CAR_STARS, TOP_CAR_USD } from '../../config/garage.js'
import { SP } from '../../config/layout.js'
import { label, Button } from '../widgets.js'
import { fitText, fitWrapped, vcenter } from '../layout.js'
import { formatMoney, formatGain } from '../../utils/format.js'
import { card } from './cardBg.js'

// Геометрия карточки выведена из содержимого, а не подобрана: имя (16) +
// описание в две строки (30) + строка статов (18) + ряд звёзд (16) + поля.
const NAME_H = 18
const DESC_H = 30
const STAT_H = 18
const STAR_R = 3.5
const CARD_H = SP.md + NAME_H + DESC_H + STAT_H + STAR_R * 2 + SP.md * 2
const BTN_W = 104
const BTN_H = 32
const FOOT_H = 34

// `$9.99` витриной, а не ценником: долларовое показано и не продаётся
// (правило 26a). Единственный путь к легендарной машине — Lucky Draw (шаг 9).
const DRAW_NOTE = 'Top cars are sold for real money in the original — '
  + 'here they only come from Lucky Draw.'

// Машины активного класса: четыре штуки, по одной на ступень разблокировки
// (free / gems / gems / draw [E]). Карточка показывает РАСКЛАД, а не одну
// «силу»: tilt машины — единственный перекос off/def, который игрок может
// поменять бесплатно, поэтому ⚔ и 🛡 стоят раздельно (см. config/garage.js).
export class CarsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.add(this.bg)

    const rows = state.carsOfClass()
    this.cards = rows.map((row, i) => {
      const name = label(scene, SP.lg, 0, row.def.name, { size: 15, bold: true })
      const desc = label(scene, SP.lg, 0, row.def.desc, { size: 10, color: CSS.muted })
      fitWrapped(desc, w - BTN_W - SP.lg * 3, DESC_H)
      const stats = label(scene, SP.lg, 0, '', { size: 12, bold: true })
      const level = label(scene, w - SP.lg, 0, '', { size: 10, color: CSS.muted, align: 'right' })
      const btn = new Button(scene, 0, 0, BTN_W, BTN_H, '', { size: 12 })
      const usd = label(scene, 0, 0, '', { size: 11, bold: true, color: CSS.gold, align: 'center' })
      btn.on('press', () => this.act(i))
      this.add([name, desc, stats, level, btn, usd])
      return { name, desc, stats, level, btn, usd }
    })

    this.note = label(scene, SP.lg, 0, DRAW_NOTE, { size: 10, color: CSS.dim })
    this.note.setWordWrapWidth(w - SP.lg * 2)
    this.upgrade = new Button(scene, w / 2, 0, w - SP.lg * 2, 40, 'Upgrade', { size: 14, chip: true })
    this.upgrade.on('press', () => this.doUpgrade())
    this.add([this.note, this.upgrade])

    this.boxH = 0
    scene.add.existing(this)
  }

  get rows() { return this.state.carsOfClass() }

  act(index) {
    const row = this.rows[index]
    if (!row || row.active) return
    if (row.owned) {
      this.state.pickCar(row.def.id)
      this.toast?.(`${row.def.name} selected`, PAL.accent)
    } else if (row.def.unlock === 'gems') {
      if (!this.state.buyCar(row.def.id)) { this.toast?.('Not enough Gems', PAL.red); return }
      this.toast?.(`${row.def.name} unlocked`, PAL.gold)
    } else return
    this.onChange?.()
  }

  doUpgrade() {
    if (!this.state.upgradeActiveCar()) { this.toast?.('Not enough cash', PAL.red); return }
    this.toast?.(`${this.state.car.name} · Lv. up`, PAL.green)
    this.onChange?.()
  }

  // Подпись и доступность правой кнопки — это три типа разблокировки [E] плюс
  // «уже стоит». Подпись собирается здесь, чтобы refresh() оставался раскладкой.
  buttonFor(row) {
    if (row.active) return { text: 'Equipped', fill: PAL.line, enabled: false }
    if (row.owned) return { text: 'Select', fill: PAL.accent, enabled: true }
    if (row.def.unlock === 'gems') {
      return { text: `${row.def.gems} 💎`, fill: PAL.cyan, enabled: this.state.gems >= row.def.gems }
    }
    return { text: 'Lucky Draw', fill: PAL.line, enabled: false }
  }

  refresh() {
    const rows = this.rows
    let y = 0
    this.bg.clear()

    rows.forEach((row, i) => {
      const c = this.cards[i]
      // Активная машина обведена акцентом: какая из четырёх едет — главное, что
      // с этого экрана читается, и текстом «Equipped» на кнопке это не видно
      // при скролле.
      card(this.bg, y, this.boxW, CARD_H,
        row.active ? { stroke: PAL.accent, width: 2 } : {})

      c.name.setPosition(SP.lg, y + SP.md)
      fitText(c.name.setFontSize(15), this.boxW - BTN_W - SP.lg * 3)
      c.desc.setPosition(SP.lg, y + SP.md + NAME_H)
      c.desc.setAlpha(row.owned ? 1 : 0.7)

      const statY = y + SP.md + NAME_H + DESC_H
      // Закрытая машина статов не показывает: carsOfClass() отдаёт ей нули
      // (carStats обнуляет неоткрытую), а посчитать их тут значило бы вторую
      // копию формулы в UI. Прочерк честнее нуля.
      c.stats.setPosition(SP.lg, statY)
        .setText(row.owned
          ? `⚔ ${formatGain(row.stats.off)}   🛡 ${formatGain(row.stats.def)}`
          : '⚔ —   🛡 —')
        .setColor(row.owned ? CSS.text : CSS.dim)
      c.level.setX(this.boxW - SP.lg)
        .setText(`Lv. ${row.st.level} / ${row.def.maxLevel}`)
      vcenter(c.level, statY, STAT_H)

      // Ряд звёзд — пипсы в общий graphics: пять текстовых «★» на карточку
      // стоили бы двадцать объектов на экран, где виден один ряд.
      const pipY = statY + STAT_H + STAR_R + 2
      for (let s = 0; s < CAR_STARS.max; s++) {
        this.bg.fillStyle(s < row.st.stars ? PAL.gold : PAL.line, 1)
        this.bg.fillCircle(SP.lg + STAR_R + s * (STAR_R * 2 + SP.xs), pipY, STAR_R)
      }

      const btn = this.buttonFor(row)
      const legend = !row.owned && row.def.unlock === 'draw'
      c.btn.setPosition(this.boxW - SP.lg - BTN_W / 2, y + SP.md + BTN_H / 2)
      c.btn.setText(btn.text)
      c.btn.setFill(btn.fill)
      c.btn.setEnabled(btn.enabled)
      fitText(c.btn.txt.setFontSize(12), BTN_W - SP.md)
      c.usd.setPosition(this.boxW - SP.lg - BTN_W / 2, y + SP.md + BTN_H + SP.xs)
        .setText(legend ? `$${TOP_CAR_USD.toFixed(2)}` : '')
      y += CARD_H + SP.md
    })

    // Сноска про долларовую витрину — одна на список, под карточками: в строке
    // карточки она не помещается ни в какой кегль, а обрезанная читалась бы как
    // сломанная вёрстка (правило 26d про ту же ловушку в магазине).
    this.note.setPosition(SP.lg, y)
    y += this.note.height + SP.md

    const active = rows.find((r) => r.active)
    const maxed = !active || active.nextSeconds === null
    const price = maxed ? 0 : active.nextSeconds * this.state.incomePerSec
    this.upgrade.setPosition(this.boxW / 2, y + 20)
    this.upgrade.setText(maxed ? 'Max Level' : 'Upgrade')
    this.upgrade.setChip(maxed ? '' : formatMoney(price))
    this.upgrade.setFill(maxed ? PAL.line : PAL.green)
    this.upgrade.setEnabled(!maxed && this.state.cash >= price)
    this.boxH = y + 40 + FOOT_H
  }
}
