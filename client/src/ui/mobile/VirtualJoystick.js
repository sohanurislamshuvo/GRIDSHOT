export class VirtualJoystick {
  constructor(root, options = {}) {
    this.centerX = options.x || 100;
    this.centerY = options.y || window.innerHeight - 100;
    this.baseRadius = options.baseRadius || 50;
    this.thumbRadius = options.thumbRadius || 20;

    this._active = false;
    this._pointerId = null;
    this._direction = { x: 0, y: 0 };
    this._angle = 0;

    // Create DOM elements
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.base.style.cssText = `
      position: fixed;
      left: ${this.centerX - this.baseRadius}px;
      top: ${this.centerY - this.baseRadius}px;
      width: ${this.baseRadius * 2}px;
      height: ${this.baseRadius * 2}px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: 2px solid ${options.baseColor || 'rgba(255,255,255,0.25)'};
      pointer-events: auto;
      touch-action: none;
      z-index: 100;
    `;

    this.thumb = document.createElement('div');
    this.thumb.className = 'joystick-thumb';
    this.thumb.style.cssText = `
      position: fixed;
      left: ${this.centerX - this.thumbRadius}px;
      top: ${this.centerY - this.thumbRadius}px;
      width: ${this.thumbRadius * 2}px;
      height: ${this.thumbRadius * 2}px;
      border-radius: 50%;
      background: ${options.thumbColor || 'rgba(68,136,255,0.5)'};
      pointer-events: none;
      z-index: 101;
    `;

    root.appendChild(this.base);
    root.appendChild(this.thumb);

    // Touch handlers
    this._onTouchStart = (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this._active = true;
      this._pointerId = touch.identifier;
      this._updateThumb(touch.clientX, touch.clientY);
    };

    this._onTouchMove = (e) => {
      if (!this._active) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._pointerId) {
          e.preventDefault();
          this._updateThumb(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    this._onTouchEnd = (e) => {
      if (!this._active) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._pointerId) {
          this._stopTracking();
          break;
        }
      }
    };

    this.base.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  _updateThumb(pointerX, pointerY) {
    const dx = pointerX - this.centerX;
    const dy = pointerY - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let thumbX, thumbY;
    if (dist > this.baseRadius) {
      const ratio = this.baseRadius / dist;
      thumbX = this.centerX + dx * ratio;
      thumbY = this.centerY + dy * ratio;
    } else {
      thumbX = pointerX;
      thumbY = pointerY;
    }

    this.thumb.style.left = `${thumbX - this.thumbRadius}px`;
    this.thumb.style.top = `${thumbY - this.thumbRadius}px`;

    const clampedDist = Math.min(dist, this.baseRadius);
    const normalizedDist = clampedDist / this.baseRadius;

    if (dist > 5) {
      this._direction.x = (dx / dist) * normalizedDist;
      this._direction.y = (dy / dist) * normalizedDist;
      this._angle = Math.atan2(dy, dx);
    } else {
      this._direction.x = 0;
      this._direction.y = 0;
    }
  }

  _stopTracking() {
    this._active = false;
    this._pointerId = null;
    this._direction.x = 0;
    this._direction.y = 0;
    this.thumb.style.left = `${this.centerX - this.thumbRadius}px`;
    this.thumb.style.top = `${this.centerY - this.thumbRadius}px`;
  }

  getDirection() { return { x: this._direction.x, y: this._direction.y }; }
  getAngle() { return this._angle; }
  isActive() { return this._active; }

  destroy() {
    this.base.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    this.base.remove();
    this.thumb.remove();
  }
}
