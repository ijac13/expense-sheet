/**
 * Where each donut slice's label goes: in a column on the slice's side (left
 * or right of the ring), spread vertically so no two labels overlap, with a
 * leader line from the slice to its label (078).
 */
export interface LabelSpot {
  side: 1 | -1;              // 1 = right column, -1 = left column
  y: number;                 // label's vertical centre
  line: [number, number][];  // leader polyline: slice edge → elbow → label
  textX: number;
}

export interface DonutGeometry {
  cx: number;
  cy: number;
  ringOuter: number; // outer edge of the ring
  column: number;    // distance from centre to where the leader line ends
  gap: number;       // minimum vertical distance between two labels' centres
  minY: number;
  maxY: number;
}

/** `fractions[i]` is slice i's middle, as a fraction of the way round from 12 o'clock, clockwise. */
export function layoutLabels(fractions: number[], g: DonutGeometry): LabelSpot[] {
  const base = fractions.map((f, i) => {
    const angle = f * 2 * Math.PI - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side: 1 | -1 = cos >= 0 ? 1 : -1;
    return { i, cos, sin, side, desired: g.cy + (g.ringOuter + 18) * sin };
  });

  const ys = new Array<number>(fractions.length);
  for (const side of [1, -1] as const) {
    const items = base.filter((b) => b.side === side).sort((a, b) => a.desired - b.desired);
    const placed = items.map((b) => Math.min(g.maxY, Math.max(g.minY, b.desired)));
    for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + g.gap);
    if (placed.length > 0 && placed[placed.length - 1] > g.maxY) {
      placed[placed.length - 1] = g.maxY;
      for (let k = placed.length - 2; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - g.gap);
    }
    items.forEach((b, k) => { ys[b.i] = placed[k]; });
  }

  return base.map((b) => {
    const y = ys[b.i];
    const start: [number, number] = [g.cx + (g.ringOuter + 2) * b.cos, g.cy + (g.ringOuter + 2) * b.sin];
    const elbowR = g.ringOuter + 12;
    const elbow: [number, number] = [g.cx + elbowR * b.cos, y];
    const end: [number, number] = [g.cx + b.side * g.column, y];
    return { side: b.side, y, line: [start, elbow, end], textX: end[0] + b.side * 4 };
  });
}
