import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const statusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return apiUnauthorized();

  const { id } = await params;

  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) return apiNotFound("Propuesta");

    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId: proposal.teamId, isCoach: true },
    });
    if (!membership) return apiForbidden(); // Only coaches can change status

    const body = await req.json();
    const { status } = statusSchema.parse(body);

    if (proposal.status === status) {
      return apiError("El estado ya es " + status, 400);
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: { status },
      include: {
        _count: { select: { supporters: true } },
        createdBy: { select: { name: true, image: true } },
        supporters: { select: { userId: true } },
      },
    });

    // Automatically create an Event if APPROVED
    if (status === "APPROVED") {
      await prisma.event.create({
        data: {
          teamId: proposal.teamId,
          title: proposal.title,
          description: proposal.description,
          type: "OTHER", // Default type
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week from now
          createdById: session.user.id,
        },
      });
    }

    await redis.publish(
      "proposal:update",
      JSON.stringify({
        teamId: proposal.teamId,
        proposal: updatedProposal,
      })
    );

    return apiSuccess(updatedProposal);
  } catch (err) {
    if (err instanceof z.ZodError) return handleZodError(err);
    return handleUnknownError(err, `PUT /api/proposals/${id}/status`);
  }
}
