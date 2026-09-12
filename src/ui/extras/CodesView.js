import Phaser from 'phaser'
import { PAL, CSS } from '../../config/palette.js'
import { GIFT_CODES } from '../../config/extras.js'
import { label, Button } from '../widgets.js'
import { fitText, fitWrapped } from '../layout.js'
import { sectionCard } from '../shop/ShopRow.js'

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const KCOLS = 7
const KEY_H = 30
const KGAP = 5
const PAD = 14
const FIELD_Y = 56
const KB_Y = 122
const KB_H = Math.ceil((KEYS.length + 1) / KCOLS) * (KEY_H + KGAP) - KGAP
const CODES_H = KB_Y + KB_H + 50
const DISCORD_H = 94

const discordGems = GIFT_CODES.codes.DISCORD?.find((r) => r.kind === 'gems')?.amount ?? 0

// Гифт-коды [E]: `Gift Codes`, `Enter Gift Code`, `Gift Code not found`, `This
// Gift Code already used`, `GiftCode must be between {0} and {1} characters`.
//
// Ввода текста у Phaser нет, а вешать на канвас скрытый <input> значило бы
// тащить в игру второй слой ввода с собственной клавиатурой ОС поверх кадра.
// Поэтому клавиатура своя, экранная: 36 клавиш + DEL. Коды короткие и
// заглавные, так что набор из A-Z 0-9 полон.
export class CodesView extends Phaser.GameObjects.Container {
  constructor(scene, state, w, { toast, onChange }) {
    super(scene, 0, 0)
    this.state = state
    this.boxW = w
    this.toast = toast
    this.onChange = onChange
    this.code = ''

    this.bg = scene.add.graphics()
    this.title = label(scene, PAD, 12, 'Gift Codes', { size: 16, bold: true })
    this.sub = label(scene, w - PAD, 15, 'Enter Gift Code', { size: 11, color: CSS.muted, align: 'right' })
    this.field = label(scene, w / 2, FIELD_Y + 9, '', { size: 18, bold: true, align: 'center' })
    this.msg = label(scene, w / 2, 100, '', { size: 11, align: 'center' })
    this.add([this.bg, this.title, this.sub, this.field, this.msg])

    const kw = (w - PAD * 2 - KGAP * (KCOLS - 1)) / KCOLS
    this.keys = KEYS.map((ch, i) => {
      const btn = this.key(scene, i, kw, KEY_H, ch)
      btn.on('press', () => this.keyPress(ch))
      return btn
    })
    // DEL занимает две клетки: промахнуться по стиранию неприятнее, чем по букве.
    this.del = this.key(scene, KEYS.length, kw, KEY_H, 'DEL', { wide: true, fill: PAL.dim })
    this.del.on('press', () => this.keyPress(null))

    this.redeemBtn = new Button(scene, w / 2, KB_Y + KB_H + 26, w - PAD * 2, 32, 'Redeem',
      { size: 13, fill: PAL.accent })
    this.redeemBtn.on('press', () => this.redeem())
    this.add(this.redeemBtn)

    this.dHead = label(scene, PAD, 0, 'JOIN OUR DISCORD', { size: 13, bold: true, color: CSS.accent })
    this.dText = label(scene, PAD, 0,
      `Join our Discord channel and get ${discordGems} Gems as a reward!`, { size: 11, color: CSS.muted })
    this.dHint = label(scene, PAD, 0, 'Gift Code: DISCORD', { size: 11, bold: true, color: CSS.gold })
    this.add([this.dHead, this.dText, this.dHint])

    this.boxH = 0
    scene.add.existing(this)
  }

  // Клавиша на белой карточке должна быть видна сама: заливка `panel` слилась бы
  // с подложкой, поэтому буквы стоят на `chrome` — том же цвете, что шапка.
  key(scene, i, kw, kh, text, { wide = false, fill = PAL.chrome } = {}) {
    const col = i % KCOLS
    const row = Math.floor(i / KCOLS)
    const bw = wide ? kw * 2 + KGAP : kw
    const btn = new Button(scene,
      PAD + (kw + KGAP) * col + bw / 2, KB_Y + (kh + KGAP) * row + kh / 2,
      bw, kh, text, { size: 12, fill, radius: 7 })
    this.add(btn)
    return btn
  }

  // НЕ `type`: у GameObject это собственное поле-строка ('Container'), и метод
  // с таким именем оно перекрывает — экранная клавиатура падала на каждом тапе
  // с `this.type is not a function` (та же семья граблей, что правило 11).
  keyPress(ch) {
    if (ch === null) this.code = this.code.slice(0, -1)
    else if (this.code.length < GIFT_CODES.maxLen) this.code += ch
    this.msg.setText('')
    this.paintField()
  }

  // Ошибка показывается ДОСЛОВНО так, как её вернула система: это строки
  // оригинала [E], и переписывать их своими словами значило бы потерять
  // единственное, что про этот экран известно точно.
  redeem() {
    const res = this.state.redeemGiftCode(this.code)
    if (!res.ok) {
      this.msg.setText(res.why).setColor(CSS.red)
      fitText(this.msg.setFontSize(11), this.boxW - PAD * 2)
      this.toast?.(res.why, PAL.red)
      return
    }
    const text = res.texts.join('  ')
    this.msg.setText(`Code redeemed  ${text}`).setColor(CSS.greenDim)
    fitText(this.msg.setFontSize(11), this.boxW - PAD * 2)
    this.toast?.('Gift Code redeemed  ' + text, PAL.green)
    this.code = ''
    this.paintField()
    this.onChange?.()
  }

  paintField() {
    this.field.setText(this.code || 'ENTER GIFT CODE')
    this.field.setColor(this.code ? CSS.text : CSS.dim)
    fitText(this.field.setFontSize(this.code ? 18 : 13), this.boxW - PAD * 2 - 12)
    // Кнопка живая на ЛЮБОМ непустом коде, а не только на длине от minLen:
    // сообщение о длине — строка оригинала [E], и запретом нажатия игрок её
    // никогда бы не увидел, то есть правило про длину осталось бы необъяснённым.
    this.redeemBtn?.setEnabled(this.code.length > 0)
  }

  refresh() {
    this.bg.clear()
    sectionCard(this.bg, 0, this.boxW, CODES_H)
    this.bg.fillStyle(PAL.panelAlt, 1)
    this.bg.fillRoundedRect(PAD, FIELD_Y, this.boxW - PAD * 2, 36, 10)
    this.bg.lineStyle(1, PAL.line, 1)
    this.bg.strokeRoundedRect(PAD, FIELD_Y, this.boxW - PAD * 2, 36, 10)
    this.paintField()

    const dy = CODES_H + 12
    sectionCard(this.bg, dy, this.boxW, DISCORD_H)
    this.dHead.setPosition(PAD, dy + 12)
    this.dText.setPosition(PAD, dy + 34)
    fitWrapped(this.dText.setFontSize(11), this.boxW - PAD * 2, 32)
    this.dHint.setPosition(PAD, dy + 68)
    this.boxH = dy + DISCORD_H
  }
}
