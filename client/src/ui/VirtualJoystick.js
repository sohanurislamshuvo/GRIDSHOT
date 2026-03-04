import Phaser from 'phaser';

export class VirtualJoystick {
  constructor(scene, x, y, options = {}) {
    this.scene = scene;

    // Configuration
    this.baseRadius = options.baseRadius || 50;
    this.thumbRadius = options.thumbRadius || 20;
    this.baseColor = options.baseColor || 0xffffff;
    this.thumbColor = options.thumbColor || 0x4488ff;
    this.baseAlpha = options.baseAlpha || 0.15;
    this.thumbAlpha = options.thumbAlpha || 0.4;

    // State
    this._active = false;
    this._pointerId = null;
    this._direction = { x: 0, y: 0 };
    this._angle = 0;

    // Base circle (static position)
    this.base = scene.add.graphics();
    this.base.setScrollFactor(0);
    this.base.setDepth(500);
    this.base.fillStyle(this.baseColor, this.baseAlpha);
    this.base.fillCircle(0, 0, this.baseRadius);
    this.base.lineStyle(2, this.baseColor, this.baseAlpha + 0.1);
    this.base.strokeCircle(0, 0, this.baseRadius);
    this.base.setPosition(x, y);

    // Thumb circle (moves with finger)
    this.thumb = scene.add.graphics();
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(501);
    this.thumb.fillStyle(this.thumbColor, this.thumbAlpha);
    this.thumb.fillCircle(0, 0, this.thumbRadius);
    this.thumb.setPosition(x, y);

    // Store center position
    this.centerX = x;
    this.centerY = y;

    // Create an invisible interactive zone over the base
    this.hitZone = scene.add.circle(x, y, this.baseRadius + 20);
    this.hitZone.setScrollFactor(0);
    this.hitZone.setDepth(499);
    this.hitZone.setAlpha(0.001); // Nearly invisible but interactive
    this.hitZone.setInteractive();

    // Touch handlers
    this.hitZone.on('pointerdown', (pointer) => {
      this._startTracking(pointer);
    });

    scene.input.on('pointermove', (pointer) => {
      if (this._active && pointer.id === this._pointerId) {
        this._updateThumb(pointer);
      }
    });

    scene.input.on('pointerup', (pointer) => {
      if (this._active && pointer.id === this._pointerId) {
        this._stopTracking();
      }
    });
  }

  _startTracking(pointer) {
    this._active = true;
    this._pointerId = pointer.id;
    this._updateThumb(pointer);
  }

  _updateThumb(pointer) {
    // Calculate offset from center
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to base radius
    let thumbX, thumbY;
    if (dist > this.baseRadius) {
      const ratio = this.baseRadius / dist;
      thumbX = this.centerX + dx * ratio;
      thumbY = this.centerY + dy * ratio;
    } else {
      thumbX = pointer.x;
      thumbY = pointer.y;
    }

    this.thumb.setPosition(thumbX, thumbY);

    // Normalize direction
    const clampedDist = Math.min(dist, this.baseRadius);
    const normalizedDist = clampedDist / this.baseRadius;

    if (dist > 5) { // Dead zone
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

    // Reset thumb to center
    this.thumb.setPosition(this.centerX, this.centerY);
  }

  /** Returns { x, y } normalized -1 to 1 */
  getDirection() {
    return { x: this._direction.x, y: this._direction.y };
  }

  /** Returns angle in radians from center to thumb */
  getAngle() {
    return this._angle;
  }

  /** Whether finger is currently touching this joystick */
  isActive() {
    return this._active;
  }

  setVisible(visible) {
    this.base.setVisible(visible);
    this.thumb.setVisible(visible);
    this.hitZone.setVisible(visible);
    if (!visible) {
      this._stopTracking();
    }
  }

  destroy() {
    this.base.destroy();
    this.thumb.destroy();
    this.hitZone.destroy();
  }
}
