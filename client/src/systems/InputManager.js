import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { VirtualJoystick } from '../ui/VirtualJoystick.js';

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    this.mouseAngle = 0;
    this.shooting = false;
    this.abilityPressed = null;

    // Mobile detection (with screen-width fallback for emulators)
    this.isMobile = ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.innerWidth < 1024 && 'orientation' in window);

    // Touch ability trigger (set by UIScene ability buttons)
    this._touchAbility = null;

    if (this.isMobile) {
      this.setupMobileControls();
    } else {
      this.setupKeys();
      this.setupMouse();
    }
  }

  setupKeys() {
    this.keys = this.scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.Q,
      shield: Phaser.Input.Keyboard.KeyCodes.E,
      radar: Phaser.Input.Keyboard.KeyCodes.R,
      heal: Phaser.Input.Keyboard.KeyCodes.F,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC
    });
  }

  setupMouse() {
    this.scene.input.on('pointermove', (pointer) => {
      this.updateMouseAngle(pointer);
    });

    this.scene.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) {
        this.shooting = true;
      }
    });

    this.scene.input.on('pointerup', (pointer) => {
      if (!pointer.leftButtonDown()) {
        this.shooting = false;
      }
    });
  }

  setupMobileControls() {
    // Use actual screen dimensions (works with EXPAND scale mode)
    const vw = this.scene.scale.width;
    const vh = this.scene.scale.height;

    // Left joystick (movement) - bottom-left
    this.moveJoystick = new VirtualJoystick(this.scene, 100, vh - 100, {
      baseRadius: 50,
      thumbRadius: 20,
      baseColor: 0xffffff,
      thumbColor: 0x4488ff,
      baseAlpha: 0.25,
      thumbAlpha: 0.5,
    });

    // Right joystick (aim+shoot) - bottom-right
    this.aimJoystick = new VirtualJoystick(this.scene, vw - 100, vh - 100, {
      baseRadius: 50,
      thumbRadius: 20,
      baseColor: 0xffffff,
      thumbColor: 0xff4444,
      baseAlpha: 0.25,
      thumbAlpha: 0.5,
    });
  }

  updateMouseAngle(pointer) {
    const player = this.scene.player;
    if (!player || !player.sprite) return;

    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.mouseAngle = Phaser.Math.Angle.Between(
      player.sprite.x, player.sprite.y,
      worldPoint.x, worldPoint.y
    );
  }

  /** Called by UIScene ability buttons on mobile */
  triggerAbility(name) {
    this._touchAbility = name;
  }

  getInput() {
    if (this.isMobile) {
      return this.getMobileInput();
    }
    return this.getDesktopInput();
  }

  getDesktopInput() {
    let ability = null;
    if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) ability = 'dash';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.shield)) ability = 'shield';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.radar)) ability = 'radar';
    else if (Phaser.Input.Keyboard.JustDown(this.keys.heal)) ability = 'heal';

    return {
      up: this.keys.up.isDown,
      down: this.keys.down.isDown,
      left: this.keys.left.isDown,
      right: this.keys.right.isDown,
      angle: this.mouseAngle,
      shoot: this.shooting,
      ability: ability
    };
  }

  getMobileInput() {
    // Movement from left joystick
    const moveDir = this.moveJoystick.getDirection();
    const threshold = 0.3;

    // Aim from right joystick
    const aimActive = this.aimJoystick.isActive();
    const aimAngle = aimActive ? this.aimJoystick.getAngle() : this.mouseAngle;

    // Read and consume touch ability
    const ability = this._touchAbility;
    this._touchAbility = null;

    return {
      up: moveDir.y < -threshold,
      down: moveDir.y > threshold,
      left: moveDir.x < -threshold,
      right: moveDir.x > threshold,
      angle: aimAngle,
      shoot: aimActive,
      ability: ability
    };
  }

  destroy() {
    if (!this.isMobile) {
      this.scene.input.keyboard.removeAllKeys(true);
    }
    this.scene.input.removeAllListeners();
    if (this.moveJoystick) this.moveJoystick.destroy();
    if (this.aimJoystick) this.aimJoystick.destroy();
  }
}
