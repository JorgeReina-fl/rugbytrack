import "server-only";
import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
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
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
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

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
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
    });

    return apiSuccess(newThread, 201);
  } catch (error) {
    return handleUnknownError(error, "POST /api/teams/[id]/forum");
  }
}
