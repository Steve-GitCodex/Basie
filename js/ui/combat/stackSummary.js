import { escapeHtml } from '../uiUtils.js';

export function stackSummary(stack) {
  return `${escapeHtml(stack.name)} ×${stack.count} · T${stack.tier} · ${stack.row}`;
}

export function waveSummary(wave, index) {
  return `Wave ${index + 1}: ${escapeHtml(wave.name)} — ${wave.stacks.map(stackSummary).join(', ')}`;
}
