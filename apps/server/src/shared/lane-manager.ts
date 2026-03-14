import type { LLMMessage } from '@apm/shared';
import { ConversationModel } from './db.js';

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

  // Persist a lane's history to MongoDB
  async persist(laneId: string): Promise<void> {
    const lane = this.lanes.get(laneId);
    if (!lane) return;

    const now = new Date().toISOString();
    try {
      await ConversationModel.updateOne(
        { lane_id: laneId },
        {
          $set: {
            lane_type: lane.type,
            history: lane.history,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        { upsert: true },
      );
    } catch (err: any) {
      console.error(`[LANE:${laneId}] Failed to persist:`, err.message);
    }
  }

  // Load all conversations from MongoDB into memory
  async loadAll(): Promise<void> {
    try {
      const docs = await ConversationModel.find().lean();
      for (const doc of docs) {
        const lane: ConversationLane = {
          id: doc.lane_id,
          type: doc.lane_type,
          history: doc.history as LLMMessage[],
          queue: Promise.resolve(),
          queueDepth: 0,
        };
        this.lanes.set(doc.lane_id, lane);
      }
      console.log(`[LANE] Loaded ${docs.length} conversations from MongoDB`);
    } catch (err: any) {
      console.error('[LANE] Failed to load conversations:', err.message);
    }
  }
}

export const laneManager = new LaneManager();
