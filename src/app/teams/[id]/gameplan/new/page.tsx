"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlayEditor3D, PlayerPosition } from "@/components/gameplan/PlayEditor3D";

// Default standard starting positions
const defaultPositions: PlayerPosition[] = [
  { id: "1", label: "1", x: -2, z: 10 },
  { id: "2", label: "2", x: 0, z: 10 },
  { id: "3", label: "3", x: 2, z: 10 },
  { id: "4", label: "4", x: -1, z: 12 },
  { id: "5", label: "5", x: 1, z: 12 },
  { id: "6", label: "6", x: -3, z: 14 },
  { id: "7", label: "7", x: 3, z: 14 },
  { id: "8", label: "8", x: 0, z: 15 },
  { id: "9", label: "9", x: 0, z: 18 },
  { id: "10", label: "10", x: 5, z: 20 },
  { id: "11", label: "11", x: -15, z: 25 },
  { id: "12", label: "12", x: 10, z: 22 },
  { id: "13", label: "13", x: 15, z: 24 },
  { id: "14", label: "14", x: 25, z: 25 },
  { id: "15", label: "15", x: 0, z: 35 },
];

export default function NewPlayPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (title: string, description: string, category: string, positions: PlayerPosition[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/plays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, positions }),
      });
      if (res.ok) {
        router.push(`/teams/${teamId}/gameplan`);
      } else {
        alert("Error al guardar");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Crear Nueva Jugada</h1>
      <PlayEditor3D initialPositions={defaultPositions} onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}
