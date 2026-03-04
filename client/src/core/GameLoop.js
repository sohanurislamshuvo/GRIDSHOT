export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this._running = false;
    this._lastTime = 0;
    this._rafId = null;
  }

  start() {
    this._running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    if (!this._running) return;
    const now = performance.now();
    const dt = Math.min((now - this._lastTime) / 1000, 0.05); // Cap at 50ms
    this._lastTime = now;
    this.updateFn(dt);
    this.renderFn();
    this._rafId = requestAnimationFrame(() => this._tick());
  }
}
