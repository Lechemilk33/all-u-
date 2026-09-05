/** Formatting only. Nothing in this module invents, rounds away, or defaults a value. */

export function gp(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}b`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}m`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

export function exact(n: number): string {
  return n.toLocaleString('en-US');
}

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

export function age(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function ageClass(seconds: number): string {
  if (seconds <= 120) return 'age-fresh';
  if (seconds <= 600) return 'age-mid';
  return 'age-old';
}

export function zClass(z: number): string {
  const a = Math.abs(z);
  if (a >= 3) return 'z-extreme';
  if (a >= 1.5) return 'z-wide';
  return 'z-normal';
}

export function clock(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', { hour12: false });
}
