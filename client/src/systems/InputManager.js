import * as THREE from 'three';

export class InputManager {
  constructor(canvas, camera, player) {
    this.canvas = canvas;
    this.camera = camera;
    this.player = player;

    this._keys = {};
    this._mouseAngle = 0;
    this._shooting = false;
    this._abilityQueue = null;
    this._justPressed = {};
    this._escape = false;

    // Mobile detection
    this.isMobile = ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.innerWidth < 1024 && 'orientation' in window);

    // Raycaster for mouse-to-world
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._mouseNDC = new THREE.Vector2();
    this._worldPoint = new THREE.Vector3();

    // Mobile joystick references (set by UIManager)
    this.moveJoystick = null;
    this.aimJoystick = null;

    if (!this.isMobile) {
      this._setupKeyboard();
      this._setupMouse();
    }
  }

  _setupKeyboard() {
    const onKeyDown = (e) => {
      this._keys[e.code] = true;
      // Track just-pressed for abilities
      if (['KeyQ', 'KeyE', 'KeyR', 'KeyF'].includes(e.code)) {
        this._justPressed[e.code] = true;
      }
      if (e.code === 'Escape') this._escape = true;
    };
    const onKeyUp = (e) => {
      this._keys[e.code] = false;
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    this._cleanupFns = [
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp)
    ];
  }

  _setupMouse() {
    const onMove = (e) => {
      if (!this.player) return;
      // Convert mouse to NDC
      this._mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // Raycast to ground plane
      this._raycaster.setFromCamera(this._mouseNDC, this.camera);
      this._raycaster.ray.intersectPlane(this._groundPlane, this._worldPoint);

      if (this._worldPoint) {
        // worldPoint.x = game x, worldPoint.z = game y
        this._mouseAngle = Math.atan2(
          this._worldPoint.z - this.player.y,
          this._worldPoint.x - this.player.x
        );
      }
    };

    const onDown = (e) => {
      if (e.button === 0) this._shooting = true;
    };
    const onUp = (e) => {
      if (e.button === 0) this._shooting = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._cleanupFns.push(
      () => document.removeEventListener('mousemove', onMove),
      () => document.removeEventListener('mousedown', onDown),
      () => document.removeEventListener('mouseup', onUp)
    );
  }

  /** Called by mobile UI ability buttons */
  triggerAbility(name) {
    this._abilityQueue = name;
  }

  getInput() {
    if (this.isMobile) return this._getMobileInput();
    return this._getDesktopInput();
  }

  _getDesktopInput() {
    let ability = null;
    if (this._justPressed['KeyQ']) { ability = 'dash'; this._justPressed['KeyQ'] = false; }
    else if (this._justPressed['KeyE']) { ability = 'shield'; this._justPressed['KeyE'] = false; }
    else if (this._justPressed['KeyR']) { ability = 'radar'; this._justPressed['KeyR'] = false; }
    else if (this._justPressed['KeyF']) { ability = 'heal'; this._justPressed['KeyF'] = false; }

    const escape = this._escape;
    this._escape = false;

    return {
      up: !!this._keys['KeyW'],
      down: !!this._keys['KeyS'],
      left: !!this._keys['KeyA'],
      right: !!this._keys['KeyD'],
      angle: this._mouseAngle,
      shoot: this._shooting,
      ability,
      escape
    };
  }

  _getMobileInput() {
    const threshold = 0.3;
    let moveX = 0, moveY = 0;
    if (this.moveJoystick) {
      const dir = this.moveJoystick.getDirection();
      moveX = dir.x;
      moveY = dir.y;
    }

    let aimAngle = this._mouseAngle;
    let shooting = false;
    if (this.aimJoystick && this.aimJoystick.isActive()) {
      aimAngle = this.aimJoystick.getAngle();
      shooting = true;
    }

    const ability = this._abilityQueue;
    this._abilityQueue = null;

    return {
      up: moveY < -threshold,
      down: moveY > threshold,
      left: moveX < -threshold,
      right: moveX > threshold,
      angle: aimAngle,
      shoot: shooting,
      ability,
      escape: false
    };
  }

  destroy() {
    if (this._cleanupFns) {
      for (const fn of this._cleanupFns) fn();
      this._cleanupFns = [];
    }
  }
}
