import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;
  const userId = session.user.id;

  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) return apiNotFound("Propuesta");

    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId: proposal.teamId, leftAt: null },
    });
    if (!membership) return apiForbidden();

    const existingSupport = await prisma.proposalSupport.findFirst({
      where: { proposalId: id, userId },
    });

    let isSupported = false;
    if (existingSupport) {
      await prisma.proposalSupport.delete({ where: { id: existingSupport.id } });
    } else {
      await prisma.proposalSupport.create({
        data: { proposalId: id, userId },
      });
      isSupported = true;
    }

    const updatedProposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        _count: { select: { supporters: true } },
        createdBy: { select: { name: true, image: true } },
        supporters: { select: { userId: true } },
      },
    });

    return apiSuccess({ isSupported, proposal: updatedProposal });
  } catch (err) {
    return handleUnknownError(err, `POST /api/proposals/${id}/support`);
  }
}
