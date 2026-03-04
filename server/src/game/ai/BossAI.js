import { BotState } from 'shadow-arena-shared/entities/BotEntity.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { ProjectileEntity } from 'shadow-arena-shared/entities/ProjectileEntity.js';
import { distance, randomInRange } from 'shadow-arena-shared/utils/Vector2.js';
import { BotAI } from './BotAI.js';

export class BossAI extends BotAI {
  constructor(bot, room) {
    super(bot, room);
    this.phase = 0;
    this.chargeTimer = 0;
    this.chargeCooldown = 8000;
    this.lastChargeTime = 0;
    this.isCharging = false;
    this.burstCooldown = 12000;
    this.lastBurstTime = 0;
  }

  update(dt, now) {
    if (!this.bot.alive) return;

    // Check phase transitions
    const healthPct = this.bot.health / this.bot.maxHealth;
    const newPhase = healthPct > 0.66 ? 0 : (healthPct > 0.33 ? 1 : 2);

    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.onPhaseChange(newPhase);
    }

    // Find target
    this.target = this.room.getNearestPlayer(this.bot.x, this.bot.y, this.bot.id);
    if (!this.target) {
      this.patrol(dt);
      return;
    }

    const dist = distance(this.bot.x, this.bot.y, this.target.x, this.target.y);

    // Phase-specific behavior
    switch (this.phase) {
      case 0: this.phaseNormal(dt, now, dist); break;
      case 1: this.phaseAggressive(dt, now, dist); break;
      case 2: this.phaseBerserk(dt, now, dist); break;
    }
  }

  onPhaseChange(phase) {
    switch (phase) {
      case 1: // Aggressive
        this.bot.speed *= 1.3;
        this.bot.shootInterval = Math.floor(this.bot.shootInterval * 0.7);
        break;
      case 2: // Berserk
        this.bot.speed *= 1.2;
        this.bot.shootInterval = Math.floor(this.bot.shootInterval * 0.6);
        break;
    }
  }

  phaseNormal(dt, now, dist) {
    // Standard behavior: chase and attack
    if (dist > this.attackRange) {
      this.chase(dt);
    } else {
      this.attack(dt, now);
    }
  }

  phaseAggressive(dt, now, dist) {
    // Add charge attacks
    if (now - this.lastChargeTime > this.chargeCooldown && dist > 100 && dist < 500) {
      this.startCharge(now);
    }

    if (this.isCharging) {
      this.executeCharge(dt);
      return;
    }

    if (dist > this.attackRange) {
      this.chase(dt);
    } else {
      this.attack(dt, now);
    }
  }

  phaseBerserk(dt, now, dist) {
    // Charge + burst shot
    if (now - this.lastChargeTime > this.chargeCooldown * 0.6 && dist > 80 && dist < 400) {
      this.startCharge(now);
    }

    if (this.isCharging) {
      this.executeCharge(dt);
      return;
    }

    // Burst attack: fire in 8 directions
    if (now - this.lastBurstTime > this.burstCooldown) {
      this.burstAttack(now);
      this.lastBurstTime = now;
    }

    if (dist > this.attackRange * 0.8) {
      this.chase(dt);
    } else {
      this.attack(dt, now);
      // Erratic movement
      const jitter = Math.sin(now / 200) * this.bot.speed * 0.5;
      this.bot.vx += jitter;
    }
  }

  startCharge(now) {
    if (!this.target) return;
    this.isCharging = true;
    this.lastChargeTime = now;
    this.chargeAngle = Math.atan2(
      this.target.y - this.bot.y,
      this.target.x - this.bot.x
    );
    this.chargeTimeLeft = 800; // 0.8 seconds
  }

  executeCharge(dt) {
    const chargeSpeed = this.bot.speed * 4;
    this.bot.vx = Math.cos(this.chargeAngle) * chargeSpeed;
    this.bot.vy = Math.sin(this.chargeAngle) * chargeSpeed;
    this.bot.rotation = this.chargeAngle;

    this.chargeTimeLeft -= dt * 1000;
    if (this.chargeTimeLeft <= 0) {
      this.isCharging = false;
      this.bot.vx = 0;
      this.bot.vy = 0;
    }

    // Damage players on contact during charge
    for (const [id, player] of this.room.players.entries()) {
      if (!player.alive) continue;
      const dist = distance(this.bot.x, this.bot.y, player.x, player.y);
      if (dist < this.bot.radius + player.radius + 10) {
        player.takeDamage(this.bot.damage * 2);
      }
    }
  }

  burstAttack(now) {
    const directions = 8;
    for (let i = 0; i < directions; i++) {
      const angle = (Math.PI * 2 * i) / directions;
      const proj = new ProjectileEntity(
        this.bot.x + Math.cos(angle) * 30,
        this.bot.y + Math.sin(angle) * 30,
        angle,
        this.bot.id
      );
      proj.damage = this.bot.damage;
      this.room.projectiles.set(proj.id, proj);
    }
  }
}
