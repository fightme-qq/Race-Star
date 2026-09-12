import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { CLASS_BY_ID } from '../../config/classes.js'
import { panel, label, Button, dimmer } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { fitText } from '../layout.js'
import { LeagueHeader } from './LeagueHeader.js'
import { StandingsTable } from './StandingsTable.js'
import { SeasonHistory } from './SeasonHistory.js'
import { LeagueLadder } from './LeagueLadder.js'
import { ArenaView } from '../compete/ArenaView.js'
import { BracketView } from '../compete/BracketView.js'
import { ClubView } from '../compete/ClubView.js'

const GAP = 12

const TABS = ['LEAGUE', 'ARENA', 'TOURNEY', 'CUP', 'CLUB']

// Вкладка 4 нижнего меню. Кадра оригинала у этого экрана нет ни одного (см.
// FINDINGS: вкладок 2, 4, 5, 6 нет на всех 42 просмотренных), поэтому логика
// восстановлена из локализации билда, а композиция наша — в визуальном языке,
// заданном шагом 1: белые карточки на светлом фоне, синий акцент.
//
// Шаг 8 добавил сюда соревнования, а не отдельный экран: лига трассы, арена,
// турниры, кубок и клубы — все пять меряют ОДНУ силу команды, и разнеси их по
// вкладкам меню, игрок сравнивал бы их, переключая экраны.
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
    this.title = label(scene, width / 2, by + 14, '', { size: 20, bold: true, align: 'center' })
    const x = new Button(scene, bx + bw - 34, by + 26, 40, 40, '✕',
      { fill: PAL.panelAlt, color: CSS.muted, size: 18, radius: 20 })
    x.on('press', () => this.close())
    this.add([dim, sheet, this.title, x])

    const tw = (bw - 24) / TABS.length
    this.tabs = TABS.map((text, i) => {
      const btn = new Button(scene, bx + 12 + tw * (i + 0.5), by + 62, tw - 5, 30, text, { size: 11 })
      fitText(btn.txt, tw - 14)
      btn.on('press', () => this.setTab(i))
      this.add(btn)
      return btn
    })

    this.scroll = new ScrollView(scene, bx + 6, by + 84, bw - 12, bh - 96, { fade: PAL.bg })
    this.add(this.scroll)
    this.cw = bw - 24

    this.setTab(0)
    scene.add.existing(this)
  }

  // Блоки вкладки. Пересобираются целиком, а не прячутся: у арены таблица на
  // десять строк, у клубов — доска на восемь позиций, и держать все пять наборов
  // живыми означало бы пять экранов объектов там, где виден один (та же причина,
  // что у вкладок наград).
  buildTab(index) {
    const s = this.scene
    const id = this.classId
    const w = this.cw
    const opts = { toast: this.toast, onChange: () => { this.onChange?.(); this.refresh() } }
    if (index === 1) return [new ArenaView(s, this.state, w, opts)]
    if (index === 2) {
      return [new BracketView(s, this.state, w, 'league', opts),
        new BracketView(s, this.state, w, 'weekly', opts)]
    }
    if (index === 3) return [new BracketView(s, this.state, w, 'cup', opts)]
    if (index === 4) return [new ClubView(s, this.state, w, opts)]
    // `header` и `standings` — ручки для smoke: он тапает по `Advance` и считает
    // строки таблицы, то есть имена полей часть контракта, а не деталь.
    this.header = new LeagueHeader(s, this.state, id, w, { onAdvance: () => this.advance() })
    this.standings = new StandingsTable(s, this.state, id, w)
    return [this.header, this.standings,
      new SeasonHistory(s, this.state, id, w), new LeagueLadder(s, this.state, id, w)]
  }

  titleText(index) {
    if (index === 1) return 'Champions Arena'
    if (index === 2) return 'Tournaments'
    // Имя кубка зависит от ступени и класса — его показывает сам блок, в шапке
    // окна стояла бы вторая копия той же строки.
    if (index === 3) return 'Cup'
    if (index === 4) return 'Clubs'
    return CLASS_BY_ID[this.classId].name + ' League'
  }

  setTab(index) {
    this.tab = index
    this.header = null
    this.standings = null
    this.tabs.forEach((b, i) => b.setFill(i === index ? PAL.accent : PAL.panelAlt))
    this.scroll.clearContent()
    fitText(this.title.setText(this.titleText(index)).setFontSize(20), this.cw - 80)
    this.blocks = this.buildTab(index)
    // Правило 13: содержимое позиционируется от угла списка, а не экрана.
    for (const b of this.blocks) this.scroll.inner.add(b)
    this.refresh()
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
  // гонки идут и под модалкой. На вкладках соревнований высота дышит ещё
  // сильнее: сетка турнира то показывает соперника, то итоговое место.
  refresh() {
    let y = 0
    for (const b of this.blocks) {
      if (!b.active) continue
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
