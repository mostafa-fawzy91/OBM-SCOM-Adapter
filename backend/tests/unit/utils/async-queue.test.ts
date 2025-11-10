import { AsyncQueue } from '@/utils/async-queue';

describe('AsyncQueue', () => {
  it('limits concurrent executions', async () => {
    const queue = new AsyncQueue(2);
    let active = 0;
    let maxActive = 0;
    const results: number[] = [];

    const enqueue = (id: number, duration: number) =>
      new Promise<number>((resolve) => {
        queue.add(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, duration));
          active -= 1;
          results.push(id);
          resolve(id);
        });
      });

    await Promise.all([enqueue(1, 50), enqueue(2, 50), enqueue(3, 10), enqueue(4, 10)]);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results.sort()).toEqual([1, 2, 3, 4]);
  });
});

