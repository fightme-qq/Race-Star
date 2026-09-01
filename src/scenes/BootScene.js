import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }) }

  preload() {
    // Load assets here. Use this.load.image / audio / atlas.
    // Example: this.load.image('player', 'assets/images/player.png')
  }

  create() {
    this.scene.start('Game')
  }
}
