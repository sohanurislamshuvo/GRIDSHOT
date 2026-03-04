import Phaser from 'phaser';

export class DamageNumbers {
  constructor(scene) {
    this.scene = scene;
  }

  show(x, y, amount, isHeal = false) {
    const color = isHeal ? '#44ff44' : '#ff4444';
    const prefix = isHeal ? '+' : '-';

    const text = this.scene.add.text(x, y - 20, `${prefix}${amount}`, {
      fontSize: '16px',
      fill: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(150);

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }
}
