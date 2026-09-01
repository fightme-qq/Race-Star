export class HealthSystem {
  constructor(maxHealth) {
    this.maxHealth = maxHealth;
    this.current = maxHealth;
    this.invulnerableMs = 0;
  }

  get isDead() { return this.current <= 0; }
  get ratio() { return this.current / this.maxHealth; }

  reset() { this.current = this.maxHealth; this.invulnerableMs = 0; }

  update(delta) {
    this.invulnerableMs = Math.max(0, this.invulnerableMs - delta);
  }

  damage(amount, invulnerabilityMs = 500) {
    if (this.invulnerableMs > 0 || this.isDead) return false;
    this.current = Math.max(0, this.current - amount);
    this.invulnerableMs = invulnerabilityMs;
    return true;
  }

  heal(amount) { this.current = Math.min(this.maxHealth, this.current + amount); }
}
