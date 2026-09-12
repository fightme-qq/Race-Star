import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { BRACKET, CUP } from '../../config/compete.js'
import { cupTierName, roundName } from '../../systems/BracketSystem.js'
import { formatNum, formatPercent } from '../../utils/format.js'
import { label, Button } from '../widgets.js'
import { fitText, fitWrapped } from '../layout.js'

const LOG_H = 24
const PAD = 14

// Сетка на выбывание — ОДИН блок на три повода: турнир лиги, недельный турнир и
// кубок. Три экрана на одном коде по той же причине, по которой у них один
// BracketSystem: разойдись подписи — и игрок читал бы два разных правила там,
// где правило одно (best-of-3, восемь участников, награда письмом [E]).
export class BracketView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, kind, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.kind = kind
    this.boxW = w
    this.boxH = 0
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.title = label(scene, PAD, 12, '', { size: 16, bold: true })
    this.status = label(scene, w - PAD, 15, '', { size: 12, bold: true, align: 'right' })
    this.round = label(scene, PAD, 0, '', { size: 13, bold: true, color: CSS.accent })
    this.opponent = label(scene, PAD, 0, '', { size: 12 })
    this.timing = label(scene, PAD, 0, '', { size: 11, color: CSS.muted })
    this.btn = new Button(scene, w / 2, 0, w - PAD * 2, 38, 'Register', { size: 13 })
    this.btn.on('press', () => this.register())

    this.logTitle = label(scene, PAD, 0, 'Results', { size: 11, bold: true, color: CSS.muted })
    this.logRows = Array.from({ length: BRACKET.roundNames.length }, () => ({
      name: label(scene, PAD, 0, '', { size: 12 }),
      pips: label(scene, w - PAD, 0, '', { size: 13, bold: true, align: 'right' }),
    }))
    this.place = label(scene, PAD, 0, '', { size: 13, bold: true })
    // Рамки кубка — ПОСТОЯННАЯ награда [E], поэтому список взятых живёт на
    // экране, а не в почте: письмо игрок прочитает один раз.
    this.frames = label(scene, PAD, 0, '', { size: 11, color: CSS.muted })

    this.add([this.bg, this.title, this.status, this.round, this.opponent, this.timing,
      this.btn, this.logTitle, this.place, this.frames,
      ...this.logRows.flatMap((r) => [r.name, r.pips])])
    scene.add.existing(this)
  }

  titleText() {
    if (this.kind === 'cup') return cupTierName(this.state.compete.cup, this.state.clsDef.name)
    if (this.kind === 'weekly') return 'Weekly Tournament'
    return 'Tournament'
  }

  register() {
    const info = this.state.bracketInfo(this.kind)
    if (info.blocked) { this.toast?.(`Switch to ${info.blocked} to register`, PAL.muted); return }
    if (info.cupBlocked !== null) { this.toast?.(`Reach league ${info.cupBlocked + 1}`, PAL.muted); return }
    if (!this.state.registerBracketFor(this.kind)) {
      this.toast?.('You are already registered', PAL.muted)
      return
    }
    this.toast?.(`Registered · ${this.titleText()}`, PAL.green)
    this.onChange?.()
  }

  // Текст кнопки несёт причину отказа: серая `Register` читается как «ещё не
  // загрузилось», а не как «нужен другой класс».
  buttonState(info) {
    if (info.blocked) return [`Available when ${info.blocked} is active`, false]
    if (info.cupBlocked !== null) return [`Reach league ${info.cupBlocked + 1}`, false]
    if (info.place !== null) return ['Tournament finished', false]
    if (info.registered) return ['You are already registered', false]
    return ['Register', true]
  }

  refresh() {
    const info = this.state.bracketInfo(this.kind)
    const cup = this.kind === 'cup' ? this.state.compete.cup : null
    fitText(this.title.setText(this.titleText()).setFontSize(16), this.boxW - 140)
    this.status.setText(info.registered ? 'Registered' : 'Not registered')
      .setColor(info.registered ? CSS.greenDim : CSS.muted)

    let y = 40
    const live = info.registered && info.place === null
    this.round.setVisible(live).setY(y)
    if (live) {
      this.round.setText(`${info.roundName}   ·   best-of-${BRACKET.bestOf}`)
      y += 20
    }

    const opp = live ? info.opponent : null
    this.opponent.setVisible(!!opp).setY(y)
    if (opp) {
      // Шанс считает тот же duelProb, что и серия (правило 16): показанное число
      // — вероятность ОДНОГО заезда серии, не всей сетки.
      const chance = this.state.arenaChance(opp) * 100
      this.opponent.setText(`vs ${opp.name}   ·   Power ${formatNum(opp.power)}`
        + `   ·   Win Chance: ${formatPercent(chance)}`)
      fitText(this.opponent.setFontSize(12), this.boxW - PAD * 2)
      y += 19
    }

    this.timing.setVisible(live).setY(y)
    if (live) {
      this.timing.setText(info.ready
        ? 'Next round is revealed on the next race'
        : `Next round in ${info.racesLeft} races`)
      y += 22
    }

    this.btn.setY(y + 19)
    const [text, on] = this.buttonState(info)
    this.btn.setText(text)
    fitText(this.btn.txt.setFontSize(13), this.boxW - PAD * 2 - 16)
    this.btn.setEnabled(on)
    y += 46

    y = this.layoutLog(info, y)

    this.place.setVisible(info.place !== null).setY(y)
    if (info.place !== null) {
      this.place.setText(info.place === 1 ? '🏆 Champion!' : `Final placement: ${info.place} of ${BRACKET.size}`)
        .setColor(info.place === 1 ? CSS.gold : CSS.text)
      y += 22
    }

    const taken = cup?.taken ?? []
    this.frames.setVisible(!!cup).setY(y)
    if (cup) {
      this.frames.setText(`Tier ${cup.tier + 1} of ${CUP.tiers.length}`
        + (taken.length ? `   ·   Frames won: ${taken.join(', ')}` : '   ·   No frames won yet'))
      fitWrapped(this.frames.setFontSize(11), this.boxW - PAD * 2, 40)
      y += this.frames.height + 6
    }

    this.boxH = y + 10
    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, 14)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, 14)
  }

  // `Reveal Results` [E]: серия показана точками — заполненная точка это взятый
  // заезд. Без них best-of-3 визуально не отличим от одного матча.
  layoutLog(info, y) {
    const log = (info.log || []).slice(0, this.logRows.length)
    this.logTitle.setVisible(log.length > 0).setY(y)
    if (log.length) y += 18
    this.logRows.forEach((row, i) => {
      const entry = log[i]
      const on = !!entry
      row.name.setVisible(on); row.pips.setVisible(on)
      if (!on) return
      const top = y + i * LOG_H
      row.name.setY(top).setText(`${roundName(entry.round)} · ${entry.name}`)
      fitText(row.name.setFontSize(12), this.boxW - 120)
      row.pips.setY(top).setText(entry.games.map((g) => (g ? '●' : '○')).join(' '))
        .setColor(entry.won ? CSS.greenDim : CSS.red)
    })
    return y + log.length * LOG_H
  }
}
