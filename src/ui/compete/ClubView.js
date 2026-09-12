import Phaser from 'phaser'
import { CSS } from '../../config/palette.js'
import { CLUB } from '../../config/compete.js'
import { label } from '../widgets.js'
import { fitWrapped } from '../layout.js'
import { ClubList } from './ClubList.js'
import { ClashBoard } from './ClashBoard.js'

const GAP = 12

// Клубы. Экран двухсостоянийный: пока клуба нет — список и кнопка создания, после
// вступления — доска Club Clash. Держать оба блока живыми нельзя: список
// собирается из clubRows по силе игрока, а доска — из позиций события, и
// переключаться они обязаны ПО ФАКТУ вступления, иначе игрок видит список клубов,
// уже состоя в одном.
export class ClubView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.boxH = 0
    this.opts = { toast, onChange: () => { onChange?.(); this.rebuild() } }

    this.note = label(scene, 14, 0, '', { size: 11, color: CSS.muted })
    this.add(this.note)
    this.block = null
    this.joined = null
    this.rebuild()
    scene.add.existing(this)
  }

  // Пересборка по смене состояния, а не каждый refresh: refresh зовётся пять раз
  // в секунду, и создавать в нём восемь кнопок заново значило бы терять нажатие.
  rebuild() {
    const joined = this.state.club.joined !== null
    if (this.block && joined === this.joined) return
    this.block?.destroy(true)
    this.joined = joined
    this.block = joined
      ? new ClashBoard(this.scene, this.state, this.boxW, this.opts)
      : new ClubList(this.scene, this.state, this.boxW, this.opts)
    this.add(this.block)
  }

  refresh() {
    this.rebuild()
    this.block.refresh()
    const y = this.block.boxH + GAP
    this.note.setY(y)
      .setText(this.joined
        ? `Each player receives ${CLUB.challengesPerDay} Challenges per day. `
          + `Capture a position with a best-of-3 series — empty positions are claimed instantly. `
          + `Occupied positions generate Club Points over time; a captured position stays `
          + `protected for ${Math.round(CLUB.protectionSec / 60)} minutes.`
        : `Clubs compete in Club Clash for Club Points. Joining needs Power Level; `
          + `creating your own Club costs ${CLUB.createGems} Gems.`)
    fitWrapped(this.note.setFontSize(11), this.boxW - 28, 90)
    this.boxH = y + this.note.height + 4
  }
}
