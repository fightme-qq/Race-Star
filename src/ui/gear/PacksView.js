import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { SP, R } from '../../config/layout.js'
import { GEAR, GEAR_PACKS, GEAR_BY_ID, COUPON_KINDS } from '../../config/gear.js'
import { slotName } from '../../systems/GearSystem.js'
import { label, Button } from '../widgets.js'
import { fitText } from '../layout.js'
import { hex, rarityOf } from './gearText.js'

const PAD = SP.lg
const CARD_H = 150
const FREE_H = 74
const BTN_H = 34
const CPN_W = 112

// Паки гира [E] `Standard Gear` / `Elite Gear`, кнопки `Open x1` / `Open x10`,
// строка гарантии `Guaranteed <b>{0}</b> in <b>{1}</b> draws`. Цены и шансы [X]
// (таблица выпадения в оригинале спрятана за кнопкой `Probabilities`).
//
// Купон [E] открывает пак мимо гемов и только одиночным открытием — см.
// GameState.drawGear. Поэтому кнопка купона отдельная, а не «галочка» к x1:
// иначе игрок тратил бы купоны, не заметив.
export class PacksView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange

    this.bg = scene.add.graphics()
    this.add(this.bg)

    const half = (w - PAD * 2 - SP.sm) / 2
    this.cards = GEAR_PACKS.map((pack) => {
      const coupon = COUPON_KINDS.find((c) => c.pack === pack.id) ?? null
      const card = {
        pack,
        coupon,
        title: label(scene, PAD, 0, pack.name, { size: 15, bold: true, color: hex(pack.color) }),
        odds: label(scene, PAD, 0, '', { size: 10, color: CSS.muted }),
        pity: label(scene, PAD, 0, '', { size: 10, color: CSS.gold }),
        cpnTxt: label(scene, PAD, 0, '', { size: 10, color: CSS.muted }),
        b1: new Button(scene, PAD + half / 2, 0, half, BTN_H, '', { size: 13, fill: pack.color }),
        b10: new Button(scene, w - PAD - half / 2, 0, half, BTN_H, '', { size: 13 }),
        cpnBtn: new Button(scene, w - PAD - CPN_W / 2, 0, CPN_W, 28, 'Use Coupon',
          { size: 11, fill: PAL.green }),
      }
      card.b1.on('press', () => this.draw(pack.id, 1, false))
      card.b10.on('press', () => this.draw(pack.id, 10, false))
      card.cpnBtn.on('press', () => this.draw(pack.id, 1, true))
      this.add([card.title, card.odds, card.pity, card.cpnTxt, card.b1, card.b10, card.cpnBtn])
      return card
    })

    this.freeHead = label(scene, PAD, 0, 'FREE GEAR', { size: 13, bold: true })
    this.freeDesc = label(scene, PAD, 0, '', { size: 11, color: CSS.muted })
    this.freeBtn = new Button(scene, w - PAD - CPN_W / 2, 0, CPN_W, 32, 'Watch ad',
      { size: 12, fill: PAL.green })
    this.freeBtn.on('press', () => this.watchAd())

    this.lastHead = label(scene, PAD, 0, 'LAST OPENING', { size: 11, bold: true, color: CSS.muted })
    this.lastTxt = label(scene, PAD, 0, '', { size: 11, color: CSS.dim })
    this.lastTxt.setWordWrapWidth(w - PAD * 2)
    this.add([this.freeHead, this.freeDesc, this.freeBtn, this.lastHead, this.lastTxt])

    this.boxH = 0
    scene.add.existing(this)
  }

  oddsText(pack) {
    return Object.entries(pack.odds)
      .map(([id, p]) => `${GEAR_BY_ID[id].name} ${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%`)
      .join('  ·  ')
  }

  draw(packId, count, useCoupon) {
    const got = this.state.drawGear(packId, count, useCoupon)
    if (!got) {
      this.toast?.(useCoupon ? 'No coupons left' : 'Not enough Gems', PAL.red)
      return
    }
    this.show(got)
    this.onChange?.()
  }

  watchAd() {
    const got = this.state.watchGearAd()
    if (!got) { this.toast?.('No free openings left today', PAL.muted) ; return }
    this.show(got)
    this.onChange?.()
  }

  // Результат — тостом, как все отклики внутри окна (правило 27). Список
  // «последнее открытие» остаётся в карточке: у x10 тост покажет только лучшее,
  // а знать, что пришло, игроку нужно целиком.
  show(items) {
    const bag = this.state.gear
    const sorted = [...items].sort((a, b) => bag.valueOf(b) - bag.valueOf(a))
    const best = sorted[0]
    this.lastItems = sorted.map((it) => `${rarityOf(it).name} ${this.nameOf(it)}`)
    this.toast?.(`${rarityOf(best).name} ${this.nameOf(best)}!`, rarityOf(best).color)
  }

  nameOf(it) { return slotName(this.state.activeClass, it.slot) }

  refresh() {
    const s = this.state
    const packs = s.gearPacks
    let y = 0
    this.bg.clear()

    packs.forEach((row, i) => {
      const card = this.cards[i]
      const { pack } = card
      this.sheet(y, CARD_H, pack.color)
      card.title.setPosition(PAD, y + 12)
      fitText(card.odds.setFontSize(10).setText(this.oddsText(pack)).setPosition(PAD, y + 36),
        this.boxW - PAD * 2)
      card.pity.setPosition(PAD, y + 54)
        .setText(`Guaranteed ${GEAR_BY_ID[pack.pityRarity].name} in ${row.pityLeft} draws`)

      const btnY = y + 92
      card.b1.setPosition(card.b1.x, btnY).setText(`Open x1  ·  ${pack.gems1} 💎`)
      card.b1.setEnabled(row.can1)
      card.b10.setPosition(card.b10.x, btnY).setText(`Open x10  ·  ${pack.gems10} 💎`)
      card.b10.setEnabled(row.can10)

      const cpnY = y + 126
      const name = card.coupon?.name ?? 'Coupon'
      fitText(card.cpnTxt.setFontSize(10)
        .setText(`${name}  ×  ${row.coupons}`)
        .setPosition(PAD, cpnY - 6), this.boxW - PAD * 2 - CPN_W - SP.md)
      card.cpnBtn.setPosition(card.cpnBtn.x, cpnY).setVisible(row.coupons > 0)
      card.cpnBtn.setEnabled(row.coupons > 0)
      y += CARD_H + SP.md
    })

    this.sheet(y, FREE_H, PAL.line)
    this.freeHead.setPosition(PAD, y + 13)
    const left = s.gearFreeLeft
    fitText(this.freeDesc.setFontSize(11)
      .setText(`Watch an ad  ·  ${left} / ${GEAR.freeAdsPerDay} left today`)
      .setPosition(PAD, y + 36), this.boxW - PAD * 2 - CPN_W - SP.md)
    this.freeBtn.setPosition(this.freeBtn.x, y + FREE_H / 2 + 2)
    this.freeBtn.setText(left > 0 ? 'Watch ad' : 'Done')
    this.freeBtn.setFill(left > 0 ? PAL.green : PAL.line)
    this.freeBtn.setEnabled(left > 0)
    y += FREE_H + SP.md

    // Высота блока результатов МЕРЯЕТСЯ по тексту: у x10 десять строк, у x1 —
    // одна, и зашитая высота либо резала список, либо оставляла дыру.
    const lines = this.lastItems ?? []
    this.lastHead.setPosition(PAD, y + SP.md).setVisible(lines.length > 0)
    this.lastTxt.setPosition(PAD, y + SP.md + 18).setVisible(lines.length > 0)
    if (lines.length) {
      this.lastTxt.setText(lines.join('\n'))
      y += SP.md + 18 + this.lastTxt.height
    }

    this.boxH = y
  }

  // Лист карточки с обводкой в цвет пака — тот же приём, что у карточки драйвера
  // (цвет редкости в рамке, а не в заливке: на светлой теме заливка съедает текст).
  sheet(y, h, stroke) {
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, y, this.boxW, h, R.lg)
    this.bg.lineStyle(1, stroke, 1)
    this.bg.strokeRoundedRect(0, y, this.boxW, h, R.lg)
  }
}
