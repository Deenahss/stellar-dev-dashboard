/**
 * Isolation Forest (approximate) — browser-safe ESM port of `isolation_forest.cjs`.
 *
 * The CommonJS original stays in place for the Node training/scoring scripts
 * (it adds `save`/`load` via `fs`). This module must not import Node built-ins:
 * it is bundled into the dashboard, and `module.createRequire` crashes in the
 * browser.
 */

interface Tree {
  leaf: boolean;
  /** Leaf only: number of samples that reached this node. */
  size?: number;
  /** Internal node only. */
  dim?: number;
  split?: number;
  left?: Tree;
  right?: Tree;
}

/** Average path length of an unsuccessful BST search over n points. */
function c(n: number): number {
  if (n <= 1) return 0;
  const H = Math.log(n - 1) + 0.5772156649 + 1 / (2 * (n - 1));
  return 2 * H - (2 * (n - 1)) / n;
}

function rangeMinMax(data: number[][], dim: number): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const d of data) {
    const v = d[dim];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [mn, mx];
}

function buildTree(data: number[][], heightLimit: number): Tree {
  if (data.length <= 1 || heightLimit <= 0) return { size: data.length, leaf: true };
  const dim = Math.floor(Math.random() * data[0].length);
  const [mn, mx] = rangeMinMax(data, dim);
  if (mn === mx) return { size: data.length, leaf: true };
  const split = Math.random() * (mx - mn) + mn;
  const left: number[][] = [];
  const right: number[][] = [];
  for (const d of data) {
    if (d[dim] < split) left.push(d);
    else right.push(d);
  }
  return { leaf: false, dim, split, left: buildTree(left, heightLimit - 1), right: buildTree(right, heightLimit - 1) };
}

function pathLength(x: number[], tree: Tree | undefined, currentDepth = 0): number {
  if (!tree || tree.leaf) return currentDepth + c(tree ? tree.size : 0);
  if (x[tree.dim] < tree.split) return pathLength(x, tree.left, currentDepth + 1);
  return pathLength(x, tree.right, currentDepth + 1);
}

export class IsolationForest {
  nTrees: number;
  sampleSize: number;
  trees: Tree[] = [];

  constructor(nTrees = 50, sampleSize = 256) {
    this.nTrees = nTrees;
    this.sampleSize = sampleSize;
  }

  /** Fit on an array of numeric feature vectors. */
  fit(data: number[][]): void {
    this.trees = [];
    if (!Array.isArray(data) || data.length === 0) return;
    const heightLimit = Math.ceil(Math.log2(this.sampleSize));
    const size = Math.min(this.sampleSize, data.length);
    for (let i = 0; i < this.nTrees; i++) {
      // Sample without replacement.
      const sample: number[][] = [];
      const idx = new Set<number>();
      while (sample.length < size) {
        const r = Math.floor(Math.random() * data.length);
        if (!idx.has(r)) {
          idx.add(r);
          sample.push(data[r]);
        }
      }
      this.trees.push(buildTree(sample, heightLimit));
    }
  }

  /** Score between 0 (normal) and 1 (anomalous); 0 before `fit`. */
  anomalyScore(x: number[]): number {
    if (this.trees.length === 0) return 0;
    let sum = 0;
    for (const t of this.trees) sum += pathLength(x, t, 0);
    const avg = sum / this.trees.length;
    return Math.pow(2, -avg / c(this.sampleSize));
  }

  /** Alias of `anomalyScore`, used by `src/lib/feePredictor.ts`. */
  score(x: number[]): number {
    return this.anomalyScore(x);
  }

  toJSON() {
    return { nTrees: this.nTrees, sampleSize: this.sampleSize, trees: this.trees };
  }

  /** Rebuild a forest from `toJSON()` output (the format the Node scripts save). */
  static fromJSON(obj: { nTrees: number; sampleSize: number; trees: Tree[] }): IsolationForest {
    const forest = new IsolationForest(obj.nTrees, obj.sampleSize);
    forest.trees = obj.trees;
    return forest;
  }
}
