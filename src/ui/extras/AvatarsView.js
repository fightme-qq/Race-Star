import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { formatNum } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { sectionCard } from '../shop/ShopRow.js'

const HEADER_H = 76
const COLS = 3
const CELL_H = 122
const PAD = 10
const GAP = 8

// Подпись условия. Ключ `need` из конфига один на аватар, и он же называет поле
// в `state.vanityStats` — поэтому таблица подписей сходится с данными по ключу,
// а не по порядку.
const NEED_NAME = { races: 'races', wins: 'wins', league: 'league', albums: 'albums' }

// Аватары (`VanityItems` [D]). Чистая косметика: аватар стоит в шапке главного
// экрана (`state.avatarIcon`). Купить нельзя ни один — каждый открывается игрой,
// поэтому у закрытой ячейки показан ПРОГРЕСС, а не цена: иначе условие
// («500 races») читается как недостижимая заглушка.
export class AvatarsView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, 14, 12, 'Avatars', { size: 16, bold: true })
    this.count = label(scene, w - 14, 15, '', { size: 12, color: CSS.muted, align: 'right' })
    this.stats = label(scene, 14, 38, '', { size: 11, color: CSS.text })
    this.hint = label(scene, 14, 56, 'Avatar shows on the main screen', { size: 10, color: CSS.dim })
    this.add([this.bg, this.title, this.count, this.stats, this.hint])

    const cw = (w - PAD * 2 - GAP * (COLS - 1)) / COLS
    this.cells = state.avatars.map((row, i) => {
      const cx = PAD + (cw + GAP) * (i % COLS) + cw / 2
      const cell = {
        id: row.def.id,
        cx,
        cw,
        row: Math.floor(i / COLS),
        icon: label(scene, cx, 0, row.def.icon, { size: 30, align: 'center' }),
        name: label(scene, cx, 0, row.def.name, { size: 11, bold: true, align: 'center' }),
        need: label(scene, cx, 0, '', { size: 9, color: CSS.muted, align: 'center' }),
        btn: new Button(scene, cx, 0, cw - 16, 24, 'Select', { size: 11 }),
      }
      cell.btn.on('press', () => this.pick(cell.id))
      this.add([cell.icon, cell.name, cell.need, cell.btn])
      return cell
    })

    this.boxH = 0
    scene.add.existing(this)
  }

  pick(id) {
    if (!this.state.pickAvatar(id)) { this.toast?.('Locked — keep racing', PAL.muted); return }
    this.toast?.('Avatar selected', PAL.accent)
    this.onChange?.()
  }

  // `500 races` + `312 / 500` двумя строками: в колонке 98px одной строкой это
  // ужимается до нечитаемого кегля.
  needText(row, stats) {
    const need = row.def.need
    if (!need) return 'Starter'
    const [key, goal] = Object.entries(need)[0]
    const have = stats[key] ?? 0
    const caption = key === 'league' ? `League ${goal}` : `${formatNum(goal)} ${NEED_NAME[key]}`
    if (row.open) return '✓ ' + caption
    return `${caption}\n${formatNum(have)} / ${formatNum(goal)}`
  }

  refresh() {
    const s = this.state
    const rows = s.avatars
    const stats = s.vanityStats

    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, HEADER_H)
    this.count.setText(`${rows.filter((r) => r.open).length} / ${rows.length} unlocked`)
    fitText(this.stats.setFontSize(11).setText(
      `${formatNum(stats.races)} races  ·  ${formatNum(stats.wins)} wins  ·  ` +
      `League ${stats.league}  ·  ${stats.albums} albums`
    ), this.boxW - 28)

    const gridTop = HEADER_H + GAP
    const gridRows = Math.ceil(rows.length / COLS)
    const gridH = gridRows * CELL_H + (gridRows - 1) * GAP + PAD * 2
    sectionCard(this.bg, gridTop, this.boxW, gridH)

    rows.forEach((row, i) => {
      const cell = this.cells[i]
      const top = gridTop + PAD + cell.row * (CELL_H + GAP)
      const x = cell.cx - cell.cw / 2
      this.bg.fillStyle(row.active ? PAL.accent : PAL.panelAlt, row.active ? 0.12 : 1)
      this.bg.fillRoundedRect(x, top, cell.cw, CELL_H, 10)
      this.bg.lineStyle(row.active ? 2 : 1, row.active ? PAL.accent : PAL.line, 1)
      this.bg.strokeRoundedRect(x, top, cell.cw, CELL_H, 10)

      cell.icon.setPosition(cell.cx, top + 10).setAlpha(row.open ? 1 : 0.35)
      cell.name.setPosition(cell.cx, top + 52).setAlpha(row.open ? 1 : 0.55)
      fitText(cell.name.setFontSize(11), cell.cw - 8)
      cell.need.setPosition(cell.cx, top + 70).setText(this.needText(row, stats))
      cell.need.setColor(row.open ? CSS.greenDim : CSS.muted)
      fitText(cell.need.setFontSize(9), cell.cw - 6)

      cell.btn.setPosition(cell.cx, top + CELL_H - 18)
      cell.btn.setText(!row.open ? 'Locked' : row.active ? 'Selected' : 'Select')
      cell.btn.setFill(!row.open ? PAL.line : row.active ? PAL.green : PAL.accent)
      cell.btn.setEnabled(row.open && !row.active)
    })

    this.boxH = gridTop + gridH
  }
}
