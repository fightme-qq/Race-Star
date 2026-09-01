import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'

// Всплывающие плашки поверх трассы: "Your Team takes the lead!", прирост фанатов
// и т.п. В оригинале они декоративны и не синхронизированы с картой — у нас
// приходят из реальных событий симуляции.
export class Toasts extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y)
    this.queue = []
    scene.add.existing(this)
    this.setDepth(50)
  }

  show(text, color = PAL.accent) {
    const t = this.scene.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: '13px',
      color: CSS.text,
      fontStyle: 'bold',
      backgroundColor: '#' + color.toString(16).padStart(6, '0'),
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5, 0.5)

    this.add(t)
    // Сдвигаем уже висящие плашки вниз, новая появляется сверху.
    for (const other of this.list) {
      if (other !== t) other.y += 26
    }
    this.scene.tweens.add({
      targets: t,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.85, to: 1 },
      duration: 140,
    })
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      y: '-=18',
      delay: 1400,
      duration: 320,
      onComplete: () => t.destroy(),
    })
  }
}
