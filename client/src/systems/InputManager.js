import * as THREE from 'three';

export class InputManager {
  constructor(canvas, camera, player) {
    this.canvas = canvas;
    this.camera = camera;
    this.player = player;

    this._keys = {};
    this._mouseAngle = 0;
    this._mousePitch = 0;  // For FPP vertical look
    this._shooting = false;
    this._spaceShoot = false;
    this._abilityQueue = null;
    this._justPressed = {};
    this._escape = false;
    this._viewToggle = false;
    this._weaponSwitch = 0;
    this._scrollSwitch = 0;

    // Camera mode (set by Game.js)
    this.cameraMode = 'tpp';
    this._pointerLocked = false;

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
      if (['KeyQ', 'KeyE', 'KeyR', 'KeyF'].includes(e.code)) {
        this._justPressed[e.code] = true;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this._spaceShoot = true;
      }
      if (e.code === 'Escape') {
        this._escape = true;
        // Exit pointer lock on ESC
        if (this._pointerLocked) {
          document.exitPointerLock();
        }
      }
      if (e.code === 'KeyV') this._viewToggle = true;
      // Weapon switch keys 1-5
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        this._weaponSwitch = parseInt(e.code.charAt(5));
      }
    };
    const onKeyUp = (e) => {
      this._keys[e.code] = false;
      if (e.code === 'Space') this._spaceShoot = false;
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Pointer lock change handler
    const onPointerLockChange = () => {
      this._pointerLocked = document.pointerLockElement === this.canvas;
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    this._cleanupFns = [
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
      () => document.removeEventListener('pointerlockchange', onPointerLockChange)
    ];
  }

  _setupMouse() {
    const onMove = (e) => {
      if (!this.player) return;

      if (this.cameraMode === 'fpp' && this._pointerLocked) {
        // FPP: use movementX/Y for mouselook
        const sensitivity = 0.003;
        this._mouseAngle += e.movementX * sensitivity;
        this._mousePitch -= e.movementY * sensitivity;
        // Clamp pitch to prevent flipping
        this._mousePitch = Math.max(-1.0, Math.min(1.0, this._mousePitch));
      } else {
        // TPP / Shoulder: raycaster to ground plane
        this._mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
        this._mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

        this._raycaster.setFromCamera(this._mouseNDC, this.camera);
        this._raycaster.ray.intersectPlane(this._groundPlane, this._worldPoint);

        if (this._worldPoint) {
          this._mouseAngle = Math.atan2(
            this._worldPoint.z - this.player.y,
            this._worldPoint.x - this.player.x
          );
        }
      }
    };

    const onDown = (e) => {
      if (e.button === 0) {
        this._shooting = true;
        // Request pointer lock for FPP mode
        if (this.cameraMode === 'fpp' && !this._pointerLocked) {
          this.canvas.requestPointerLock();
        }
      }
    };
    const onUp = (e) => {
      if (e.button === 0) this._shooting = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);

    const onWheel = (e) => {
      this._scrollSwitch = e.deltaY > 0 ? 1 : -1;
    };

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', onWheel, { passive: true });

    this._cleanupFns.push(
      () => document.removeEventListener('mousemove', onMove),
      () => document.removeEventListener('mousedown', onDown),
      () => document.removeEventListener('mouseup', onUp),
      () => document.removeEventListener('wheel', onWheel)
    );
  }

  /** Called when camera mode changes */
  setCameraMode(mode) {
    this.cameraMode = mode;
    if (mode === 'fpp') {
      // Request pointer lock for FPP
      this.canvas.requestPointerLock();
    } else if (this._pointerLocked) {
      document.exitPointerLock();
    }
  }

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

    const viewToggle = this._viewToggle;
    this._viewToggle = false;

    const weaponSwitch = this._weaponSwitch;
    this._weaponSwitch = 0;
    const scrollSwitch = this._scrollSwitch;
    this._scrollSwitch = 0;

    return {
      up: !!this._keys['KeyW'],
      down: !!this._keys['KeyS'],
      left: !!this._keys['KeyA'],
      right: !!this._keys['KeyD'],
      angle: this._mouseAngle,
      pitch: this._mousePitch,
      shoot: this._shooting || this._spaceShoot,
      ability,
      escape,
      viewToggle,
      weaponSwitch,
      scrollSwitch
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
      pitch: 0,
      shoot: shooting,
      ability,
      escape: false,
      viewToggle: false
    };
  }

  destroy() {
    if (this._pointerLocked) document.exitPointerLock();
    if (this._cleanupFns) {
      for (const fn of this._cleanupFns) fn();
      this._cleanupFns = [];
    }
  }
}
