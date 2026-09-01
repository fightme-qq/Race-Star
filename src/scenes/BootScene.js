import Phaser from 'phaser'
import { PAL, CSS, FONT } from '../config/palette.js'

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }) }

  preload() {
    // Ассетов пока нет — весь UI рисуется примитивами Phaser.
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(PAL.bg)
    this.add.text(width / 2, height / 2, 'RACE STAR', {
      fontFamily: FONT, fontSize: '34px', color: CSS.accent, fontStyle: 'bold',
    }).setOrigin(0.5)
    this.time.delayedCall(250, () => this.scene.start('Main'))
  }
}
