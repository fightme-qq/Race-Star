import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SQUAD_SIZE, RARITY_BY_ID } from '../../config/drivers.js'
import { ratingOf, canMerge, feedXpOf, nameOf } from '../../systems/DriverSystem.js'
import { formatMoney } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { ScrollView } from '../ScrollView.js'
import { DriverCard, DCARD_H } from './DriverCard.js'

const GAP = 8
const BAR_H = 44

// Состав + резерв. Выбор двухслотовый: цель (в составе) и кандидат (в резерве),
// нижняя панель показывает действия для этой пары. Так карточка остаётся одной
// кнопкой — три микрокнопки на 354px не помещаются читаемо.
// Координаты абсолютные — маска ScrollView живёт в мировых координатах, и
// контейнер со смещением увёл бы её от содержимого. Исключение: содержимое
// списка кладётся в scroll.inner и потому считается ОТ УГЛА списка, а не от
// угла экрана.
export class SquadView extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h, { onChange, toast }) {
    super(scene, 0, 0)
    this.scene_ = scene
    this.state = state
    this.boxW = w
    this.onChange = onChange
    this.toast = toast
    this.targetUid = null
    this.pickUid = null

    this.scroll = new ScrollView(scene, x, y, w, h - BAR_H)
    this.hint = label(scene, x + w / 2, y + h - BAR_H + 2, '', { size: 10, color: CSS.dim, align: 'center' })
    this.add([this.scroll, this.hint])

    const bw = (w - 3 * GAP) / 4
    this.actions = ['Add to Squad', 'Feed', '★ Merge', 'Sell'].map((text, i) => {
      const btn = new Button(scene, x + (bw + GAP) * i + bw / 2, y + h - BAR_H + 26, bw, 32, text,
        { size: 11, fill: i === 3 ? PAL.line : PAL.green })
      btn.on('press', () => this.act(i))
      this.add(btn)
      return btn
    })

    this.build()
    scene.add.existing(this)
  }

  get roster() { return this.state.roster }
  get classId() { return this.state.activeClass }

  build() {
    this.scroll.clearContent()
    this.cards = []
    const squad = this.roster.squad(this.classId)
    if (!squad.some((d) => d.uid === this.targetUid)) {
      this.targetUid = [...squad].sort((a, b) => ratingOf(b) - ratingOf(a))[0]?.uid ?? null
    }

    let y = this.section(`STARTERS (${SQUAD_SIZE})`, 0)
    for (const d of squad) y = this.card(d, y, true)

    const reserves = this.roster.sortedReserves()
    y = this.section(`RESERVE (${reserves.length})`, y + 6)
    if (!reserves.length) {
      this.scroll.inner.add(label(this.scene_, this.boxW / 2, y + 8,
        'Empty. Drivers come from packs.', { size: 11, color: CSS.dim, align: 'center' }))
      y += 34
    }
    for (const d of reserves) y = this.card(d, y, false)

    this.scroll.setContentHeight(y)
    this.refresh()
  }

  section(text, y) {
    this.scroll.inner.add(label(this.scene_, 2, y, text,
      { size: 11, bold: true, color: CSS.muted }))
    return y + 20
  }

  card(driver, y, isSquad) {
    const c = new DriverCard(this.scene_, driver, 0, y, this.boxW, {
      onTap: (d) => {
        if (isSquad) this.targetUid = d.uid
        else this.pickUid = this.pickUid === d.uid ? null : d.uid
        this.refresh()
      },
    })
    this.scroll.inner.add(c)
    this.cards.push({ card: c, isSquad })
    return y + DCARD_H + GAP
  }

  get target() { return this.roster.get(this.targetUid) }
  get pick() { return this.roster.get(this.pickUid) }

  act(index) {
    const pick = this.pick
    const target = this.target
    if (!pick) return
    if (index === 0) {
      const slot = this.roster.squadUids(this.classId).indexOf(this.targetUid)
      this.roster.assign(this.classId, slot < 0 ? 0 : slot, pick.uid)
      this.targetUid = pick.uid
      this.toast(`${nameOf(pick)} in squad`, PAL.green)
    } else if (index === 1) {
      const xp = feedXpOf(pick)
      const res = this.roster.train(target.uid, [pick.uid])
      this.toast(`+${xp} XP` + (res?.levels ? ` · Lv. +${res.levels}` : ''), PAL.cyan)
    } else if (index === 2) {
      this.roster.merge(target.uid, pick.uid)
      this.toast(`${nameOf(target)} · +1 ★`, PAL.gold)
    } else {
      const cash = this.state.sellDriver(pick.uid)
      this.toast('Sold for ' + formatMoney(cash), PAL.muted)
    }
    this.pickUid = null
    this.build()
    this.onChange?.()
  }

  auto() {
    const res = this.roster.autoManage(this.classId)
    this.toast(res?.trained?.xp
      ? `Auto: squad updated, +${res.trained.xp} XP`
      : 'Auto: squad updated', PAL.accent)
    this.pickUid = null
    this.build()
    this.onChange?.()
  }

  refresh() {
    for (const { card, isSquad } of this.cards) {
      const sel = isSquad ? card.driver.uid === this.targetUid : card.driver.uid === this.pickUid
      card.setSelected(sel)
      card.badge.setText(isSquad && card.driver.uid === this.targetUid ? 'PLAYING NOW' : '')
    }

    const pick = this.pick
    const target = this.target
    this.actions[0].setEnabled(!!pick)
    this.actions[1].setEnabled(!!pick && !!target)
    this.actions[2].setEnabled(!!(pick && target && canMerge(target, pick)))
    this.actions[3].setEnabled(!!pick)
    this.actions[3].setText(pick
      ? 'Sell ' + formatMoney(this.state.incomePerSec * RARITY_BY_ID[pick.rarity].sellSec)
      : 'Sell')

    this.hint.setText(pick
      ? `${nameOf(pick)} → ${target ? nameOf(target) : '—'}`
      : 'Tap a reserve driver — actions appear below')
  }

  destroy(fromScene) {
    this.scroll?.destroy(fromScene)
    super.destroy(fromScene)
  }
}
