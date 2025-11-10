type Task = () => Promise<void>;

export class AsyncQueue {
  private readonly concurrency: number;
  private activeCount = 0;
  private readonly queue: Task[] = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  add(task: Task): void {
    this.queue.push(task);
    void this.process();
  }

  private async process(): Promise<void> {
    if (this.activeCount >= this.concurrency) {
      return;
    }
    const task = this.queue.shift();
    if (!task) {
      return;
    }
    this.activeCount += 1;
    try {
      await task();
    } finally {
      this.activeCount -= 1;
      if (this.queue.length > 0) {
        void this.process();
      }
    }
  }
}

