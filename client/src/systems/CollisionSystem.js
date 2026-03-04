import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class CollisionSystem {
  constructor() {
    this.wallGrid = null;
    this.tileSize = GameConfig.TILE_SIZE;
  }

  setWallGrid(grid, tileSize) {
    this.wallGrid = grid;
    this.tileSize = tileSize;
  }

  /** Check if a point is inside a wall tile */
  isInWall(x, y) {
    if (!this.wallGrid) return false;
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    if (ty < 0 || ty >= this.wallGrid.length) return true;
    if (tx < 0 || tx >= this.wallGrid[0].length) return true;
    return this.wallGrid[ty][tx];
  }

  /** Resolve circle-vs-wall-grid collision for an entity with {x, y, radius} */
  resolveEntity(entity) {
    if (!this.wallGrid) return;
    const radius = entity.radius || 16;

    // Clamp to world bounds
    entity.x = Math.max(radius, Math.min(GameConfig.WORLD_WIDTH - radius, entity.x));
    entity.y = Math.max(radius, Math.min(GameConfig.WORLD_HEIGHT - radius, entity.y));

    // Check 3x3 tile neighborhood
    const tx = Math.floor(entity.x / this.tileSize);
    const ty = Math.floor(entity.y / this.tileSize);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = tx + dx;
        const cy = ty + dy;
        if (cy < 0 || cy >= this.wallGrid.length) continue;
        if (cx < 0 || cx >= this.wallGrid[0].length) continue;
        if (!this.wallGrid[cy][cx]) continue;

        // Wall AABB
        const wallLeft = cx * this.tileSize;
        const wallTop = cy * this.tileSize;
        const wallRight = wallLeft + this.tileSize;
        const wallBottom = wallTop + this.tileSize;

        // Closest point on AABB to circle center
        const closestX = Math.max(wallLeft, Math.min(entity.x, wallRight));
        const closestY = Math.max(wallTop, Math.min(entity.y, wallBottom));

        const distX = entity.x - closestX;
        const distY = entity.y - closestY;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < radius) {
          // Push entity out
          const overlap = radius - dist;
          if (dist > 0.001) {
            entity.x += (distX / dist) * overlap;
            entity.y += (distY / dist) * overlap;
          } else {
            // Entity center is exactly on the wall edge, push out in a default direction
            entity.x += overlap;
          }
        }
      }
    }
  }

  /** Simple circle-vs-circle check */
  checkCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < (a.radius + b.radius);
  }
}
