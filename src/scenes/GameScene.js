import Phaser from 'phaser'
import { InputController } from '../input/InputActions.js'
import { GameState } from '../systems/GameState.js'

export class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'Game' }) }

  create() {
    const { width, height } = this.scale
    this.state = new GameState()
    this.input_ctrl = new InputController(this)

    // --- Placeholder visuals (replace with real sprites) ---
    this.player = this.add.rectangle(width / 2, height / 2, 40, 40, 0xe94560)
    this.physics.add.existing(this.player)
    this.player.body.setCollideWorldBounds(true)

    this.add.text(16, 16, 'Race Star', { fontSize: '18px', color: '#ffffff' })
    this.scoreText = this.add.text(16, 40, 'Score: 0', { fontSize: '14px', color: '#aaaacc' })

    // Tap/click to score (replace with real game logic)
    this.input.on('pointerdown', () => {
      this.state.addScore(1)
      this.scoreText.setText('Score: ' + this.state.score)
    })

    this.state.start()
  }

  update(time, delta) {
    this.state.update(delta)
    const actions = this.input_ctrl.read()
    const speed = 200
    const body = this.player.body
    body.setVelocity(actions.moveX * speed, actions.moveY * speed)
  }
}
