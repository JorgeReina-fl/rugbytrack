import "server-only";
import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { Comment } from "@/models/Comment";
import { Thread } from "@/models/Thread";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import mongoose from "mongoose";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleZodError,
  handleUnknownError,
} from "@/lib/api-response";

const commentSchema = z.object({
  content: z.string().min(2, "El comentario debe tener al menos 2 caracteres").max(2000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return apiNotFound("Hilo");
    }

    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    await dbConnect();

    const thread = await Thread.findById(threadId).lean();
    if (!thread) return apiNotFound("Hilo");

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: thread.teamId } },
    });

    if (!membership) return apiForbidden();

    const comments = await Comment.find({ threadId }).sort({ createdAt: 1 }).lean();

    return apiSuccess(comments);
  } catch (error) {
    return handleUnknownError(error, "GET /api/forum/[threadId]/comments");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return apiNotFound("Hilo");
    }

    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    await dbConnect();

    const thread = await Thread.findById(threadId);
    if (!thread) return apiNotFound("Hilo");

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: thread.teamId } },
    });

    if (!membership) return apiForbidden();

    const body = await req.json();
    const result = commentSchema.safeParse(body);

    if (!result.success) return handleZodError(result.error);

    const newComment = await Comment.create({
      threadId: new mongoose.Types.ObjectId(threadId),
      authorId: session.user.id,
      authorName: session.user.name || "Usuario Desconocido",
      content: result.data.content,
    });

    thread.updatedAt = new Date();
    await thread.save();

    return apiSuccess(newComment, 201);
  } catch (error) {
    return handleUnknownError(error, "POST /api/forum/[threadId]/comments");
  }
}
