# Phaser 3 Game — Agent Instructions

## Project Structure
- `src/scenes/` — BootScene (preload), GameScene (gameplay), UIScene (HUD overlay)
- `src/input/InputActions.js` — InputController: read actions here, not raw keys in scenes
- `src/systems/` — GameState, HealthSystem and other pure game systems (no Phaser objects)
- `src/entities/` — Game object factories and entity helpers
- `src/ui/` — HUD helpers, buttons, panels
- `public/assets/` — images, audio

## Architecture Rules
- Input: scenes call `input_ctrl.read()` for actions (moveX/Y, primary, secondary). Never scatter raw key checks.
- State: store runtime data in `GameState`. Keep Phaser objects out of state classes.
- Scenes: load assets in BootScene.preload(). Keep HUD in UIScene so it survives restarts.
- Physics: use Arcade Physics for simple collisions. Enable only on objects that need it.
- State machines: use explicit state strings ('idle'|'run'|'dead') instead of boolean flags.
- Performance: use object pools for bullets/particles. Avoid allocations in update().

## Feature Recipes

### Add Player
1. Add sprite/rectangle in GameScene.create(), enable arcade physics body.
2. Read movement from `input_ctrl.read().moveX / moveY`.
3. Put movement logic in update(), keep it small.
4. Add collision with world bounds or platforms.

### Add Enemy
1. Pick one behavior: patrol, chase, or shoot.
2. Add as entity in `src/entities/`.
3. Add one consequence on contact: damage, score, or game over.
4. Clean up in scene shutdown to avoid duplicates on restart.

### Add Health & Damage
1. Use `src/systems/HealthSystem.js` — already scaffolded.
2. Call `health.damage(n)` on hit, `health.update(delta)` in scene update.
3. Flash sprite on hit: `this.tweens.add({ targets: sprite, alpha: 0, yoyo: true, duration: 80 })`.
4. Trigger game over when `health.isDead`.

### Add Touch Controls
1. Use `InputController` — pointer.isDown is already wired.
2. For virtual buttons: create rectangle zones, listen to pointerdown/up on them, set flags.
3. Make touch targets at least 60px. Keep away from screen edges.
4. Always keep keyboard working in parallel.

### Add Audio
1. Load in BootScene: `this.load.audio('sfx_hit', 'assets/audio/hit.wav')`.
2. Unlock on first gesture: wire to `this.input.once('pointerdown', () => this.sound.unlock())`.
3. Play SFX: `this.sound.play('sfx_hit', { volume: 0.6 })`.
4. Keep music volume ≤ 0.5, SFX ≤ 0.8.

### Add Save / Best Score
1. `GameState` already saves bestScore to localStorage.
2. For complex saves: JSON.stringify to localStorage, include a `version` field.
3. Always handle missing/corrupt saves with a try/catch and default values.

### Add Main Menu
1. Add MenuScene, register before BootScene in main.js scene array.
2. Start → Game via `this.scene.start('Game')`.
3. Keep buttons ≥ 60px tall for touch.

## Mobile Performance Rules
- Canvas size: use 390×844 (portrait phone). Don't scale up DPR beyond 2.
- Particles: pool them, max 50 active at once on mobile.
- Physics bodies: disable on off-screen objects.
- Update loop: avoid array allocations (map/filter) — reuse arrays.
- Test at 60fps on a mid-range device before adding effects.

## State Machine Pattern
Instead of: `if (isAttacking && !isDead && canMove)`
Do this:
```js
// states: 'idle' | 'run' | 'attack' | 'hurt' | 'dead'
setState(next) {
  this.state = next;
  // entry side effects here
}
update(delta) {
  if (this.state === 'run') { /* move */ }
  if (this.state === 'attack') { /* attack logic */ }
}
```
Use state strings when an object has more than 3 behavior modes.
