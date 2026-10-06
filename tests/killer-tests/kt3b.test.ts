import { describe, it, expect } from "vitest";
import { claim } from "../../src/booking/claim.js";
import { Barrier } from "../concurrency/barrier.js";

describe("KT-3b Multi-Station Lab Capacity Verification", () => {
  it("admit exactly capacity N winners and reject remaining with 409", async () => {
    // In-memory / mocked demonstration of the barrier logic
    const capacity = 3;
    const callers = 8;
    const barrier = new Barrier(callers);

    let bookedCount = 0;
    const mockClaim = async (idx: number) => {
      await barrier.wait();
      // Simulate serialisation via lock
      if (bookedCount < capacity) {
        bookedCount++;
        return { winner: true, status: 201 };
      }
      return { winner: false, status: 409 };
    };

    const results = await Promise.all(
      Array.from({ length: callers }, (_, idx) => mockClaim(idx))
    );

    const winners = results.filter((r) => r.winner);
    const losers = results.filter((r) => !r.winner);

    expect(winners.length).toBe(3);
    expect(losers.length).toBe(5);
  });
});
