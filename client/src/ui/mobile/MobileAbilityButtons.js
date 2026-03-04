export class MobileAbilityButtons {
  constructor(root, onAbility) {
    this.onAbility = onAbility;
    this.el = document.createElement('div');
    this.el.className = 'mobile-abilities';
    this.el.style.cssText = `
      position: fixed;
      bottom: 180px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 100;
      pointer-events: auto;
    `;

    const abilities = [
      { key: 'dash', label: 'DASH', color: '#ffffff' },
      { key: 'shield', label: 'SHIELD', color: '#44aaff' },
      { key: 'radar', label: 'RADAR', color: '#ffaa00' },
      { key: 'heal', label: 'HEAL', color: '#44ff88' }
    ];

    for (const ab of abilities) {
      const btn = document.createElement('button');
      btn.className = 'mobile-ability-btn';
      btn.textContent = ab.label;
      btn.style.cssText = `
        padding: 10px 16px;
        background: rgba(34,34,34,0.8);
        border: 2px solid ${ab.color};
        border-radius: 6px;
        color: #fff;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        touch-action: none;
      `;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.onAbility(ab.key);
        btn.style.background = 'rgba(68,68,68,0.9)';
        setTimeout(() => { btn.style.background = 'rgba(34,34,34,0.8)'; }, 150);
      }, { passive: false });
      this.el.appendChild(btn);
    }

    root.appendChild(this.el);
  }

  destroy() {
    this.el.remove();
  }
}
