import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatMoney } from '../utils/format.js'
import { GEMS } from '../config/balance.js'
import { panel, label } from './widgets.js'

// [F] Попап финиша с кадра: заголовок `VICTORY - PODIUM FINISH`, крупное `P1`,
// строки `Cash +$100` и `Gems (47 / 150 per day) +1`. До шага 1 результат
// заезда уходил в обычный тост и терялся среди сообщений хода гонки.
const W = 300
const H = 168

export class FinishPopup extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x - W / 2, y - H / 2)
    // Выше тостов (150): итог заезда и сообщение хода гонки приходят в один
    // и тот же кадр, и тост ложился ровно на крупное «P1».
    this.setDepth(160)
    this.setAlpha(0)

    this.bg = scene.add.graphics()
    this.title = label(scene, W / 2, 16, '', { size: 15, bold: true, align: 'center' })
    this.pos = label(scene, W / 2, 40, '', { size: 40, bold: true, align: 'center' })
    this.cash = label(scene, 20, 98, '', { size: 14, bold: true })
    this.cashVal = label(scene, W - 20, 98, '', { size: 14, bold: true, align: 'right', color: CSS.greenDim })
    this.gems = label(scene, 20, 128, '', { size: 12, color: CSS.muted })
    this.gemsVal = label(scene, W - 20, 126, '', { size: 14, bold: true, align: 'right', color: CSS.accent })

    this.add([this.bg, this.title, this.pos, this.cash, this.cashVal, this.gems, this.gemsVal])
    scene.add.existing(this)
  }

  show(res, gemsToday) {
    const win = res.position === 1
    const podium = res.position <= 3
    const accent = win ? PAL.green : podium ? PAL.gold : PAL.muted

    this.bg.clear()
    this.bg.fillStyle(PAL.panel, 1)
    this.bg.fillRoundedRect(0, 0, W, H, 16)
    this.bg.lineStyle(3, accent, 1)
    this.bg.strokeRoundedRect(0, 0, W, H, 16)
    this.bg.fillStyle(PAL.panelAlt, 1)
    this.bg.fillRoundedRect(14, 90, W - 28, 62, 10)

    this.title.setText(win ? 'VICTORY - FIRST PLACE' : podium ? 'PODIUM FINISH' : 'RACE COMPLETE')
    this.title.setColor('#' + accent.toString(16).padStart(6, '0'))
    this.pos.setText('P' + res.position)
    this.pos.setColor('#' + accent.toString(16).padStart(6, '0'))
    this.cash.setText('Cash')
    this.cashVal.setText('+' + formatMoney(res.prize))
    this.gems.setText(`Gems (${gemsToday} / ${GEMS.dailyCap} per day)`)
    this.gemsVal.setText(res.gems > 0 ? '+' + res.gems : '—')
    this.gemsVal.setColor(res.gems > 0 ? CSS.accent : CSS.dim)

    this.scene.tweens.killTweensOf(this)
    this.setAlpha(0).setScale(0.9)
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 160 })
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 2200, duration: 400 })
  }
}
