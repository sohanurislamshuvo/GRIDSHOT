export class AchievementToast {
  constructor(root) {
    this.container = document.createElement('div');
    this.container.className = 'achievement-toast-container';
    root.appendChild(this.container);
  }

  show(data) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="toast-icon">${data.icon || '\u2B50'}</div>
      <div class="toast-body">
        <div class="toast-title">ACHIEVEMENT UNLOCKED</div>
        <div class="toast-name">${data.name}</div>
        <div class="toast-desc">${data.description}</div>
        <div class="toast-xp">+${data.xpReward} XP</div>
      </div>
    `;
    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto-remove after 5s
    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }
}
