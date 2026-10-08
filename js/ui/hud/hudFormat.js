const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});

export function compact(n) {
  const floored = Math.floor(n);
  if (floored < 1000) {
    return String(floored);
  }
  return compactFormatter.format(floored);
}

export function fillState(amount, cap) {
  if (!Number.isFinite(cap) || cap <= 0) {
    return 'ok';
  }
  if (amount >= cap) {
    return 'full';
  }
  if (amount >= cap * 0.9) {
    return 'near';
  }
  return 'ok';
}

export function fillRatio(amount, cap) {
  if (!Number.isFinite(cap) || cap <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, amount / cap));
}

export function timeToFull(amount, cap, perSec) {
  if (!Number.isFinite(cap) || perSec <= 0) {
    return null;
  }
  if (amount >= cap) {
    return 0;
  }
  return (cap - amount) / perSec;
}

export function formatDuration(sec) {
  let total = Number.isNaN(sec) ? 0 : Math.max(0, Math.floor(sec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}
