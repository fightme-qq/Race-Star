// Action-based input snapshot — scenes ask for intent, not raw keys.
// Add actions here as the game grows; keep raw key/touch details in this file.

export const emptyInput = () => ({
  moveX: 0,   // -1 left, 1 right
  moveY: 0,   // -1 up, 1 down
  primary: false,   // attack / jump / confirm
  secondary: false, // dash / cancel
});

export class InputController {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard?.createCursorKeys?.() ?? {};
    this.wasd = scene.input.keyboard?.addKeys?.('W,A,S,D,SPACE,SHIFT') ?? {};
    this.pointer = { x: 0, y: 0, isDown: false };
    scene.input.on('pointermove', p => { this.pointer.x = p.x; this.pointer.y = p.y; });
    scene.input.on('pointerdown', p => { this.pointer.isDown = true; });
    scene.input.on('pointerup',   () => { this.pointer.isDown = false; });
  }

  read() {
    const k = this.keys;
    const w = this.wasd;
    return {
      moveX: (k.right?.isDown || w.D?.isDown ? 1 : 0) - (k.left?.isDown || w.A?.isDown ? 1 : 0),
      moveY: (k.down?.isDown  || w.S?.isDown ? 1 : 0) - (k.up?.isDown   || w.W?.isDown ? 1 : 0),
      primary:   k.space?.isDown || w.SPACE?.isDown || this.pointer.isDown,
      secondary: k.shift?.isDown || w.SHIFT?.isDown,
    };
  }
}
