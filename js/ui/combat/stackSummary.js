import { escapeHtml } from '../uiUtils.js';

export function stackSummary(stack) {
  return `${escapeHtml(stack.name)} ×${stack.count} · T${stack.tier} · ${stack.row}`;
}
