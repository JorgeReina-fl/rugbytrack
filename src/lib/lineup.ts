import type { MatchFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export * from "./lineup-core";

/** Formato del último MATCH/TOURNAMENT del equipo con formato; SEVENS si no hay ninguno. */
export async function defaultFormatForTeam(teamId: string): Promise<MatchFormat> {
  const last = await prisma.event.findFirst({
    where: { teamId, type: { in: ["MATCH", "TOURNAMENT"] }, format: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { format: true },
  });
  return last?.format ?? "SEVENS";
}
