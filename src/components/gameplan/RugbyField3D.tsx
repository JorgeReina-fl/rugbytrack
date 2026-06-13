"use client";
import React from "react";
import { Line } from "@react-three/drei";

export function RugbyField3D() {
  return (
    <group>
      {/* Field grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[70, 100]} />
        <meshStandardMaterial color="#4ade80" />
      </mesh>
      
      {/* Center line */}
      <Line points={[[-35, 0, 0], [35, 0, 0]]} color="white" lineWidth={2} />
      
      {/* 10m lines */}
      <Line points={[[-35, 0, -10], [35, 0, -10]]} color="white" lineWidth={1} dashed={true} dashSize={1} gapSize={1} />
      <Line points={[[-35, 0, 10], [35, 0, 10]]} color="white" lineWidth={1} dashed={true} dashSize={1} gapSize={1} />

      {/* 22m lines */}
      <Line points={[[-35, 0, -28], [35, 0, -28]]} color="white" lineWidth={2} />
      <Line points={[[-35, 0, 28], [35, 0, 28]]} color="white" lineWidth={2} />

      {/* Try lines (0m from end, but field is 100m long, so at +/- 50m) */}
      <Line points={[[-35, 0, -50], [35, 0, -50]]} color="white" lineWidth={2} />
      <Line points={[[-35, 0, 50], [35, 0, 50]]} color="white" lineWidth={2} />

      {/* Touch lines (sidelines) */}
      <Line points={[[-35, 0, -50], [-35, 0, 50]]} color="white" lineWidth={2} />
      <Line points={[[35, 0, -50], [35, 0, 50]]} color="white" lineWidth={2} />
    </group>
  );
}
