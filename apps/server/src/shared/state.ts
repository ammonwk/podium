import { laneManager } from './lane-manager.js';

export function resetState(): void {
  laneManager.resetAll();
  console.log('[STATE] All conversation lanes cleared');
}
