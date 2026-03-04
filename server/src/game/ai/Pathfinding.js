import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(item, priority) {
    const entry = { item, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority < this.items[i].priority) {
        this.items.splice(i, 0, entry);
        added = true;
        break;
      }
    }
    if (!added) this.items.push(entry);
  }

  dequeue() {
    return this.items.shift()?.item;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

export class Pathfinding {
  constructor(wallGrid) {
    this.grid = wallGrid;
    this.rows = wallGrid.length;
    this.cols = wallGrid[0]?.length || 0;
    this.tileSize = GameConfig.TILE_SIZE;
  }

  findPath(startWorld, goalWorld) {
    const start = this.worldToGrid(startWorld.x, startWorld.y);
    const goal = this.worldToGrid(goalWorld.x, goalWorld.y);

    // Validate
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(goal.x, goal.y)) {
      return null;
    }

    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const gScore = new Map();
    const cameFrom = new Map();

    const startKey = `${start.x},${start.y}`;
    const goalKey = `${goal.x},${goal.y}`;

    gScore.set(startKey, 0);
    openSet.enqueue(start, this.heuristic(start, goal));

    const directions = [
      { x: 0, y: -1, cost: 1 },   // N
      { x: 1, y: 0, cost: 1 },    // E
      { x: 0, y: 1, cost: 1 },    // S
      { x: -1, y: 0, cost: 1 },   // W
      { x: 1, y: -1, cost: 1.414 }, // NE
      { x: 1, y: 1, cost: 1.414 },  // SE
      { x: -1, y: 1, cost: 1.414 }, // SW
      { x: -1, y: -1, cost: 1.414 } // NW
    ];

    let iterations = 0;
    const maxIterations = 500; // Prevent infinite loops

    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;
      const current = openSet.dequeue();
      const currentKey = `${current.x},${current.y}`;

      if (currentKey === goalKey) {
        return this.reconstructPath(cameFrom, current);
      }

      closedSet.add(currentKey);

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const neighborKey = `${nx},${ny}`;

        if (closedSet.has(neighborKey)) continue;
        if (!this.isWalkable(nx, ny)) continue;

        // For diagonal, check cardinal neighbors
        if (dir.x !== 0 && dir.y !== 0) {
          if (!this.isWalkable(current.x + dir.x, current.y) ||
              !this.isWalkable(current.x, current.y + dir.y)) {
            continue;
          }
        }

        const tentativeG = (gScore.get(currentKey) || 0) + dir.cost;

        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const fScore = tentativeG + this.heuristic({ x: nx, y: ny }, goal);
          openSet.enqueue({ x: nx, y: ny }, fScore);
        }
      }
    }

    return null; // No path found
  }

  heuristic(a, b) {
    // Octile distance
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  }

  reconstructPath(cameFrom, current) {
    const path = [this.gridToWorld(current.x, current.y)];
    let currentKey = `${current.x},${current.y}`;

    while (cameFrom.has(currentKey)) {
      const prev = cameFrom.get(currentKey);
      path.unshift(this.gridToWorld(prev.x, prev.y));
      currentKey = `${prev.x},${prev.y}`;
    }

    return this.smoothPath(path);
  }

  smoothPath(path) {
    if (path.length <= 2) return path;

    // Simple path smoothing: skip waypoints with clear line of sight
    const smoothed = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;

      for (let i = path.length - 1; i > current + 1; i--) {
        if (this.hasLineOfSight(path[current], path[i])) {
          farthest = i;
          break;
        }
      }

      smoothed.push(path[farthest]);
      current = farthest;
    }

    return smoothed;
  }

  hasLineOfSight(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / (this.tileSize / 2));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      const gx = Math.floor(x / this.tileSize);
      const gy = Math.floor(y / this.tileSize);

      if (!this.isWalkable(gx, gy)) return false;
    }

    return true;
  }

  isWalkable(gx, gy) {
    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return false;
    return this.grid[gy][gx] === 0;
  }

  worldToGrid(x, y) {
    return {
      x: Math.floor(x / this.tileSize),
      y: Math.floor(y / this.tileSize)
    };
  }

  gridToWorld(gx, gy) {
    return {
      x: (gx + 0.5) * this.tileSize,
      y: (gy + 0.5) * this.tileSize
    };
  }
}
