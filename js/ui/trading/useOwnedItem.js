import { useItemFlow } from '../items/useItemFlow.js';

export function useOwnedItem(itemId, anchorEl, systems) {
  return useItemFlow({ systems, itemId, anchorEl });
}
