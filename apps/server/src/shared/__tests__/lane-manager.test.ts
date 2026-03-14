import { describe, it, expect, beforeEach } from 'vitest';
import { laneManager, DEMO_LANE_ID } from '../lane-manager.js';

beforeEach(() => {
  laneManager.resetAll();
});

describe('LaneManager', () => {
  it('getOrCreate returns a lane with empty history', () => {
    const lane = laneManager.getOrCreate('demo', 'demo');
    expect(lane.id).toBe('demo');
    expect(lane.type).toBe('demo');
    expect(lane.history).toEqual([]);
    expect(lane.queueDepth).toBe(0);
  });

  it('getOrCreate twice with same ID returns same lane', () => {
    const lane1 = laneManager.getOrCreate('demo', 'demo');
    const lane2 = laneManager.getOrCreate('demo', 'demo');
    expect(lane1).toBe(lane2);
  });

  it('different phone numbers get different lanes', () => {
    const laneA = laneManager.getOrCreate('+18005551111', 'caller');
    const laneB = laneManager.getOrCreate('+18005552222', 'caller');
    expect(laneA).not.toBe(laneB);
    expect(laneA.id).toBe('+18005551111');
    expect(laneB.id).toBe('+18005552222');
  });

  it('pushing to one lane history does not affect another', () => {
    const laneA = laneManager.getOrCreate('+18005551111', 'caller');
    const laneB = laneManager.getOrCreate('+18005552222', 'caller');

    laneA.history.push({ role: 'user', content: 'hello from A' });

    expect(laneA.history).toHaveLength(1);
    expect(laneB.history).toHaveLength(0);
  });

  it('resetAll clears all lanes', () => {
    laneManager.getOrCreate('demo', 'demo');
    laneManager.getOrCreate('+18005551111', 'caller');
    expect(laneManager.getAllLanes()).toHaveLength(2);

    laneManager.resetAll();
    expect(laneManager.getAllLanes()).toHaveLength(0);
    expect(laneManager.get('demo')).toBeUndefined();
  });

  it('two tasks in the same lane run sequentially', async () => {
    const order: number[] = [];

    laneManager.enqueue(DEMO_LANE_ID, 'demo', async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });

    laneManager.enqueue(DEMO_LANE_ID, 'demo', async () => {
      order.push(2);
    });

    // Wait for the lane's queue to drain
    const lane = laneManager.get(DEMO_LANE_ID)!;
    await lane.queue;

    expect(order).toEqual([1, 2]);
  });

  it('tasks in different lanes run concurrently', async () => {
    const order: string[] = [];

    // Lane A: slow task (50ms)
    laneManager.enqueue('+1111', 'caller', async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push('A');
    });

    // Lane B: fast task (no delay)
    laneManager.enqueue('+2222', 'caller', async () => {
      order.push('B');
    });

    // Wait for both lanes to drain
    const laneA = laneManager.get('+1111')!;
    const laneB = laneManager.get('+2222')!;
    await Promise.all([laneA.queue, laneB.queue]);

    // B should finish before A since they run concurrently
    expect(order).toEqual(['B', 'A']);
  });
});
