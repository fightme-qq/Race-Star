import Phaser from 'phaser'

// Overlay HUD — runs in parallel with GameScene so it survives restarts.
export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UI' }) }

  create() {
    // Add HUD elements here. Listen to game events via:
    // this.scene.get('Game').events.on('score-changed', n => { ... })
  }
}
