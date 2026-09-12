import Phaser from 'phaser'
import { PAL, CSS } from '../config/palette.js'
import { label, Button } from './widgets.js'
import { fitWrapped } from './layout.js'
import { DEPTH } from '../config/layout.js'
import { drawUpgradeIcon, EMOJI } from './UpgradeIcon.js'

// Окно справки по ⓘ. Живёт в СЦЕНЕ, а не в карточке: карточка лежит внутри
// скролла с геометрической маской, и всплывающее окно внутри неё срезалось бы
// по кромке списка.
//
// Собирается один раз и переиспользуется. Пересоздавать на каждый тап нельзя:
// объект держит слушатели ввода, и забытая копия продолжала бы ловить тапы —
// на этих граблях уже стояли в ScrollView.
const W = 318
const PAD = 16
const ICON = 44
const ROW_H = 26

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

export class InfoPopup extends Phaser.GameObjects.Container {
  constructor(scene, onClose) {
    super(scene, 0, 0)
    this.onCloseCb = onClose
    this.setDepth(DEPTH.info).setVisible(false)

    const { width, height } = scene.scale
    // Затемнение закрывает по тапу МИМО окна. Взведение (armed) — та же защита,
    // что в widgets.dimmer: ⓘ срабатывает на ОТПУСКАНИИ, и без неё то же самое
    // отпускание прилетело бы в свежепоказанное затемнение, закрыв справку в
    // тот же кадр.
    this.dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0).setInteractive()
    this.dim.on('pointerdown', () => { this.armed = true })
    this.dim.on('pointerup', () => { if (this.armed) this.close() })

    // Две вложенные обёртки, а не одна: `box` стоит в центре окна и его же
    // масштабирует твин, `content` смещён на пол-окна, и внутри него всё
    // считается от левого верхнего угла (0..W, 0..H). Без этой пары
    // масштабирование росло бы из угла, и окно заметно уезжало на появлении.
    this.box = scene.add.container(0, 0)
    this.content = scene.add.container(-W / 2, 0)
    this.box.add(this.content)
    this.add([this.dim, this.box])
    scene.add.existing(this)
  }

  // Именно `isOpen`, а не `active`: `active` у GameObject свой и только для
  // чтения через прототип — свой геттер с этим именем ломает конструктор
  // Container (`Cannot set property active`), и сцена не поднимается вовсе.
  get isOpen() { return this.visible }

  show(info) {
    this.content.removeAll(true)
    const s = this.scene
    const g = s.add.graphics()
    this.content.add(g)

    // --- шапка: плашка иконки + имя + цветной бейдж стороны ---------------
    const titleX = PAD + ICON + 12
    const title = label(s, titleX, PAD + 1, info.title, { size: 16, bold: true })
    fitWrapped(title, W - titleX - PAD, 44, 12)

    const badge = label(s, titleX + 9, PAD + 4 + title.height + 6, info.badge,
      { size: 9, bold: true, color: hex(info.color) })
    const badgeW = badge.width + 18
    const headerH = Math.max(ICON, title.height + badge.height + 16)

    // --- тело: что делает слот, потом почему это так работает -------------
    let y = PAD + headerH + 14
    const body = label(s, PAD, y, info.body, { size: 13 })
    body.setWordWrapWidth(W - PAD * 2).setLineSpacing(3)
    y += body.height + 9

    const note = label(s, PAD, y, info.note, { size: 11, color: CSS.muted })
    note.setWordWrapWidth(W - PAD * 2).setLineSpacing(2)
    y += note.height + 12

    // --- числа: подпись слева, значение справа, пара на строку -------------
    const plateY = y
    const texts = []
    info.rows.forEach(([name, value], i) => {
      const ry = plateY + 8 + i * ROW_H
      texts.push(label(s, PAD + 10, ry + 4, name, { size: 11.5, color: CSS.muted }))
      texts.push(label(s, W - PAD - 10, ry + 3, value, { size: 12.5, bold: true, align: 'right' }))
    })
    const plateH = info.rows.length * ROW_H + 10
    y = plateY + plateH

    // Причина замка — отдельной строкой под числами: на кнопке написано
    // «Locked», а ПОЧЕМУ — нигде, и это как раз тот вопрос, ради которого
    // и жмут ⓘ.
    let lock = null
    if (info.lock) {
      y += 10
      lock = label(s, PAD, y, info.lock, { size: 11, bold: true, color: CSS.gold })
      lock.setWordWrapWidth(W - PAD * 2).setLineSpacing(2)
      y += lock.height
    }

    y += 14
    const btn = new Button(s, W / 2, y + 19, W - PAD * 2, 38, 'Got it', { size: 14 })
    btn.on('press', () => this.close())
    const H = y + 38 + PAD

    // --- фон рисуем последним: его высота известна только теперь ----------
    g.fillStyle(PAL.panel, 1)
    g.fillRoundedRect(0, 0, W, H, 16)
    g.lineStyle(2, info.color, 1)
    g.strokeRoundedRect(0, 0, W, H, 16)
    g.fillStyle(PAL.panelAlt, 1)
    g.fillRoundedRect(PAD, PAD, ICON, ICON, 11)
    g.fillRoundedRect(PAD, plateY, W - PAD * 2, plateH, 10)
    g.fillStyle(info.color, 0.14)
    g.fillRoundedRect(titleX, badge.y - 3, badgeW, badge.height + 6, 5)
    // Боевые слоты рисуются вектором тем же кодом, что на карточке: иначе
    // справка показывала бы не тот значок, по которому в неё тапнули.
    const drawn = drawUpgradeIcon(g, info.key, PAD + ICON / 2, PAD + ICON / 2)

    this.content.add([title, badge, body, note, ...texts, btn])
    if (lock) this.content.add(lock)
    if (!drawn) {
      this.content.add(label(s, PAD + ICON / 2, PAD + ICON / 2 - 12, EMOJI[info.key] || '⚙',
        { size: 20, align: 'center' }))
    }

    const { width, height } = s.scale
    this.content.setY(-H / 2)
    this.box.setPosition(Math.round(width / 2), Math.round(height / 2))

    this.armed = false
    this.setVisible(true)
    s.tweens.killTweensOf(this.box)
    s.tweens.killTweensOf(this.dim)
    this.dim.setAlpha(0)
    this.box.setAlpha(0).setScale(0.92)
    s.tweens.add({ targets: this.dim, alpha: 1, duration: 120 })
    s.tweens.add({ targets: this.box, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut' })
  }

  close() {
    if (!this.visible) return
    this.armed = false
    this.scene.tweens.killTweensOf(this.box)
    this.scene.tweens.killTweensOf(this.dim)
    this.setVisible(false)
    this.content.removeAll(true)
    this.onCloseCb?.()
  }
}
