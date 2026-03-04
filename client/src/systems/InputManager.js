export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    this.mouseAngle = 0;
    this.shooting = false;
    this.abilityPressed = null;

    this.setupKeys();
    this.setupMouse();
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

  updateMouseAngle(pointer) {
    const player = this.scene.player;
    if (!player || !player.sprite) return;

    // Get world position of pointer
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    this.mouseAngle = Phaser.Math.Angle.Between(
      player.sprite.x, player.sprite.y,
      worldPoint.x, worldPoint.y
    );
  }

  getInput() {
    // Check ability key presses (just pressed, not held)
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

  destroy() {
    this.scene.input.keyboard.removeAllKeys(true);
    this.scene.input.removeAllListeners();
  }
}

// Need Phaser to be available for keyboard keycodes
import Phaser from 'phaser';
