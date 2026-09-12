import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { formatClock, formatNum } from '../utils/format.js'
import { panel, label } from './widgets.js'
import { fitText, flowRow } from './layout.js'
import { TrackView } from './TrackView.js'
import { LapRibbon } from './LapRibbon.js'
import { RACE } from '../config/balance.js'

const BADGE_W = 132
const BADGE_H = 62
const PAD = 16

// Блок гонки — единственный тёмный блок на светлом экране, как в оригинале:
// имя команды красным, счётчик фанатов, бейдж P{n}/10 с таймером, лента
// прогресса кругов, карта трассы.
export class RacePanel extends Phaser.GameObjects.Container {
  constructor(scene, state, x, y, w, h) {
    super(scene, 0, 0)
    this.state = state
    this.px = x
    this.py = y

    panel(scene, x, y, w, h, { fill: PAL.dark, radius: 14 })

    // Левая колонка кончается там, где начинается бейдж: имя команды и счётчик
    // фанатов ужимаются под эту ширину, а не «обычно влезают».
    this.leftW = w - BADGE_W - PAD * 2 - 8
    this.teamText = label(scene, x + PAD, y + 12, state.teamName, { size: 18, bold: true, color: CSS.red })
    this.fansText = label(scene, x + PAD, y + 36, '', { size: 15, bold: true, color: CSS.onDark })

    // Сила команды на главном экране — иначе прокачка драйверов не даёт
    // никакой обратной связи. Подписи БУКВАМИ, а не значками ⚔/🛡: оба —
    // эмодзи с текстовым начертанием по умолчанию, и без селектора U+FE0F
    // Chrome рисует их как `×` и `♡`, то есть «× 152 ♡ 152». С селектором
    // щит появляется, а мечи в 11px всё равно читаются крестиком. Здесь строка
    // наша [X] (её нет ни на одном кадре), поэтому можно просто написать
    // словами — в окнах гира и карьеры значки остаются, там есть контекст. Подсвечивается ТА сторона, что решает заезд:
    // без подсветки деление апгрейдов на атаку и защиту неотличимо от косметики.
    // Координаты ряда считаются потоком в refresh(): при «⚔ 1.2M» жёсткие
    // x=26/82/138 склеивали числа с меткой ATTACK.
    this.offText = label(scene, x + PAD, y + 58, '', { size: 11, color: CSS.dim })
    this.defText = label(scene, x + PAD, y + 58, '', { size: 11, color: CSS.dim })
    this.modeText = label(scene, x + PAD, y + 58, '', { size: 10, bold: true, color: CSS.dim })

    // Бейдж позиции и таймера — правый верхний угол, как на кадрах.
    const bx = x + w - PAD - BADGE_W
    panel(scene, bx, y + 12, BADGE_W, BADGE_H, { fill: PAL.darkAlt, radius: 12, stroke: 0x2a3a4d })
    this.posText = label(scene, bx + BADGE_W / 2, y + 18, 'P1/10',
      { size: 26, bold: true, align: 'center', color: CSS.red })
    this.timeText = label(scene, bx + BADGE_W / 2, y + 48, '00:60',
      { size: 14, bold: true, align: 'center', color: CSS.onDark })

    const ribbonY = y + 84
    this.ribbon = new LapRibbon(scene, x, ribbonY, w)
    const trackY = ribbonY + this.ribbon.boxH + 6
    this.track = new TrackView(scene, x + 8, trackY, w - 16, y + h - 8 - trackY, state)

    // [F] Всплывашка прироста фанатов прямо на карте: `👥 443 ⌃ +205`.
    this.fansPop = label(scene, x + w / 2, y + h - 34, '', { size: 15, bold: true, align: 'center', color: CSS.onDark })
    this.fansPop.setAlpha(0)

    this.add([this.teamText, this.fansText, this.offText, this.defText,
      this.modeText, this.posText, this.timeText, this.ribbon, this.track, this.fansPop])
    scene.add.existing(this)
  }

  // Дёргается из RaceRewards через MainScene, когда фанаты реально начислены.
  popFans(total, gain) {
    this.fansPop.setText(`👥 ${formatNum(total)}  ⌃ +${formatNum(gain)}`)
    this.fansPop.setAlpha(1)
    this.scene.tweens.killTweensOf(this.fansPop)
    this.scene.tweens.add({ targets: this.fansPop, alpha: 0, duration: 1600, delay: 700 })
  }

  // Клетчатая вспышка на карте в момент финиша: дёргается из MainScene, когда
  // награды уже начислены.
  finishFlash(position) { this.track.finish(position) }

  // tick = { alpha, dt } приходит ТОЛЬКО из кадра обновления сцены. refreshUI
  // зовёт refresh() без него (после покупки, при закрытии окна) — и тогда
  // трасса не шагает: иначе машины успевали бы сделать два шага за один кадр.
  refresh(sim, tick = null) {
    const s = this.state
    fitText(this.teamText.setFontSize(18).setText(s.teamName), this.leftW)
    fitText(this.fansText.setFontSize(15).setText('👥 ' + formatNum(s.cls.fans)), this.leftW)
    this.offText.setText(`ATK ${formatNum(s.offense)}`)
    this.defText.setText(`DEF ${formatNum(s.defense)}`)

    if (sim) {
      // Какой стороной решается заезд — разыграно на старте, всю гонку не меняется.
      const attacking = sim.player.attacking
      this.modeText.setText(attacking ? 'ATTACK' : 'DEFEND')
      this.modeText.setColor(attacking ? CSS.red : CSS.cyan)
      this.offText.setColor(attacking ? CSS.onDark : CSS.dim)
      this.defText.setColor(attacking ? CSS.dim : CSS.onDark)
    }
    flowRow([this.offText, this.defText, this.modeText], this.px + PAD, 12)
    if (!sim) return

    const pos = sim.player.position
    this.posText.setText(`P${pos}/${RACE.racers}`)
    this.posText.setColor(pos === 1 ? CSS.red : pos <= 3 ? CSS.gold : CSS.onDark)
    this.timeText.setText(formatClock(sim.timeLeft))
    this.ribbon.update(sim, tick?.alpha ?? 1)
    if (tick) this.track.update(sim, tick.alpha, tick.dt)
  }
}
