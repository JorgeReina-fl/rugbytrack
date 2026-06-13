"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PlayCategory, Play } from "@prisma/client";

type PlayDto = Play & { createdBy: { name: string } };

export default function GamePlanPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [plays, setPlays] = useState<PlayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    fetchPlays();
    checkRole();
  }, [teamId]);

  const fetchPlays = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/plays`);
      if (res.ok) {
        setPlays(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const checkRole = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const team = await res.json();
        setIsCoach(team.currentUserRole === "COACH");
      }
    } catch {}
  };

  const handlePublish = async (playId: string, isPublished: boolean) => {
    await fetch(`/api/plays/${playId}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ isPublished }),
    });
    fetchPlays();
  };

  const handleDelete = async (playId: string) => {
    if (!confirm("¿Eliminar jugada?")) return;
    await fetch(`/api/plays/${playId}`, { method: "DELETE" });
    fetchPlays();
  };

  if (loading) return <div>Cargando...</div>;

  const categories = ["ATTACK", "DEFENSE", "SET_PIECE", "TRANSITION"];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Plan de Juego 3D</h1>
        {isCoach && (
          <Link
            href={`/teams/${teamId}/gameplan/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Nueva Jugada
          </Link>
        )}
      </div>

      {categories.map((cat) => {
        const categoryPlays = plays.filter((p) => p.category === cat);
        if (categoryPlays.length === 0) return null;

        return (
          <div key={cat} className="space-y-4">
            <h2 className="text-xl font-bold border-b pb-2">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPlays.map((play) => (
                <div key={play.id} className="border rounded-lg p-4 bg-white shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-1">{play.title}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">
                    {play.description}
                  </p>
                  <div className="flex justify-between items-center mt-auto pt-4 border-t">
                    <Link
                      href={`/teams/${teamId}/gameplan/${play.id}`}
                      className="text-blue-600 font-medium text-sm"
                    >
                      Ver Jugada
                    </Link>
                    {isCoach && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePublish(play.id, !play.isPublished)}
                          className={`text-xs px-2 py-1 rounded ${
                            play.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {play.isPublished ? "Publicada" : "Borrador"}
                        </button>
                        <button
                          onClick={() => handleDelete(play.id)}
                          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
