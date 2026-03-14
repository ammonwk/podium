import type { LLMMessage } from '@apm/shared';

export type ConversationType = 'demo' | 'caller';

export interface ConversationLane {
  id: string;
  type: ConversationType;
  history: LLMMessage[];
  queue: Promise<void>;
  queueDepth: number;
}

export const DEMO_LANE_ID = 'demo';

class LaneManager {
  private lanes = new Map<string, ConversationLane>();

  getOrCreate(id: string, type: ConversationType): ConversationLane {
    let lane = this.lanes.get(id);
    if (!lane) {
      lane = {
        id,
        type,
        history: [],
        queue: Promise.resolve(),
        queueDepth: 0,
      };
      this.lanes.set(id, lane);
      console.log(`[LANE] Created ${type} lane: ${id}`);
    }
    return lane;
  }

  get(id: string): ConversationLane | undefined {
    return this.lanes.get(id);
  }

  enqueue(id: string, type: ConversationType, fn: () => Promise<void>): void {
    const lane = this.getOrCreate(id, type);
    lane.queueDepth++;

    lane.queue = lane.queue
      .then(() => fn())
      .catch((err) => {
        console.error(`[LANE:${id}] Error in queued task:`, err);
      })
      .finally(() => {
        lane.queueDepth--;
      });
  }

  resetAll(): void {
    this.lanes.clear();
    console.log('[LANE] All lanes cleared');
  }

  getAllLanes(): ConversationLane[] {
    return Array.from(this.lanes.values());
  }
}

export const laneManager = new LaneManager();
