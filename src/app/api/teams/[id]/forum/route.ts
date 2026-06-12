import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { Thread } from "@/models/Thread";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificamos si el usuario pertenece al equipo (PostgreSQL)
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este equipo" }, { status: 403 });
    }

    // Obtenemos hilos del equipo (MongoDB)
    await dbConnect();
    const threads = await Thread.find({ teamId }).sort({ createdAt: -1 }).lean();

    return NextResponse.json(threads);
  } catch (error) {
    console.error("[FORUM_GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este equipo" }, { status: 403 });
    }

    const body = await req.json();
    const result = threadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await dbConnect();
    
    const newThread = await Thread.create({
      teamId,
      authorId: session.user.id,
      authorName: session.user.name || "Usuario Desconocido",
      title: result.data.title,
      content: result.data.content,
    });

    return NextResponse.json(newThread, { status: 201 });
  } catch (error) {
    console.error("[FORUM_POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
