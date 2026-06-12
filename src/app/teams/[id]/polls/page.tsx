import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LivePollClient from "@/components/polls/LivePollClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PollsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: id },
    include: { team: true },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const polls = await prisma.poll.findMany({
    where: { teamId: id },
    include: {
      options: {
        include: {
          _count: { select: { votes: true } },
        },
      },
      createdBy: {
        select: { name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Encuestas</h1>
          <p className="text-gray-500 mt-2">Vota y participa en las decisiones del equipo {membership.team.name}</p>
        </div>
      </div>
      <LivePollClient teamId={id} initialPolls={polls} />
    </div>
  );
}
