export interface GridItem {
  x: number;
  z: number;
  cell: number;
  cellSlot: number;
}

/** Uniform bucket grid with O(1) insert/remove/move for fast neighbourhood queries. */
export class SpatialGrid<T extends GridItem> {
  readonly cols: number;
  private readonly cells: T[][];

  constructor(
    private readonly half: number,
    private readonly cellSize: number,
  ) {
    this.cols = Math.ceil((half * 2) / cellSize) + 1;
    this.cells = Array.from({ length: this.cols * this.cols }, () => []);
  }

  private coord(v: number) {
    const c = Math.floor((v + this.half) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private indexOf(x: number, z: number) {
    return this.coord(z) * this.cols + this.coord(x);
  }

  insert(item: T) {
    const index = this.indexOf(item.x, item.z);
    const cell = this.cells[index];
    item.cell = index;
    item.cellSlot = cell.length;
    cell.push(item);
  }

  remove(item: T) {
    if (item.cell < 0) return;
    const cell = this.cells[item.cell];
    const last = cell.pop()!;
    if (last !== item) {
      cell[item.cellSlot] = last;
      last.cellSlot = item.cellSlot;
    }
    item.cell = -1;
    item.cellSlot = -1;
  }

  /** Call after changing an item's position. */
  move(item: T) {
    const index = this.indexOf(item.x, item.z);
    if (index === item.cell) return;
    this.remove(item);
    this.insert(item);
  }

  forEachInRadius(x: number, z: number, radius: number, fn: (item: T) => void) {
    const c0 = this.coord(x - radius);
    const c1 = this.coord(x + radius);
    const r0 = this.coord(z - radius);
    const r1 = this.coord(z + radius);
    for (let r = r0; r <= r1; r++) {
      const row = r * this.cols;
      for (let c = c0; c <= c1; c++) {
        const cell = this.cells[row + c];
        // Iterate backwards so callbacks may safely remove the current item.
        for (let i = cell.length - 1; i >= 0; i--) {
          if (i < cell.length) fn(cell[i]);
        }
      }
    }
  }
}
