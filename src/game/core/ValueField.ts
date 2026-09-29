/**
 * Coarse "food map" used by bots: for every cell it tracks the total value of standing
 * objects, bucketed by the hole radius required to swallow them. A bot of radius r can
 * then read how many points it could actually eat in any area in O(buckets).
 */
export const VALUE_BUCKETS: readonly number[] = (() => {
  const buckets: number[] = [];
  for (let t = 0.4; t < 22; t *= 1.15) buckets.push(t);
  buckets.push(Number.POSITIVE_INFINITY);
  return buckets;
})();

const bucketOf = (requiredRadius: number) => {
  for (let i = 0; i < VALUE_BUCKETS.length; i++) if (requiredRadius <= VALUE_BUCKETS[i]) return i;
  return VALUE_BUCKETS.length - 1;
};

export interface ValueItem {
  x: number;
  z: number;
  valueCell: number;
  readonly kind: { requiredRadius: number; value: number };
}

export class ValueField {
  readonly cols: number;
  readonly cellCount: number;
  private readonly values: Float32Array;
  private readonly bucketCount = VALUE_BUCKETS.length;

  constructor(
    readonly half: number,
    readonly cellSize: number,
  ) {
    this.cols = Math.ceil((half * 2) / cellSize);
    this.cellCount = this.cols * this.cols;
    this.values = new Float32Array(this.cellCount * this.bucketCount);
  }

  cellAt(x: number, z: number) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((x + this.half) / this.cellSize)));
    const cz = Math.min(this.cols - 1, Math.max(0, Math.floor((z + this.half) / this.cellSize)));
    return cz * this.cols + cx;
  }

  cellCenterX(cell: number) {
    return (cell % this.cols + 0.5) * this.cellSize - this.half;
  }

  cellCenterZ(cell: number) {
    return (Math.floor(cell / this.cols) + 0.5) * this.cellSize - this.half;
  }

  add(item: ValueItem) {
    item.valueCell = this.cellAt(item.x, item.z);
    this.values[item.valueCell * this.bucketCount + bucketOf(item.kind.requiredRadius)] += item.kind.value;
  }

  remove(item: ValueItem) {
    if (item.valueCell < 0) return;
    const i = item.valueCell * this.bucketCount + bucketOf(item.kind.requiredRadius);
    this.values[i] = Math.max(0, this.values[i] - item.kind.value);
    item.valueCell = -1;
  }

  move(item: ValueItem) {
    if (item.valueCell < 0) return;
    const cell = this.cellAt(item.x, item.z);
    if (cell === item.valueCell) return;
    this.remove(item);
    this.add(item);
  }

  /** Total value in a cell that a hole of `radius` can swallow. */
  edibleValue(cell: number, radius: number) {
    let sum = 0;
    const base = cell * this.bucketCount;
    for (let b = 0; b < this.bucketCount && VALUE_BUCKETS[b] <= radius; b++) sum += this.values[base + b];
    return sum;
  }
}
