/**
 * Spatial Hash Grid for O(1) average-case collision lookups.
 * Divides the world into cells and tracks which entities are in each cell.
 * Reduces collision detection from O(n*m) to O(n*k) where k is average entities per cell.
 */
export class SpatialHash {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.cells = new Map(); // "cx,cy" -> Set of entities
  }

  _key(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  _getCellCoords(x, y) {
    return {
      cx: Math.floor(x / this.cellSize),
      cy: Math.floor(y / this.cellSize)
    };
  }

  /**
   * Clear all entities from the grid.
   * Call this at the start of each frame before re-inserting entities.
   */
  clear() {
    this.cells.clear();
  }

  /**
   * Insert an entity into the grid based on its x, y position.
   * @param {Object} entity - Must have x and y properties
   */
  insert(entity) {
    const key = this._key(entity.x, entity.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key).add(entity);
    entity._spatialKey = key; // Cache for fast removal/update
  }

  /**
   * Remove an entity from the grid.
   * @param {Object} entity - The entity to remove
   */
  remove(entity) {
    if (entity._spatialKey && this.cells.has(entity._spatialKey)) {
      this.cells.get(entity._spatialKey).delete(entity);
    }
    entity._spatialKey = null;
  }

  /**
   * Update an entity's position in the grid.
   * Only re-inserts if the entity moved to a different cell.
   * @param {Object} entity - The entity to update
   */
  update(entity) {
    const newKey = this._key(entity.x, entity.y);
    if (entity._spatialKey !== newKey) {
      this.remove(entity);
      this.insert(entity);
    }
  }

  /**
   * Get all entities near a point.
   * Checks a 3x3 grid of cells centered on the point (or larger if radius > cellSize).
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} radius - Search radius (default 0 = just the cell)
   * @returns {Array} Array of entities in nearby cells
   */
  getNearby(x, y, radius = 0) {
    const results = [];
    const { cx, cy } = this._getCellCoords(x, y);
    const cellRadius = Math.ceil(radius / this.cellSize) + 1;

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            results.push(entity);
          }
        }
      }
    }
    return results;
  }

  /**
   * Get entities that might collide with a moving object.
   * Alias for getNearby with radius.
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} radius - Collision check radius
   * @returns {Array} Potential collision candidates
   */
  getPotentialCollisions(x, y, radius) {
    return this.getNearby(x, y, radius);
  }

  /**
   * Get statistics about the grid usage.
   * Useful for debugging and tuning cellSize.
   * @returns {Object} Stats including cell count and max entities per cell
   */
  getStats() {
    let totalEntities = 0;
    let maxPerCell = 0;
    for (const cell of this.cells.values()) {
      totalEntities += cell.size;
      if (cell.size > maxPerCell) maxPerCell = cell.size;
    }
    return {
      cellCount: this.cells.size,
      totalEntities,
      maxPerCell,
      avgPerCell: this.cells.size > 0 ? totalEntities / this.cells.size : 0
    };
  }
}
