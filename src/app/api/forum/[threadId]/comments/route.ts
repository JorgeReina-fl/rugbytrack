import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { Comment } from "@/models/Comment";
import { Thread } from "@/models/Thread";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import mongoose from "mongoose";

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
      return NextResponse.json({ error: "ID de hilo inválido" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await dbConnect();
    
    // Verificamos si el hilo existe y a qué equipo pertenece
    const thread = await Thread.findById(threadId).lean();
    if (!thread) {
      return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
    }

    // Verificamos membresía
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: thread.teamId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este equipo" }, { status: 403 });
    }

    const comments = await Comment.find({ threadId }).sort({ createdAt: 1 }).lean();

    return NextResponse.json(comments);
  } catch (error) {
    console.error("[COMMENTS_GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json({ error: "ID de hilo inválido" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await dbConnect();

    const thread = await Thread.findById(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: thread.teamId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este equipo" }, { status: 403 });
    }

    const body = await req.json();
    const result = commentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newComment = await Comment.create({
      threadId: new mongoose.Types.ObjectId(threadId),
      authorId: session.user.id,
      authorName: session.user.name || "Usuario Desconocido",
      content: result.data.content,
    });

    // Opcional: Actualizar el updatedAt del hilo para que suba arriba en la lista
    thread.updatedAt = new Date();
    await thread.save();

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("[COMMENTS_POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
