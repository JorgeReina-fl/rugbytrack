"use client";
import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { RugbyField3D } from "./RugbyField3D";
import { PlayerPosition } from "./PlayEditor3D";

interface PlayViewer3DProps {
  positions: PlayerPosition[];
}

export function PlayViewer3D({ positions }: PlayViewer3DProps) {
  return (
    <div className="flex h-[400px] w-full border rounded-lg overflow-hidden bg-gray-50">
      <Canvas camera={{ position: [0, 40, 60], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} />
        <RugbyField3D />
        
        {positions.map((p) => (
          <mesh key={p.id} position={[p.x, 0.5, p.z]}>
            <sphereGeometry args={[1.5]} />
            <meshStandardMaterial color="#3b82f6" />
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
  );
}
