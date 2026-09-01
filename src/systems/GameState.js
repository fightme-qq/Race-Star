// Runtime game state. Keep Phaser objects out of here.
export class GameState {
  constructor() { this.reset(); }

  reset() {
    this.phase = 'ready'; // 'ready' | 'playing' | 'won' | 'lost'
    this.score = 0;
    this.bestScore = Number(localStorage.getItem('bestScore') ?? 0);
    this.elapsedMs = 0;
  }

  start() { this.phase = 'playing'; }

  addScore(n) {
    this.score += n;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('bestScore', this.bestScore);
    }
  }

  update(delta) { if (this.phase === 'playing') this.elapsedMs += delta; }

  finish(phase) { this.phase = phase; } // 'won' | 'lost'
}
