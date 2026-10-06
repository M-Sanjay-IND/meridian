import 'dotenv/config';
import { Barrier } from "./barrier.js";
import { claim } from "../../src/booking/claim.js";
import { prisma } from "../../src/db/client.js";

/**
 * Concurrency Verification Runner for Meridian — KT-3 & KT-3b
 * Owned by: DEV D (Verification)
 *
 * Requirements:
 * 1. KT-3: 40 callers × 5 runs with the PostgreSQL constraint deliberately DISABLED.
 *    Proves the single-winner guarantee comes from the advisory lock in claim.ts,
 *    not from the database backstop constraint.
 *    Expected: winners=1, losers=39, storedRows=1 (every single run).
 *
 * 2. KT-3b: 8 callers into a 3-station lab slot (capacity = 3).
 *    Expected: winners=3, losers=5, storedRows=3.
 */

const CALLERS = parseInt(process.env.CONCURRENCY_CALLERS || "40", 10);
const RUNS = parseInt(process.env.CONCURRENCY_RUNS || "5", 10);

async function disableConstraint() {
  console.log("[HARNESS] Deliberately disabling database exclusion constraint no_host_overlap...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "no_host_overlap";`);
}

async function restoreConstraint() {
  console.log("[HARNESS] Restoring database exclusion constraint no_host_overlap with resourcesNeeded = 1 predicate...");
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_host_overlap'
      ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "no_host_overlap"
          EXCLUDE USING gist ("hostId" WITH =, "time_range" WITH &&)
          WHERE ("status" <> 'CANCELLED' AND "resourcesNeeded" = 1);
      END IF;
    END $$;
  `);
}

async function main() {
  console.log("=================================================================");
  console.log(" MERIDIAN CONCURRENCY & ATOMIC CLAIM HARNESS (KT-3 / KT-3b)      ");
  console.log("=================================================================");
  console.log(`Configuration: CALLERS=${CALLERS}, RUNS=${RUNS}`);

  // Test DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    console.error("Database not reachable:", err.message);
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------------------
    // Rule: run KT-3 with the constraint deliberately DISABLED
    // -------------------------------------------------------------------------
    await disableConstraint();

    // -------------------------------------------------------------------------
    // 1. KT-3: Single Slot Claim (40 callers × 5 consecutive runs)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KT-3] Single Slot Claim (${CALLERS} callers × ${RUNS} runs, constraint DISABLED) ---`);

    const slotStart = "2026-10-15T09:00:00.000Z";
    const slotEnd = "2026-10-15T09:45:00.000Z";

    for (let r = 1; r <= RUNS; r++) {
      // Clean previous test bookings on host 7
      await prisma.booking.deleteMany({
        where: {
          hostId: 7,
          slotStart: new Date(slotStart),
        },
      });

      const barrier = new Barrier(CALLERS);

      // Spawn concurrent callers awaiting common barrier
      const callersPromises = Array.from({ length: CALLERS }, async (_, idx) => {
        await barrier.wait(); // Released simultaneously
        try {
          const res = await claim({
            serviceId: 3,
            hostId: 7,
            studentId: 101 + idx,
            start: slotStart,
            end: slotEnd,
          });
          return res.winner ? 201 : 409;
        } catch (e) {
          return 500;
        }
      });

      const results = await Promise.all(callersPromises);
      const winners = results.filter((code) => code === 201).length;
      const losers = results.filter((code) => code === 409).length;

      const storedRows = await prisma.booking.count({
        where: {
          hostId: 7,
          slotStart: new Date(slotStart),
          status: { not: "CANCELLED" },
        },
      });

      console.log(`Run ${r}/${RUNS}: winners=${winners} losers=${losers} storedRows=${storedRows}`);

      if (winners !== 1 || losers !== CALLERS - 1 || storedRows !== 1) {
        throw new Error(
          `KT-3 FAILED on run ${r}: Expected winners=1, losers=${CALLERS - 1}, storedRows=1. ` +
          `Got winners=${winners}, losers=${losers}, storedRows=${storedRows}`
        );
      }
    }

    console.log(">> KT-3 PASSED: Exactly 1 winner across all runs with constraint OFF.");

    // -------------------------------------------------------------------------
    // 2. KT-3b: Multi-station Lab Slot (Capacity = 3, 8 callers)
    // -------------------------------------------------------------------------
    console.log("\n--- [KT-3b] Multi-Station Lab Slot (8 callers, 3 stations) ---");
    {
      const labStart = "2026-10-15T14:00:00.000Z";
      const labEnd = "2026-10-15T15:00:00.000Z";

      await prisma.booking.deleteMany({
        where: {
          resourceId: 2,
          slotStart: new Date(labStart),
        },
      });

      const LAB_CALLERS = 8;
      const labBarrier = new Barrier(LAB_CALLERS);

      const labPromises = Array.from({ length: LAB_CALLERS }, async (_, idx) => {
        await labBarrier.wait();
        try {
          const res = await claim({
            serviceId: 4, // 3-station lab service
            resourceId: 2,
            studentId: 101 + idx,
            start: labStart,
            end: labEnd,
          });
          return res.winner ? 201 : 409;
        } catch (e) {
          return 500;
        }
      });

      const labResults = await Promise.all(labPromises);
      const winners = labResults.filter((code) => code === 201).length;
      const losers = labResults.filter((code) => code === 409).length;

      const storedRows = await prisma.booking.count({
        where: {
          resourceId: 2,
          slotStart: new Date(labStart),
          status: { not: "CANCELLED" },
        },
      });

      console.log(`Lab test: winners=${winners} losers=${losers} storedRows=${storedRows}`);

      if (winners !== 3 || losers !== 5 || storedRows !== 3) {
        throw new Error(
          `KT-3b FAILED: Expected winners=3, losers=5, storedRows=3. ` +
          `Got winners=${winners}, losers=${losers}, storedRows=${storedRows}`
        );
      }

      console.log(">> KT-3b PASSED: Exactly 3 stations admitted out of 8 callers.");
    }

    console.log("\n=================================================================");
    console.log(" ALL CONCURRENCY CHECKS GREEN (KT-3 & KT-3b)                     ");
    console.log("=================================================================");
  } finally {
    // Always restore the exclusion constraint
    await restoreConstraint();
  }
}

main().catch((err) => {
  console.error("Harness error:", err);
  process.exit(1);
});
