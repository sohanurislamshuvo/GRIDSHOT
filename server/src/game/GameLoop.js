import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class GameLoop {
  constructor(room) {
    this.room = room;
    this.tickRate = GameConfig.TICK_RATE;
    this.networkRate = GameConfig.NETWORK_SEND_RATE;
    this.tickInterval = 1000 / this.tickRate;
    this.networkInterval = 1000 / this.networkRate;
    this.running = false;
    this.timer = null;
    this.lastTick = 0;
    this.lastNetworkSend = 0;
    this.tickCount = 0;
  }

  start() {
    this.running = true;
    this.lastTick = Date.now();
    this.lastNetworkSend = Date.now();

    this.timer = setInterval(() => {
      this.tick();
    }, this.tickInterval);
  }

  tick() {
    if (!this.running) return;

    const now = Date.now();
    const dt = (now - this.lastTick) / 1000; // Convert to seconds
    this.lastTick = now;
    this.tickCount++;

    // Update game state
    this.room.update(dt, now);

    // Broadcast state at network rate
    if (now - this.lastNetworkSend >= this.networkInterval) {
      this.room.broadcastState();
      this.lastNetworkSend = now;
    }
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
