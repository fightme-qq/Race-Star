import Phaser from 'phaser'
import { fadeStrip } from './layout.js'

// Вертикальный скролл с маской. Вынесен из UpgradeGrid, чтобы список
// драйверов не заводил вторую копию той же логики.
//
// Слушатели висят на scene.input, а НЕ на Zone: Zone с topOnly перехватывает
// pointerdown у кнопок внутри карточек — на этих граблях уже стояли.
// Обратная сторона: при destroy() слушатели надо снимать руками, иначе
// закрытая модалка продолжит их держать.
//
// `fade` — цвет затухания у нижней кромки. Маска режет содержимое ровно по
// пикселю, и обрезанная пополам строка («Speedster» в классах, «Ultimate
// Starter Pack» в магазине) читалась как сломанная вёрстка, а не как «ниже
// есть ещё». Полоска затухания снимает это и заодно подсказывает про скролл.
export class ScrollView extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, { fade = null, fadeH = 24 } = {}) {
    super(scene, x, y)
    this.viewW = w
    this.viewH = h
    this.contentH = 0
    this.scrollY = 0
    this.locked = false

    this.inner = scene.add.container(0, 0)
    this.add(this.inner)

    if (fade !== null) {
      this.fadeG = scene.add.graphics()
      fadeStrip(this.fadeG, 0, h - fadeH, w, fadeH, fade)
      this.add(this.fadeG)
      this.fadeH = fadeH
    }

    const mask = scene.make.graphics({ x: 0, y: 0, add: false })
    mask.fillStyle(0xffffff)
    mask.fillRect(x, y, w, h)
    this.maskGfx = mask
    this.setMask(mask.createGeometryMask())

    const inside = (p) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
    let dragging = false
    let startY = 0
    let startScroll = 0

    this.handlers = {
      pointerdown: (p) => {
        if (this.locked || !inside(p)) return
        dragging = true
        startY = p.y
        startScroll = this.scrollY
      },
      pointermove: (p) => {
        if (!dragging || !p.isDown) return
        this.setScroll(startScroll + (p.y - startY))
      },
      pointerup: () => { dragging = false },
      wheel: (p, objs, dx, dy) => {
        if (this.locked || !inside(p)) return
        this.setScroll(this.scrollY - dy * 0.5)
      },
    }
    for (const [ev, fn] of Object.entries(this.handlers)) scene.input.on(ev, fn)

    scene.add.existing(this)
  }

  setContentHeight(h) {
    this.contentH = h
    this.setScroll(this.scrollY)
  }

  setScroll(value) {
    const min = Math.min(0, this.viewH - this.contentH)
    this.scrollY = Phaser.Math.Clamp(value, min, 0)
    this.inner.y = this.scrollY
    // Внизу списка затухать нечему — полоска там только мешала бы читать
    // последнюю строку.
    this.fadeG?.setVisible(this.scrollY > min + 1)
  }

  clearContent() {
    this.inner.removeAll(true)
    this.scrollY = 0
    this.inner.y = 0
  }

  destroy(fromScene) {
    if (this.scene) {
      for (const [ev, fn] of Object.entries(this.handlers)) this.scene.input.off(ev, fn)
    }
    this.maskGfx?.destroy()
    super.destroy(fromScene)
  }
}
