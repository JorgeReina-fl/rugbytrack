"use client";
import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { RugbyField3D } from "./RugbyField3D";
import { z } from "zod";

export const positionSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number().min(-35).max(35),
  z: z.number().min(-50).max(50),
});

export const positionsArraySchema = z.array(positionSchema);

export type PlayerPosition = z.infer<typeof positionSchema>;

interface PlayEditor3DProps {
  initialPositions: PlayerPosition[];
  onSave: (title: string, description: string, category: string, positions: PlayerPosition[]) => void;
  isSaving: boolean;
}

export function PlayEditor3D({ initialPositions, onSave, isSaving }: PlayEditor3DProps) {
  const [positions, setPositions] = useState<PlayerPosition[]>(initialPositions);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ATTACK");

  const handlePointerMove = (e: any) => {
    if (activeId && e.point) {
      setPositions((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? { ...p, x: Math.max(-35, Math.min(35, e.point.x)), z: Math.max(-50, Math.min(50, e.point.z)) }
            : p
        )
      );
    }
  };

  return (
    <div className="flex h-[600px] w-full border rounded-lg overflow-hidden bg-gray-50">
      <div className="flex-1 relative cursor-crosshair">
        <Canvas camera={{ position: [0, 40, 60], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 20, 10]} intensity={1} />
          <RugbyField3D />
          
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setActiveId(null)}
            onPointerLeave={() => setActiveId(null)}
          >
            <planeGeometry args={[70, 100]} />
            <meshBasicMaterial visible={false} />
          </mesh>

          {positions.map((p) => (
            <mesh
              key={p.id}
              position={[p.x, 0.5, p.z]}
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveId(p.id);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setActiveId(null);
              }}
            >
              <sphereGeometry args={[1.5]} />
              <meshStandardMaterial color={activeId === p.id ? "#ef4444" : "#3b82f6"} />
              <Html position={[0, 2, 0]} center>
                <div className="bg-white/90 px-1 py-0.5 rounded text-xs font-bold pointer-events-none whitespace-nowrap">
                  {p.label}
                </div>
              </Html>
            </mesh>
          ))}
          <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
      </div>
      
      <div className="w-80 p-4 bg-white border-l flex flex-col gap-4">
        <h3 className="text-lg font-bold">Detalles de la Jugada</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Ej: Jugada 1"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="ATTACK">Ataque</option>
            <option value="DEFENSE">Defensa</option>
            <option value="SET_PIECE">Formación Fija</option>
            <option value="TRANSITION">Transición</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2"
            rows={4}
            placeholder="Instrucciones..."
          />
        </div>
        
        <button
          onClick={() => onSave(title, description, category, positions)}
          disabled={!title || isSaving}
          className="mt-auto w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : "Guardar Jugada"}
        </button>
      </div>
    </div>
  );
}
