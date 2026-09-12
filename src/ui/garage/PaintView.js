import Phaser from 'phaser'
import { PAL, CSS, RACER_COLORS } from '../../config/palette.js'
import { PAINTS, DECALS } from '../../config/garage.js'
import { SP } from '../../config/layout.js'
import { label, Button } from '../widgets.js'
import { fitText, columns, vcenter } from '../layout.js'
import { formatMoney } from '../../utils/format.js'
import { card } from './cardBg.js'
import { drawCarPreview, PREVIEW } from './CarPreview.js'

const HEAD_H = 38
const COLS = 2
const SWATCH = 18
const CELL_H = SP.md + SWATCH + SP.sm + 26 + SP.sm   // поле + образец + кнопка
const CAP_H = 18
const PREVIEW_H = SP.md * 2 + PREVIEW.h + CAP_H

// Косметика. Единственный сток в игре, который НЕ даёт силы, и он нужен именно
// поэтому: поздние деньги больше некуда девать (см. config/garage.js). Цена — в
// секундах дохода (правило 24), поэтому к поздней игре она не обнуляется.
//
// Превью рисует тот же CarPainter, что и трасса: вторая отрисовка кузова
// означала бы, что в гараже игрок выбирает один цвет, а на карте видит другой.
export class PaintView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.caption = label(scene, w / 2, 0, '', { size: 11, color: CSS.muted, align: 'center' })
    this.add([this.bg, this.caption])

    this.cols = columns(SP.lg, w - SP.lg * 2, COLS, SP.sm)
    this.paintHead = label(scene, SP.lg, 0, 'PAINTS', { size: 13, bold: true })
    this.decalHead = label(scene, SP.lg, 0, 'DECALS', { size: 13, bold: true })
    this.add([this.paintHead, this.decalHead])

    this.paints = this.buildCells(scene, PAINTS, (def) => this.pickPaint(def))
    this.decals = this.buildCells(scene, DECALS, (def) => this.pickDecal(def))

    this.boxH = 0
    scene.add.existing(this)
  }

  // Плитка: образец цвета, имя, кнопка на всю ширину колонки. Ширина кнопки
  // берётся из columns() в КОНСТРУКТОРЕ: hit-area ставится там же (правило 10).
  buildCells(scene, defs, onPress) {
    return defs.map((def) => {
      const cw = this.cols[0].w
      const name = label(scene, 0, 0, def.name, { size: 12, bold: true })
      const btn = new Button(scene, 0, 0, cw - SP.sm, 26, '', { size: 11 })
      btn.on('press', () => onPress(def))
      this.add([name, btn])
      return { def, name, btn }
    })
  }

  get classId() { return this.state.activeClass }

  // Выбранное лежит в garage.paint / garage.decal по классу; пусто — значит
  // стоит первая позиция списка (она же бесплатная).
  selected(kind) {
    const map = kind === 'paint' ? this.state.garage.paint : this.state.garage.decal
    const defs = kind === 'paint' ? PAINTS : DECALS
    return map[this.classId] ?? defs[0].id
  }

  owned(kind, id) {
    const list = kind === 'paint' ? this.state.garage.paintsOwned : this.state.garage.decalsOwned
    return list.includes(id)
  }

  pickPaint(def) {
    if (!this.owned('paint', def.id)) {
      if (!this.state.buyPaintFor(def.id)) { this.toast?.('Not enough cash', PAL.red); return }
      this.toast?.(`${def.name} unlocked`, PAL.gold)
    }
    this.state.setPaint(def.id)
    this.onChange?.()
  }

  pickDecal(def) {
    if (!this.owned('decal', def.id)) {
      if (!this.state.buyDecalFor(def.id)) { this.toast?.('Not enough cash', PAL.red); return }
      this.toast?.(`${def.name} unlocked`, PAL.gold)
    }
    this.state.setDecal(def.id)
    this.onChange?.()
  }

  // Ряд плиток одной группы. Возвращает нижнюю кромку группы.
  placeCells(cells, kind, top) {
    const rows = Math.ceil(cells.length / COLS)
    const bottom = card(this.bg, top, this.boxW, HEAD_H + rows * CELL_H + SP.sm)

    cells.forEach((cell, i) => {
      const col = this.cols[i % COLS]
      const cy = top + HEAD_H + Math.floor(i / COLS) * CELL_H
      const owned = this.owned(kind, cell.def.id)
      const active = this.selected(kind) === cell.def.id

      // Образец: у краски это её цвет, у декали — полоса поверх текущей краски,
      // иначе тринадцать плиток выглядят одинаково пустыми.
      const sx = col.x + SP.sm, sy = cy + SP.md
      this.bg.fillStyle(kind === 'paint' ? (cell.def.color ?? this.teamColor) : this.bodyColor, 1)
      this.bg.fillRoundedRect(sx, sy, SWATCH, SWATCH, 5)
      if (kind === 'decal' && cell.def.id !== DECALS[0].id) {
        this.bg.fillStyle(PAL.onDark, 0.85)
        this.bg.fillRect(sx, sy + SWATCH / 2 - 2, SWATCH, 4)
      }
      this.bg.lineStyle(active ? 2 : 1, active ? PAL.accent : PAL.line, 1)
      this.bg.strokeRoundedRect(sx, sy, SWATCH, SWATCH, 5)

      cell.name.setX(sx + SWATCH + SP.sm).setText(cell.def.name).setFontSize(12)
      fitText(cell.name, col.w - SWATCH - SP.sm * 3)
      vcenter(cell.name, sy, SWATCH)
      cell.btn.setPosition(col.cx, sy + SWATCH + SP.sm + 13)
      const price = this.state.paintPrice(cell.def)
      cell.btn.setText(active ? 'Selected' : owned ? 'Select' : formatMoney(price))
      cell.btn.setFill(active ? PAL.line : owned ? PAL.accent : PAL.green)
      cell.btn.setEnabled(!active && (owned || this.state.cash >= price))
      fitText(cell.btn.txt.setFontSize(11), col.w - SP.md)
    })

    return bottom
  }

  refresh() {
    this.bg.clear()
    // Цвет команды — это цвет игрока на карте: `Team Colors` не красит кузов,
    // а оставляет тот, с которым машина выходит на трассу.
    this.teamColor = RACER_COLORS[0]
    this.bodyColor = this.state.paintColor ?? this.teamColor

    card(this.bg, 0, this.boxW, PREVIEW_H)
    const decalId = this.selected('decal')
    drawCarPreview(this.bg, this.boxW / 2, SP.md + PREVIEW.h / 2, this.bodyColor, decalId)

    const paintDef = PAINTS.find((p) => p.id === this.selected('paint')) ?? PAINTS[0]
    const decalDef = DECALS.find((d) => d.id === decalId) ?? DECALS[0]
    this.caption.setPosition(this.boxW / 2, PREVIEW_H - CAP_H)
      .setText(`${this.state.car?.name ?? 'No car'}  ·  ${paintDef.name}  ·  ${decalDef.name}`)
    fitText(this.caption.setFontSize(11), this.boxW - SP.lg * 2)

    let y = PREVIEW_H + SP.md
    this.paintHead.setPosition(SP.lg, y + 13)
    y = this.placeCells(this.paints, 'paint', y) + SP.md
    this.decalHead.setPosition(SP.lg, y + 13)
    y = this.placeCells(this.decals, 'decal', y)

    this.boxH = y + SP.md
  }
}
