import { BotState, BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { distance, randomInRange, normalize } from 'shadow-arena-shared/utils/Vector2.js';
import { ProjectileEntity } from 'shadow-arena-shared/entities/ProjectileEntity.js';

export class BotAI {
  constructor(bot, room) {
    this.bot = bot;
    this.room = room;
    this.stateTimer = 0;
    this.target = null;
    this.detectionRange = GameConfig.BOT_DETECTION_RANGE;
    this.attackRange = GameConfig.BOT_ATTACK_RANGE;

    // Nearest player cache - reduces lookups by 80%
    this._cachedTarget = null;
    this._cacheFrame = 0;
    this._cacheInterval = 5; // Re-check every 5 frames

    // Pick initial waypoint
    this.pickNewWaypoint();
  }

  update(dt, now) {
    if (!this.bot.alive) return;

    // Find nearest player target (cached for performance)
    this._cacheFrame++;
    if (this._cacheFrame >= this._cacheInterval || !this._cachedTarget || !this._cachedTarget.alive) {
      this._cachedTarget = this.room.getNearestPlayer(this.bot.x, this.bot.y, this.bot.id);
      this._cacheFrame = 0;
    }
    this.target = this._cachedTarget;
    const targetDist = this.target ? distance(this.bot.x, this.bot.y, this.target.x, this.target.y) : Infinity;

    // FSM transitions
    const healthPct = this.bot.health / this.bot.maxHealth;

    if (healthPct < GameConfig.BOT_FLEE_HEALTH_PERCENT && this.target) {
      this.bot.state = BotState.FLEE;
    } else if (targetDist <= this.attackRange) {
      this.bot.state = BotState.ATTACK;
    } else if (targetDist <= this.detectionRange) {
      this.bot.state = BotState.CHASE;
    } else if (this.bot.state === BotState.FLEE && healthPct > 0.4) {
      this.bot.state = BotState.PATROL;
    } else if (this.bot.state !== BotState.PATROL && targetDist > this.detectionRange) {
      this.bot.state = BotState.PATROL;
    }

    // Execute current state
    switch (this.bot.state) {
      case BotState.IDLE:
      case BotState.PATROL:
        this.patrol(dt);
        break;
      case BotState.CHASE:
        this.chase(dt);
        break;
      case BotState.ATTACK:
        this.attack(dt, now);
        break;
      case BotState.FLEE:
        this.flee(dt);
        break;
    }
  }

  patrol(dt) {
    const dist = distance(this.bot.x, this.bot.y, this.bot.waypointX, this.bot.waypointY);
    if (dist < 20) {
      this.pickNewWaypoint();
    }

    const angle = Math.atan2(
      this.bot.waypointY - this.bot.y,
      this.bot.waypointX - this.bot.x
    );

    this.bot.vx = Math.cos(angle) * this.bot.speed * 0.5;
    this.bot.vy = Math.sin(angle) * this.bot.speed * 0.5;
    this.bot.rotation = angle;
  }

  chase(dt) {
    if (!this.target) {
      this.bot.state = BotState.PATROL;
      return;
    }

    const angle = Math.atan2(
      this.target.y - this.bot.y,
      this.target.x - this.bot.x
    );

    this.bot.vx = Math.cos(angle) * this.bot.speed;
    this.bot.vy = Math.sin(angle) * this.bot.speed;
    this.bot.rotation = angle;
  }

  attack(dt, now) {
    if (!this.target) {
      this.bot.state = BotState.PATROL;
      return;
    }

    const angle = Math.atan2(
      this.target.y - this.bot.y,
      this.target.x - this.bot.x
    );

    this.bot.rotation = angle;

    // Strafe while attacking
    const strafeAngle = angle + Math.PI / 2;
    const strafeSpeed = this.bot.speed * 0.3;
    this.bot.vx = Math.cos(strafeAngle) * strafeSpeed;
    this.bot.vy = Math.sin(strafeAngle) * strafeSpeed;

    // Shoot
    if (this.bot.canShoot(now)) {
      this.bot.lastShotTime = now;
      this.shoot(angle);
    }
  }

  flee(dt) {
    if (!this.target) {
      this.bot.state = BotState.PATROL;
      return;
    }

    // Run away from target
    const angle = Math.atan2(
      this.bot.y - this.target.y,
      this.bot.x - this.target.x
    );

    this.bot.vx = Math.cos(angle) * this.bot.speed;
    this.bot.vy = Math.sin(angle) * this.bot.speed;
    this.bot.rotation = angle + Math.PI;
  }

  shoot(angle) {
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;
    const proj = new ProjectileEntity(
      this.bot.x + offsetX,
      this.bot.y + offsetY,
      angle,
      this.bot.id
    );
    proj.damage = this.bot.damage;
    this.room.projectiles.set(proj.id, proj);
  }

  pickNewWaypoint() {
    const margin = 100;
    const mc = this.room.mapConfig;
    this.bot.waypointX = randomInRange(margin, mc.width - margin);
    this.bot.waypointY = randomInRange(margin, mc.height - margin);
  }
}
