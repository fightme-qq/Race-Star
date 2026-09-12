import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SP, R } from '../../config/layout.js'
import { label, Button } from '../widgets.js'
import { drawUpgradeIcon } from '../UpgradeIcon.js'
import { fitText } from '../layout.js'
import { itemLine, rarityOf, shardText, SIDE_ICON_KEY } from './gearText.js'

export const SLOT_ROW_H = 52

const PAD = SP.md
const CLR = 24                 // диаметр кружка ✕
const UP_W = 84                // кнопка апгрейда: ширина под `⬢ 128`
const ICON_R = 12              // радиус векторной иконки стороны (UpgradeIcon)
const TXT_X = PAD + ICON_R * 2 + SP.sm

// Строка слота: иконка стороны, имя слота, надетый предмет, ✕ и апгрейд.
// Своя графика у каждой строки, а не общий лист вида: обводка красится по
// редкости надетого, и рисовать десять разных рамок одним графиксом пришлось бы
// заново при каждом refresh (пять раз в секунду).
export class SlotRow extends Phaser.GameObjects.Container {
  constructor(scene, w, { onTap, onUnequip, onUpgrade }) {
    super(scene, 0, 0)
    this.boxW = w
    this.slot = 0

    this.bg = scene.add.graphics()
    this.nameTxt = label(scene, TXT_X, 8, '', { size: 13, bold: true })
    this.subTxt = label(scene, TXT_X, 28, '', { size: 10, color: CSS.muted })
    this.up = new Button(scene, w - PAD - CLR - SP.sm - UP_W / 2, SLOT_ROW_H / 2, UP_W, 28, '', { size: 11 })
    this.clr = new Button(scene, w - PAD - CLR / 2, SLOT_ROW_H / 2, CLR, CLR, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 12, radius: CLR / 2 })
    this.up.on('press', () => onUpgrade?.(this.slot))
    this.clr.on('press', () => onUnequip?.(this.slot))
    this.add([this.bg, this.nameTxt, this.subTxt, this.up, this.clr])

    // Зона тапа НЕ доходит до кнопок. Два интерактивных объекта друг на друге —
    // это та же грабля, что Zone с topOnly (правило 5): отпускание достаётся
    // одному из них, и какому — зависит от порядка в списке детей.
    this.tapW = w - PAD - CLR - SP.sm - UP_W - SP.sm
    this.setSize(w, SLOT_ROW_H)
    // Hit-area от левого верхнего угла: содержимое нарисовано от 0,0, значит
    // прямоугольник сдвинут на displayOrigin (правило 10).
    this.setInteractive(new Phaser.Geom.Rectangle(w / 2, SLOT_ROW_H / 2, this.tapW, SLOT_ROW_H),
      Phaser.Geom.Rectangle.Contains)
    // Порог 12px, как у Button: список скроллится, и без него протяжка
    // переодевала бы слот, за который тянут (правило 4).
    let downAt = null
    this.on('pointerdown', (p) => { downAt = { x: p.x, y: p.y } })
    this.on('pointerout', () => { downAt = null })
    this.on('pointerup', (p) => {
      if (!downAt) return
      const moved = Phaser.Math.Distance.Between(downAt.x, downAt.y, p.x, p.y)
      downAt = null
      if (moved <= 12) onTap?.(this.slot)
    })

    scene.add.existing(this)
  }

  // row — строка из state.gearRows(); cost — state.gear.upgradeCost(item) или
  // null у максимального уровня; racesLeft — сколько заездов до открытия слота.
  place(y, row, { cost, affordable, racesLeft }) {
    this.slot = row.slot
    this.setPosition(0, y)
    const it = row.item
    const r = it ? rarityOf(it) : null

    this.bg.clear()
    this.bg.fillStyle(row.open ? PAL.panel : PAL.panelAlt, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, SLOT_ROW_H, R.md)
    this.bg.lineStyle(it ? 2 : 1, it ? r.color : PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, SLOT_ROW_H, R.md)

    // Иконка стороны идёт в ту же графику, что и лист строки: у закрытого слота
    // её нет — цветной значок на выключенной строке спорит с серым текстом.
    if (row.open) drawUpgradeIcon(this.bg, SIDE_ICON_KEY[row.side] ?? SIDE_ICON_KEY.off,
      PAD + ICON_R, SLOT_ROW_H / 2)

    this.nameTxt.setColor(row.open ? CSS.text : CSS.dim)
    fitText(this.nameTxt.setFontSize(13).setText(row.name), this.textW(row))

    if (!row.open) {
      // [E] `Slot not available` + `Play {0} races to unlock`: обе строки есть в
      // билде, и вторая без остатка бесполезна — игрок не знает своего пробега.
      this.subTxt.setColor(CSS.dim)
      this.subTxt.setText(`Slot not available  ·  Play ${racesLeft} races to unlock`)
    } else if (it) {
      this.subTxt.setColor(CSS.muted)
      this.subTxt.setText(itemLine(it, row.value))
    } else {
      this.subTxt.setColor(CSS.dim)
      this.subTxt.setText('Empty  ·  tap to equip the best in bag')
    }
    fitText(this.subTxt.setFontSize(10), this.textW(row))

    this.clr.setVisible(!!it)
    this.up.setVisible(row.open && !!it)
    if (!it) return
    this.up.setText(cost ? shardText(cost) : 'MAX')
    this.up.setFill(cost && affordable ? PAL.accent : PAL.line)
    this.up.setEnabled(!!cost && affordable)
  }

  // Ширина под текст считается от того, какие кнопки в строке показаны:
  // у закрытого и пустого слота их нет, и подпись про разблокировку занимает
  // всю строку. Угаданная константа здесь означала бы текст под кнопкой — ровно
  // тот дефект, что правило 26d поймало в магазине.
  textW(row) {
    const right = row.open || row.item ? this.boxW - this.tapW : PAD
    return this.boxW - right - TXT_X
  }
}
