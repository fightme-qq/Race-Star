import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CLASS_BY_ID } from '../../config/classes.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { LeagueHeader } from './LeagueHeader.js'
import { StandingsTable } from './StandingsTable.js'
import { SeasonHistory } from './SeasonHistory.js'
import { LeagueLadder } from './LeagueLadder.js'

const GAP = 12

// Вкладка 4 нижнего меню. Кадра оригинала у этого экрана нет ни одного (см.
// FINDINGS: вкладок 2, 4, 5, 6 нет на всех 42 просмотренных), поэтому логика
// восстановлена из локализации билда, а композиция наша — в визуальном языке,
// заданном шагом 1: белые карточки на светлом фоне, синий акцент.
export class LeaguesModal extends Phaser.GameObjects.Container {
  constructor(scene, state, { onClose, onChange, toast, classId }) {
    super(scene, 0, 0)
    this.state = state
    // Экран параметризован классом: `Details` на карточке чужого класса должен
    // показывать его лигу, а не лигу активного — сезон у каждого класса свой [F].
    this.classId = classId || state.activeClass
    this.onClose = onClose
    this.onChange = onChange
    this.toast = toast
    this.setDepth(100)

    const { width, height } = scene.scale
    const dim = dimmer(scene, width, height, () => this.close())

    const bx = 10, by = 96, bw = width - 20, bh = height - 170
    const sheet = panel(scene, bx, by, bw, bh, { fill: PAL.bg, radius: 18 })
    const title = label(scene, width / 2, by + 18, CLASS_BY_ID[this.classId].name + ' League',
      { size: 22, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 30, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.add([dim, sheet, title, x])

    this.scroll = new ScrollView(scene, bx + 6, by + 60, bw - 12, bh - 72)
    const cw = bw - 24

    const id = this.classId
    this.header = new LeagueHeader(scene, state, id, cw, { onAdvance: () => this.advance() })
    this.standings = new StandingsTable(scene, state, id, cw)
    this.history = new SeasonHistory(scene, state, id, cw)
    this.ladder = new LeagueLadder(scene, state, id, cw)
    this.blocks = [this.header, this.standings, this.history, this.ladder]

    for (const b of this.blocks) this.scroll.inner.add(b)
    this.add(this.scroll)

    this.refresh()
    scene.add.existing(this)
  }

  advance() {
    const id = this.classId
    if (!this.state.canAdvance(id)) {
      this.toast?.(`Win the season to advance · ${this.state.seasonTarget} pts needed`, PAL.muted)
      return
    }
    this.state.advanceLeague(id)
    this.onChange?.()
    this.toast?.('Promoted! ' + this.state.leagueOf(id).name, PAL.gold)
    this.refresh()
  }

  // Раскладка пересчитывается после каждого refresh: блок истории меняет
  // высоту, когда закрывается сезон, а закрыться он может при открытом окне —
  // гонки идут и под модалкой.
  refresh() {
    let y = 0
    for (const b of this.blocks) {
      b.refresh()
      b.setPosition(6, y)
      y += b.boxH + GAP
    }
    this.scroll.setContentHeight(y - GAP)
  }

  close() {
    this.onClose?.()
    this.destroy(true)
  }
}
