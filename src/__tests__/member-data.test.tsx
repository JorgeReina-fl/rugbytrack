/**
 * @jest-environment node
 */

import { removeMemberData } from "@/lib/member-data";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Thread } from "@/models/Thread";
import { Comment } from "@/models/Comment";

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/mongoose", () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/models/Thread", () => ({ Thread: { distinct: jest.fn(), updateMany: jest.fn() } }));
jest.mock("@/models/Comment", () => ({ Comment: { updateMany: jest.fn() } }));
jest.mock("@/lib/prisma", () => {
  const del = () => ({ deleteMany: jest.fn((a: unknown) => ({ op: "delete", a, count: 2 })) });
  return {
    prisma: {
      attendance: del(),
      callup: del(),
      rpeEntry: { ...del(), updateMany: jest.fn((a: unknown) => ({ op: "update", a, count: 1 })) },
      discomfort: del(),
      pollVote: del(),
      proposalSupport: del(),
      playerEmbedding: del(),
      teamMember: { update: jest.fn((a: unknown) => ({ op: "member", a })) },
      // Cualquier otro modelo (event, poll, proposal, user…) no existe en el mock: tocarlo lanzaría
      $transaction: jest.fn((ops: any[]) => Promise.resolve(ops.map((o) => (o.count !== undefined ? { count: o.count } : o)))),
    },
  };
});

const db = prisma as any;
const TEAM = "team-1";
const USER = "user-1";

beforeEach(() => {
  jest.clearAllMocks();
  (Thread.distinct as jest.Mock).mockResolvedValue(["t1", "t2"]);
  (Thread.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });
  (Comment.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 5 });
});

const run = () => removeMemberData({ teamId: TEAM, userId: USER, membershipId: "m1" });

describe("removeMemberData", () => {
  test("borra solo los datos de ESE equipo y de ese usuario", async () => {
    await run();
    const inEvents = { userId: USER, event: { teamId: TEAM } };
    expect(db.attendance.deleteMany).toHaveBeenCalledWith({ where: inEvents });
    expect(db.callup.deleteMany).toHaveBeenCalledWith({ where: inEvents });
    expect(db.rpeEntry.deleteMany).toHaveBeenCalledWith({ where: inEvents });
    expect(db.discomfort.deleteMany).toHaveBeenCalledWith({ where: inEvents });
    expect(db.pollVote.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, option: { poll: { teamId: TEAM } } } });
    expect(db.proposalSupport.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, proposal: { teamId: TEAM } } });
    expect(db.playerEmbedding.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, teamId: TEAM } });
  });

  test("conserva lo creado para el equipo y el usuario: solo toca las tablas de datos personales y la membresía", async () => {
    await run();
    // El mock no tiene event/poll/proposal/user: si se hubieran usado, habría lanzado. Y la membresía no se borra.
    expect(db.teamMember.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { leftAt: expect.any(Date), isCoach: false },
    });
    expect(db.event).toBeUndefined();
    expect(db.user).toBeUndefined();
  });

  test("RpeEntry.recordedById pasa a null donde anotó RPE de otros en eventos de ese equipo", async () => {
    await run();
    expect(db.rpeEntry.updateMany).toHaveBeenCalledWith({
      where: { recordedById: USER, userId: { not: USER }, event: { teamId: TEAM } },
      data: { recordedById: null },
    });
  });

  test("anonimiza hilos y comentarios del equipo (y solo los del autor)", async () => {
    await run();
    expect(Thread.updateMany).toHaveBeenCalledWith(
      { teamId: TEAM, authorId: USER },
      { $set: { authorId: "ex-member", authorName: "Ex-miembro" } }
    );
    expect(Thread.distinct).toHaveBeenCalledWith("_id", { teamId: TEAM }); // comentarios solo de hilos de ESTE equipo
    expect(Comment.updateMany).toHaveBeenCalledWith(
      { threadId: { $in: ["t1", "t2"] }, authorId: USER },
      { $set: { authorId: "ex-member", authorName: "Ex-miembro" } }
    );
  });

  test("todo lo de Prisma, junto con leftAt/isCoach, va en UNA transacción; extraOps incluidos", async () => {
    const extra = { op: "promote" };
    await removeMemberData({ teamId: TEAM, userId: USER, membershipId: "m1", extraOps: [extra as any] });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const ops = db.$transaction.mock.calls[0][0];
    expect(ops[0]).toBe(extra);
    expect(ops[ops.length - 1].op).toBe("member");
    expect(ops).toHaveLength(10);
  });

  test("devuelve recuentos y el log lleva solo teamId y recuentos (sin userId)", async () => {
    const counts = await run();
    expect(counts).toEqual({
      attendances: 2, callups: 2, rpeEntries: 2, discomforts: 2, pollVotes: 2, proposalSupports: 2,
      embeddings: 2, rpeUnlinked: 1, forumThreads: 3, forumComments: 5,
    });
    const [logged, msg] = (logger.info as jest.Mock).mock.calls[0];
    expect(Object.keys(logged).sort()).toEqual(["counts", "teamId"]);
    expect(msg).toBe("Member data removed on team exit");
    expect(JSON.stringify(logged)).not.toMatch(/Ex-miembro|authorName|bodyArea|note/);
  });

  test("si falla Mongo → error y no se toca Prisma (el usuario sigue en el equipo)", async () => {
    (Thread.updateMany as jest.Mock).mockRejectedValue(new Error("mongo down"));
    await expect(run()).rejects.toThrow("mongo down");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.teamMember.update).not.toHaveBeenCalled();
  });

  test("si falla la transacción de Prisma → el error se propaga (rollback atómico); el foro ya anonimizado se acepta", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(run()).rejects.toThrow("db down");
    expect(Thread.updateMany).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("es idempotente en Mongo: repetir no cambia nada más (updateMany sobre autor ya anonimizado no casa)", async () => {
    (Thread.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 0 });
    (Comment.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 0 });
    const counts = await run();
    expect(counts.forumThreads).toBe(0);
    expect(counts.forumComments).toBe(0);
  });
});
