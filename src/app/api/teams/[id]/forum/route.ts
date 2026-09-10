import "server-only";
import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendThreadNotification } from "@/lib/resend";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";

const threadSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres").max(100),
  content: z.string().min(10, "El contenido debe tener al menos 10 caracteres").max(5000),
  imageUrl: z.string().url().optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, leftAt: null },
    });

    if (!membership) return apiForbidden();

    await dbConnect();
    const threads = await Thread.find({ teamId }).sort({ createdAt: -1 }).lean();

    return apiSuccess(threads);
  } catch (error) {
    return handleUnknownError(error, "GET /api/teams/[id]/forum");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const membership = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, teamId, leftAt: null },
    });

    if (!membership) return apiForbidden();

    const body = await req.json();
    const result = threadSchema.safeParse(body);

    if (!result.success) return handleZodError(result.error);

    await dbConnect();

    const newThread = await Thread.create({
      teamId,
      authorId: session.user.id,
      authorName: session.user.name || "Usuario Desconocido",
      title: result.data.title,
      content: result.data.content,
      ...(result.data.imageUrl ? { imageUrl: result.data.imageUrl } : {}),
    });

    // Fire-and-forget: notify active members except the author
    prisma.team
      .findUnique({
        where: { id: teamId },
        select: {
          name: true,
          members: {
            where: { leftAt: null, userId: { not: session.user.id } },
            select: { user: { select: { email: true, name: true } } },
          },
        },
      })
      .then((team) => {
        if (!team) return;
        const members = team.members.map((m) => m.user);
        return sendThreadNotification({
          members,
          teamName: team.name,
          teamId,
          threadId: String(newThread._id),
          threadTitle: result.data.title,
          authorName: session.user.name || "Un miembro",
        });
      })
      .catch(() => undefined);

    return apiSuccess(newThread, 201);
  } catch (error) {
    return handleUnknownError(error, "POST /api/teams/[id]/forum");
  }
}
