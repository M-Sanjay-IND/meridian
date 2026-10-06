/**
 * Synchronization barrier for concurrent execution.
 * Releases all N participants simultaneously when the count is reached.
 */
export class Barrier {
  private count: number;
  private readonly total: number;
  private releasePromise: Promise<void>;
  private releaseResolve!: () => void;

  constructor(total: number) {
    this.total = total;
    this.count = 0;
    this.releasePromise = new Promise((resolve) => {
      this.releaseResolve = resolve;
    });
  }

  async wait(): Promise<void> {
    this.count++;
    if (this.count === this.total) {
      this.releaseResolve();
    }
    return this.releasePromise;
  }
}
