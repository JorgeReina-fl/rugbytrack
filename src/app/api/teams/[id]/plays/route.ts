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

  const { id: teamId } = await params;
  
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } }
  });
  
  if (!member) return new NextResponse("Forbidden", { status: 403 });

  const plays = await prisma.play.findMany({
    where: {
      teamId,
      ...(member.isCoach ? {} : { isPublished: true })
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(plays);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id: teamId } = await params;
  
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } }
  });
  
  if (!member || !member.isCoach) return new NextResponse("Forbidden", { status: 403 });

  try {
    const json = await req.json();
    const { title, description, category, positions } = json;
    
    const parsedPositions = positionsArraySchema.parse(positions);

    const play = await prisma.play.create({
      data: {
        teamId,
        title,
        description,
        category,
        positions: parsedPositions,
        createdById: session.user.id,
      }
    });

    return NextResponse.json(play);
  } catch (e: any) {
    return new NextResponse(e.message, { status: 400 });
  }
}
