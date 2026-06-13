import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { positionsArraySchema } from "@/components/gameplan/PlayEditor3D";

export async function GET(
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

  if (!member) return new NextResponse("Forbidden", { status: 403 });
  if (!member.isCoach && !play.isPublished) return new NextResponse("Forbidden", { status: 403 });

  return NextResponse.json(play);
}

export async function PUT(
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
    const { title, description, category, positions } = json;
    
    const parsedPositions = positionsArraySchema.parse(positions);

    const updated = await prisma.play.update({
      where: { id: playId },
      data: {
        title,
        description,
        category,
        positions: parsedPositions,
      }
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return new NextResponse(e.message, { status: 400 });
  }
}

export async function DELETE(
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

  await prisma.play.delete({
    where: { id: playId }
  });

  return new NextResponse(null, { status: 204 });
}
