"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";

export default function LivePollClient({ teamId, initialPolls }: { teamId: string; initialPolls: any[] }) {
  const { socket } = useSocket(undefined, teamId);
  const [polls, setPolls] = useState(initialPolls);
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_team", { teamId });

    socket.on("poll_update", (data: any) => {
      setPolls((prev: any) =>
        prev.map((p: any) => {
          if (p.id === data.pollId) {
            return {
              ...p,
              options: p.options.map((opt: any) => {
                const updatedOpt = data.options.find((o: any) => o.id === opt.id);
                if (updatedOpt) {
                  return { ...opt, _count: { votes: updatedOpt.votesCount } };
                }
                return opt;
              }),
            };
          }
          return p;
        })
      );
    });

    return () => {
      socket.off("poll_update");
    };
  }, [socket, teamId]);

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(error.error || "Error al votar");
      }
    } catch (e) {
      console.error(e);
      alert("Error al votar");
    }
  };

  return (
    <div className="space-y-6">
      {polls.length === 0 && (
        <div className="text-center text-gray-500 py-10 bg-white rounded-xl shadow-sm border border-gray-100">
          No hay encuestas activas.
        </div>
      )}
      {polls.map((poll: any) => {
        const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + opt._count.votes, 0);

        return (
          <div key={poll.id} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              {poll.createdBy.image && (
                <img src={poll.createdBy.image} alt={poll.createdBy.name} className="w-8 h-8 rounded-full" />
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{poll.title}</h3>
                <p className="text-sm text-gray-500">Por {poll.createdBy.name}</p>
              </div>
            </div>
            {poll.description && <p className="text-gray-600 mt-2 mb-4">{poll.description}</p>}
            <div className="space-y-3">
              {poll.options.map((opt: any) => {
                const percentage = totalVotes === 0 ? 0 : Math.round((opt._count.votes / totalVotes) * 100);
                return (
                  <div key={opt.id} className="relative group cursor-pointer" onClick={() => handleVote(poll.id, opt.id)}>
                    <div className="absolute top-0 left-0 h-full bg-blue-100 rounded-lg transition-all duration-500 ease-out" style={{ width: `${percentage}%` }}></div>
                    <div className="relative p-3 flex justify-between items-center z-10 border border-gray-200 rounded-lg hover:border-blue-300">
                      <span className="font-medium text-gray-800">{opt.text}</span>
                      <span className="text-sm font-semibold text-blue-600">{opt._count.votes} ({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
