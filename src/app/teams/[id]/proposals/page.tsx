import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProposalBoard from "@/components/proposals/ProposalBoard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalsPage({ params }: PageProps) {
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

  const proposals = await prisma.proposal.findMany({
    where: { teamId: id },
    include: {
      _count: { select: { supporters: true } },
      createdBy: { select: { name: true, image: true } },
      supporters: { select: { userId: true } },
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" }
    ],
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-4">
        <a href={`/teams/${id}`} className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">← Volver al equipo</a>
      </div>
      <ProposalBoard 
        teamId={id} 
        initialProposals={proposals} 
        isCoach={membership.isCoach} 
        currentUserId={session.user.id} 
      />
    </div>
  );
}
