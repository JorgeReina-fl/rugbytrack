/**
 * Concurrency test for the atomic vote transaction.
 * Fires N concurrent "vote" operations from the same userId on the same poll
 * and asserts exactly 1 PollVote row survives.
 *
 * Run with: DATABASE_URL=... pnpm tsx scripts/test-vote-concurrency.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const POLL_ID   = "test-poll-cc";
const OPTION_ID = "test-opt-a";
const USER_ID   = "test-user-cc";
const CONCURRENCY = 8;

class SameOptionError extends Error {}

async function castVote(): Promise<"ok" | "duplicate" | "p2002"> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.pollVote.findFirst({
        where: { userId: USER_ID, option: { pollId: POLL_ID } },
      });

      if (existing) {
        if (existing.pollOptionId === OPTION_ID) throw new SameOptionError();
        await tx.pollVote.delete({ where: { id: existing.id } });
      }

      await tx.pollVote.create({
        data: { pollOptionId: OPTION_ID, userId: USER_ID },
      });
    });
    return "ok";
  } catch (err) {
    if (err instanceof SameOptionError) return "duplicate";
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) return "p2002";
    throw err;
  }
}

async function main() {
  // Clean slate
  await prisma.pollVote.deleteMany({ where: { userId: USER_ID } });
  console.log(`Firing ${CONCURRENCY} concurrent vote requests…`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () => castVote())
  );

  const summary = { ok: 0, duplicate: 0, p2002: 0, error: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") summary[r.value]++;
    else { summary.error++; console.error("Rejected:", r.reason); }
  }

  const finalCount = await prisma.pollVote.count({ where: { userId: USER_ID } });

  console.log("\nResults per request:", summary);
  console.log(`Final PollVote rows for user: ${finalCount}`);

  if (finalCount === 1) {
    console.log("✓ PASS — exactly 1 vote in DB, no duplicate");
  } else {
    console.error(`✗ FAIL — expected 1 vote, found ${finalCount}`);
    process.exitCode = 1;
  }

  await prisma.pollVote.deleteMany({ where: { userId: USER_ID } });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
