import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendProposalNotification } from "@/lib/resend";

interface Params {
  params: Promise<{ id: string }>;
}

const createProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: id, leftAt: null },
    });
    if (!membership) return apiForbidden();

    const proposals = await prisma.proposal.findMany({
      where: { teamId: id },
      include: {
        _count: { select: { supporters: true } },
        createdBy: { select: { name: true, image: true } },
        supporters: { select: { userId: true } },
      },
      orderBy: [
        { status: "asc" }, // PENDING first
        { createdAt: "desc" }
      ],
    });

    return apiSuccess(proposals);
  } catch (err) {
    return handleUnknownError(err, `GET /api/teams/${id}/proposals`);
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id, leftAt: null },
  });
  if (!membership) return apiForbidden(); // Any member can create a proposal

  try {
    const body = await req.json();
    const data = createProposalSchema.parse(body);

    const proposal = await prisma.proposal.create({
      data: {
        teamId: id,
        title: data.title,
        description: data.description,
        createdById: session.user.id,
      },
      include: {
        _count: { select: { supporters: true } },
        createdBy: { select: { name: true, image: true } },
        supporters: { select: { userId: true } },
      },
    });

    const response = apiSuccess(proposal);

    // Fire-and-forget: notificar a miembros activos, excluyendo al autor y a quienes desactivaron notifyProposals
    prisma.team
      .findUnique({
        where: { id },
        select: {
          name: true,
          members: {
            where: { leftAt: null, userId: { not: session.user.id } },
            select: { user: { select: { email: true, name: true, notifyProposals: true } } },
          },
        },
      })
      .then((team) => {
        if (!team) return;
        const recipients = team.members.map((m) => m.user).filter((u) => u.notifyProposals);
        return sendProposalNotification({
          members: recipients,
          teamName: team.name,
          teamId: id,
          proposalTitle: proposal.title,
          authorName: session.user.name ?? "Un compañero",
        });
      })
      .catch((err) => logger.error({ err, teamId: id, proposalId: proposal.id }, "Failed to dispatch proposal notification"));

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) return handleZodError(err);
    return handleUnknownError(err, `POST /api/teams/${id}/proposals`);
  }
}
