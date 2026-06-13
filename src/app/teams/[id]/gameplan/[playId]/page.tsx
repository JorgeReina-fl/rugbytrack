"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlayViewer3D } from "@/components/gameplan/PlayViewer3D";
import { PlayerPosition } from "@/components/gameplan/PlayEditor3D";

export default function PlayViewPage() {
  const params = useParams();
  const playId = params.playId as string;
  
  const [play, setPlay] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/plays/${playId}`)
      .then(r => r.json())
      .then(data => setPlay(data))
      .catch(e => console.error(e));
  }, [playId]);

  if (!play) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <span className="text-sm font-semibold text-blue-600 mb-1 block">{play.category}</span>
          <h1 className="text-3xl font-bold">{play.title}</h1>
        </div>
      </div>
      
      {play.description && (
        <div className="bg-gray-50 p-4 rounded-lg text-gray-700">
          {play.description}
        </div>
      )}

      <PlayViewer3D positions={play.positions as PlayerPosition[]} />
    </div>
  );
}
