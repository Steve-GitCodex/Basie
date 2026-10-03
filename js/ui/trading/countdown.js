export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const part = (n) => String(n).padStart(2, '0');
  return `${part(Math.floor(total / 3600))}:${part(Math.floor((total % 3600) / 60))}:${part(total % 60)}`;
}
