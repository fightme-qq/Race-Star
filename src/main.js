import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { MainScene } from './scenes/MainScene.js'
import { PAL } from './config/palette.js'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 390,
  height: 844,
  backgroundColor: PAL.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainScene],
})

// Ручка для отладки из консоли браузера.
window.__game = game
