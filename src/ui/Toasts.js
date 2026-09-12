import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'
import { DEPTH, TOAST_STACK } from '../config/layout.js'

// [F] Всплывающие плашки: на кадре это БЕЛАЯ плашка с цветным жирным текстом
// («Prime Chargers takes the lead!» красным), а не цветная плашка с белым.
//
// Место у плашек теперь СВОЁ, а не «поверх карты»: на главном экране это полоса
// между блоком гонки и сеткой апгрейдов, при открытой модалке — затемнённая
// шапка. Раньше якорь стоял на raceY+128, то есть ровно на верхней кромке
// трассы: сообщение закрывало точки участников, а на кадре карьеры ложилось
// поперёк первой карточки навыка.
export class Toasts extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y)
    this.baseY = y
    this.stackLimit = TOAST_STACK
    scene.add.existing(this)
    this.setDepth(DEPTH.toast)
  }

  // Переезд полосы. Уже висящие плашки едут вместе с ней, иначе при открытии
  // окна старое сообщение осталось бы висеть внутри него. `limit` едет вместе
  // с якорем: сколько плашек можно показать, зависит от того, сколько свободного
  // места есть НАД полосой в этом положении.
  setAnchor(y, limit = TOAST_STACK) {
    this.stackLimit = limit
    this.trim()
    if (this.baseY === y) return
    this.baseY = y
    this.scene.tweens.killTweensOf(this)
    this.scene.tweens.add({ targets: this, y, duration: 160, ease: 'Quad.easeOut' })
  }

  // Самые старые плашки убираем сразу: без лимита стопка росла бесконечно и
  // верхние уезжали в чужой блок — ровно то наложение, ради которого полосу и
  // заводили.
  trim() {
    while (this.list.length > this.stackLimit) {
      const oldest = this.list[0]
      // Твины гасим ДО destroy: у плашки их два (появление и уход), и
      // onComplete второго дёрнул бы destroy повторно.
      this.scene.tweens.killTweensOf(oldest)
      oldest.destroy()
    }
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
    // Стопка растёт ВВЕРХ: новая плашка встаёт на полосу, старые поднимаются.
    // Раньше старые уезжали ВНИЗ (+28) — то есть прямо в сетку апгрейдов под
    // полосой и в содержимое открытого окна.
    for (const other of this.list) {
      if (other !== t) other.y -= 28
    }
    this.trim()
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