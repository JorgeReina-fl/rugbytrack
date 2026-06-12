"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";

export default function ProposalBoard({ teamId, initialProposals, isCoach, currentUserId }: any) {
  const { socket } = useSocket(undefined, teamId);
  const [proposals, setProposals] = useState(initialProposals);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;
    socket.emit("join_team", { teamId });

    socket.on("proposal_update", (updatedProposal: any) => {
      setProposals((prev: any) => {
        const exists = prev.find((p: any) => p.id === updatedProposal.id);
        if (exists) {
          return prev.map((p: any) => p.id === updatedProposal.id ? updatedProposal : p);
        } else {
          return [updatedProposal, ...prev];
        }
      });
    });

    return () => {
      socket.off("proposal_update");
    };
  }, [socket, teamId]);

  const handleSupport = async (id: string) => {
    await fetch(`/api/proposals/${id}/support`, { method: "POST" });
  };

  const handleStatus = async (id: string, status: string) => {
    await fetch(`/api/proposals/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const createProposal = async (e: any) => {
    e.preventDefault();
    const res = await fetch(`/api/teams/${teamId}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (res.ok) {
      const newProposal = await res.json();
      setProposals([newProposal.data, ...proposals]);
      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } else {
      alert("Error al crear la propuesta");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Propuestas de Actividades</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold uppercase text-xs tracking-widest"
        >
          + Nueva Propuesta
        </button>
      </div>

      <div className="space-y-4">
        {proposals.map((proposal: any) => {
          const supported = proposal.supporters.some((s: any) => s.userId === currentUserId);
          return (
            <div key={proposal.id} className="p-6 bg-card border border-border rounded-xl shadow-sm flex items-start gap-4">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleSupport(proposal.id)}
                  className={`flex flex-col items-center p-2 rounded ${supported ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <span className="text-xl">▲</span>
                  <span className="font-bold">{proposal._count.supporters}</span>
                </button>
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <h3 className="text-lg font-bold">{proposal.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-2">{proposal.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {proposal.createdBy.image && (
                        <img src={proposal.createdBy.image} className="w-4 h-4 rounded-full" alt="avatar" />
                      )}
                      <span>{proposal.createdBy.name}</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        proposal.status === "APPROVED" ? "bg-green-100 text-green-700" :
                        proposal.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                  </div>
                  {isCoach && proposal.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleStatus(proposal.id, "APPROVED")} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wide hover:bg-green-700">Aprobar</button>
                      <button onClick={() => handleStatus(proposal.id, "REJECTED")} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wide hover:bg-red-700">Rechazar</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {proposals.length === 0 && <p className="text-muted-foreground text-center py-8 border border-dashed rounded-xl">No hay propuestas todavía.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border p-6 rounded-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Crear Propuesta</h3>
            <form onSubmit={createProposal}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Título</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border p-2 rounded bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Descripción</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border p-2 rounded bg-background h-24"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground">Cancelar</button>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
