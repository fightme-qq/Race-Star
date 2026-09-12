import Phaser from 'phaser'
import { ArenaHeader } from './ArenaHeader.js'
import { ArenaBoard } from './ArenaBoard.js'
import { ArenaRankings } from './ArenaRankings.js'

const GAP = 12

// Champions Arena целиком: шапка (лига, медали, ранг, тикеты), выбор соперника и
// таблица ранга с историей. Три блока вместо одного файла по той же причине, что
// у вкладки лиг: у каждого своя высота, и складывает их тот, кто знает порядок.
export class ArenaView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.boxH = 0

    this.blocks = [
      new ArenaHeader(scene, state, w),
      new ArenaBoard(scene, state, w, { toast, onChange }),
      new ArenaRankings(scene, state, w),
    ]
    this.add(this.blocks)
    scene.add.existing(this)
  }

  // Раскладка пересчитывается каждый refresh: таблица ранга и история меняют
  // высоту по ходу суток, а refresh вкладки зовётся пять раз в секунду — то есть
  // счётчик `Refills in` идёт живьём.
  refresh() {
    let y = 0
    for (const b of this.blocks) {
      b.refresh()
      b.setPosition(0, y)
      y += b.boxH + GAP
    }
    this.boxH = Math.max(0, y - GAP)
  }
}
