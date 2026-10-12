/** A compact amount for tight spots like chart labels: 850, 17.5K, 1.2M. */
export function shortAmount(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number) => String(Number(v.toFixed(1)));
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  if (Number((abs / 1000).toFixed(1)) < 1000) return `${sign}${fmt(abs / 1000)}K`;
  return `${sign}${fmt(abs / 1_000_000)}M`;
}
