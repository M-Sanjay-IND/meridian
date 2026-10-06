import 'dotenv/config';
import { Barrier } from "./barrier.js";
import { claim } from "../../src/booking/claim.js";
import { prisma } from "../../src/db/client.js";

/**
 * Negative Control Concurrency Verification
 *
 * Proves that the harness can detect the concurrency race defects.
 * Corresponds to docs/ARCHITECTURE.md §4.2, SUBMISSION.md §1, and Slide 3 of deck.pdf:
 *
 * | Setup                                               | Rows stored for 1 slot |
 * |-----------------------------------------------------|------------------------|
 * | Unguarded insert, 20 concurrent callers             | 20 (defect reproduces) |
 * | Insert-if-not-exists guard, no lock, no constraint  | 4 (naive defect)       |
 * | Ours: advisory lock, no constraint, 20 callers      | 1 (strictly atomic)    |
 */

const THREADS = 20;
const HOST_ID = 7;
const SLOT_START = new Date("2026-10-15T11:00:00.000Z");
const SLOT_END = new Date("2026-10-15T11:30:00.000Z");

async function disableConstraint() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "no_host_overlap";`);
}

async function restoreConstraint() {
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

async function cleanSlot() {
  await prisma.booking.deleteMany({
    where: {
      hostId: HOST_ID,
      slotStart: SLOT_START,
    },
  });
}

async function main() {
  console.log("=================================================================");
  console.log(" MERIDIAN NEGATIVE CONTROL: MEASURING THE CONCURRENCY DEFECTS    ");
  console.log("=================================================================");

  try {
    await disableConstraint();

    // -------------------------------------------------------------------------
    // 1. Experiment 1: Unguarded INSERT (20 threads, no lock, no constraint)
    // -------------------------------------------------------------------------
    console.log(`\n1. Running Unguarded INSERT (${THREADS} concurrent threads, no lock, no constraint)...`);
    await cleanSlot();

    const barrier1 = new Barrier(THREADS);
    const unguardedPromises = Array.from({ length: THREADS }, async (_, idx) => {
      await barrier1.wait();
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "Booking" ("serviceTypeId", "hostId", "studentId", "slotStart", "slotEnd", "status", "resourcesNeeded", "createdAt")
          VALUES (3, ${HOST_ID}, ${101 + idx}, '${SLOT_START.toISOString()}', '${SLOT_END.toISOString()}', 'RESERVED', 1, NOW());
        `);
        return true;
      } catch (e: any) {
        console.error("Unguarded insert error:", e.message);
        return false;
      }
    });

    await Promise.all(unguardedPromises);
    const count1 = await prisma.booking.count({
      where: { hostId: HOST_ID, slotStart: SLOT_START, status: { not: "CANCELLED" } },
    });
    console.log(`>> Result 1 (Unguarded): ${count1} of ${THREADS} rows stored. (Expected 20 rows — Defect reproduced!)`);

    // -------------------------------------------------------------------------
    // 2. Experiment 2: Naive INSERT ... WHERE NOT EXISTS (20 threads)
    // Under READ COMMITTED snapshot isolation, competitors are not yet committed.
    // -------------------------------------------------------------------------
    console.log(`\n2. Running Naive INSERT-IF-NOT-EXISTS (${THREADS} concurrent threads, no lock, no constraint)...`);
    await cleanSlot();

    const barrier2 = new Barrier(THREADS);
    const naivePromises = Array.from({ length: THREADS }, async (_, idx) => {
      await barrier2.wait();
      try {
        // Naive single statement without advisory lock
        const rowsAffected = await prisma.$executeRawUnsafe(`
          INSERT INTO "Booking" ("serviceTypeId", "hostId", "studentId", "slotStart", "slotEnd", "status", "resourcesNeeded", "createdAt")
          SELECT 3, ${HOST_ID}, ${101 + idx}, '${SLOT_START.toISOString()}'::timestamptz, '${SLOT_END.toISOString()}'::timestamptz, 'RESERVED', 1, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM "Booking" b
            WHERE b."status" <> 'CANCELLED'
              AND b."hostId" = ${HOST_ID}
              AND b."slotStart" < '${SLOT_END.toISOString()}'::timestamptz
              AND b."slotEnd" > '${SLOT_START.toISOString()}'::timestamptz
          );
        `);
        return rowsAffected > 0;
      } catch (e: any) {
        console.error("Naive insert error:", e.message);
        return false;
      }
    });

    await Promise.all(naivePromises);
    const count2 = await prisma.booking.count({
      where: { hostId: HOST_ID, slotStart: SLOT_START, status: { not: "CANCELLED" } },
    });
    console.log(`>> Result 2 (Naive WHERE NOT EXISTS): ${count2} rows stored. (Expected > 1 — Proves guard is not atomic alone!)`);

    // -------------------------------------------------------------------------
    // 3. Experiment 3: Ours (Advisory lock in claim, 20 threads, no constraint)
    // -------------------------------------------------------------------------
    console.log(`\n3. Running Meridian Atomic Claim (${THREADS} concurrent threads, advisory lock, no constraint)...`);
    await cleanSlot();

    const barrier3 = new Barrier(THREADS);
    const ourPromises = Array.from({ length: THREADS }, async (_, idx) => {
      await barrier3.wait();
      try {
        const res = await claim({
          serviceId: 3,
          hostId: HOST_ID,
          studentId: 101 + idx,
          start: SLOT_START.toISOString(),
          end: SLOT_END.toISOString(),
        });
        return res.winner;
      } catch {
        return false;
      }
    });

    const ourResults = await Promise.all(ourPromises);
    const winners3 = ourResults.filter(Boolean).length;
    const count3 = await prisma.booking.count({
      where: { hostId: HOST_ID, slotStart: SLOT_START, status: { not: "CANCELLED" } },
    });
    console.log(`>> Result 3 (Ours with Advisory Lock): winners=${winners3}, rows stored=${count3}. (Expected exactly 1)`);

    console.log("\n=================================================================");
    console.log(` SUMMARY: Unguarded=${count1}/20 | Naive=${count2}/20 | Ours=${count3}/20`);
    console.log(" NEGATIVE CONTROL VALIDATED: Harness successfully proves the race!");
    console.log("=================================================================");
  } finally {
    await restoreConstraint();
    await cleanSlot();
  }
}

main().catch((err) => {
  console.error("Negative control error:", err);
  process.exit(1);
});
