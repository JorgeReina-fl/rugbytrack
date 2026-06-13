import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id: playId } = await params;

  const play = await prisma.play.findUnique({
    where: { id: playId }
  });

  if (!play) return new NextResponse("Not Found", { status: 404 });

  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: play.teamId } }
  });

  if (!member || !member.isCoach) return new NextResponse("Forbidden", { status: 403 });

  try {
    const json = await req.json();
    const { isPublished } = json;

    const updated = await prisma.play.update({
      where: { id: playId },
      data: { isPublished }
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return new NextResponse(e.message, { status: 400 });
  }
}
