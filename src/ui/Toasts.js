import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'

// [F] Всплывающие плашки поверх трассы: на кадре это БЕЛАЯ плашка с цветным
// жирным текстом («Prime Chargers takes the lead!» красным), а не цветная
// плашка с белым текстом. В оригинале они декоративны и с картой не связаны —
// у нас приходят из реальных событий симуляции.
export class Toasts extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y)
    this.queue = []
    scene.add.existing(this)
    // Выше модалок (у них 100): плашки — единственный отклик на действия
    // внутри них. На глубине 50 сообщение «Класс открыт!» уходило под окно.
    this.setDepth(150)
  }

  show(text, color = PAL.accent) {
    const t = this.scene.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: '13px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: CSS.panel,
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0.5)

    this.add(t)
    // Сдвигаем уже висящие плашки вниз, новая появляется сверху.
    for (const other of this.list) {
      if (other !== t) other.y += 28
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
