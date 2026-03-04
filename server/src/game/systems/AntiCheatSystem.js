import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { distance } from 'shadow-arena-shared/utils/Vector2.js';

export class AntiCheatSystem {
  constructor() {
    this.playerData = new Map(); // socketId -> tracking data
    this.suspicionScores = new Map();
    this.kickThreshold = 100;
    this.flagThreshold = 50;
  }

  registerPlayer(socketId) {
    this.playerData.set(socketId, {
      lastPosition: null,
      lastUpdateTime: null,
      shotTimestamps: [],
      abilityTimestamps: [],
      inputCount: 0,
      lastInputCountReset: Date.now()
    });
    this.suspicionScores.set(socketId, 0);
  }

  removePlayer(socketId) {
    this.playerData.delete(socketId);
    this.suspicionScores.delete(socketId);
  }

  validateMovement(socketId, player, input) {
    const data = this.playerData.get(socketId);
    if (!data) return { valid: true };

    const now = Date.now();

    // Rate limit inputs (max 70/sec with tolerance)
    data.inputCount++;
    if (now - data.lastInputCountReset > 1000) {
      if (data.inputCount > 70) {
        this.addSuspicion(socketId, 5, 'input_flood');
      }
      data.inputCount = 0;
      data.lastInputCountReset = now;
    }

    // Speed check
    if (data.lastPosition && data.lastUpdateTime) {
      const dt = (now - data.lastUpdateTime) / 1000;
      if (dt > 0) {
        const dist = distance(data.lastPosition.x, data.lastPosition.y, player.x, player.y);
        const speed = dist / dt;
        const maxAllowed = GameConfig.PLAYER_SPEED * 1.5; // 50% tolerance for lag

        if (speed > maxAllowed && dist > 10) {
          this.addSuspicion(socketId, 10, 'speed_hack');
          // Snap back
          player.x = data.lastPosition.x;
          player.y = data.lastPosition.y;
          return { valid: false, reason: 'speed_violation', correctedPosition: data.lastPosition };
        }
      }
    }

    data.lastPosition = { x: player.x, y: player.y };
    data.lastUpdateTime = now;

    return { valid: true };
  }

  validateShoot(socketId) {
    const data = this.playerData.get(socketId);
    if (!data) return { valid: true };

    const now = Date.now();
    data.shotTimestamps.push(now);

    // Keep last 20 shots
    if (data.shotTimestamps.length > 20) {
      data.shotTimestamps.shift();
    }

    // Check fire rate
    if (data.shotTimestamps.length >= 2) {
      const last = data.shotTimestamps[data.shotTimestamps.length - 1];
      const prev = data.shotTimestamps[data.shotTimestamps.length - 2];
      const interval = last - prev;
      const minInterval = (1000 / GameConfig.FIRE_RATE) - 50; // 50ms tolerance

      if (interval < minInterval) {
        this.addSuspicion(socketId, 5, 'rapid_fire');
        return { valid: false, reason: 'fire_rate_exceeded' };
      }
    }

    // Check shots per second (last 10 shots)
    if (data.shotTimestamps.length >= 10) {
      const windowStart = data.shotTimestamps[data.shotTimestamps.length - 10];
      const windowEnd = data.shotTimestamps[data.shotTimestamps.length - 1];
      const windowTime = (windowEnd - windowStart) / 1000;
      const shotsPerSec = 10 / windowTime;

      if (shotsPerSec > GameConfig.FIRE_RATE * 1.5) {
        this.addSuspicion(socketId, 15, 'sustained_rapid_fire');
        return { valid: false, reason: 'sustained_fire_rate' };
      }
    }

    return { valid: true };
  }

  validateAbility(socketId, abilityName) {
    const data = this.playerData.get(socketId);
    if (!data) return { valid: true };

    const now = Date.now();
    data.abilityTimestamps.push(now);

    // Max 5 abilities per second
    const recentAbilities = data.abilityTimestamps.filter(t => now - t < 1000);
    if (recentAbilities.length > 5) {
      this.addSuspicion(socketId, 20, 'ability_spam');
      return { valid: false, reason: 'ability_rate_exceeded' };
    }

    // Keep only last minute
    data.abilityTimestamps = data.abilityTimestamps.filter(t => now - t < 60000);

    return { valid: true };
  }

  addSuspicion(socketId, amount, reason) {
    const current = this.suspicionScores.get(socketId) || 0;
    const newScore = current + amount;
    this.suspicionScores.set(socketId, newScore);

    console.warn(`[AntiCheat] Player ${socketId}: +${amount} suspicion (${reason}). Total: ${newScore}`);

    return newScore;
  }

  getSuspicionLevel(socketId) {
    const score = this.suspicionScores.get(socketId) || 0;
    if (score >= this.kickThreshold) return 'kick';
    if (score >= this.flagThreshold) return 'flagged';
    return 'clean';
  }

  // Decay suspicion over time (call periodically)
  decayAll() {
    for (const [socketId, score] of this.suspicionScores.entries()) {
      if (score > 0) {
        this.suspicionScores.set(socketId, Math.max(0, score - 1));
      }
    }
  }
}
