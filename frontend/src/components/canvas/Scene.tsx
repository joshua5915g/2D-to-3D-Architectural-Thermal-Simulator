"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, ContactShadows } from "@react-three/drei";
import { ArchitecturalMesh } from "./ArchitecturalMesh";
import { SolarEnvironment } from "./SolarEnvironment";
import { CameraControls } from "./CameraControls";
import { Extruded3DGeometry } from "@/types/mesh";
import { ThermalSimulationResult } from "@/types/thermal";

interface SceneProps {
  meshData?: Extruded3DGeometry | null;
  thermalData?: ThermalSimulationResult | null;
  wireframe?: boolean;
}

export function Scene({ meshData, thermalData, wireframe = false }: SceneProps) {
  const azimuth = thermalData?.solarFlux.azimuthDeg ?? 145;
  const elevation = thermalData?.solarFlux.elevationDeg ?? 48;

  return (
    <div className="relative w-full h-full min-h-[500px] bg-black">
      <Canvas
        shadows
        camera={{ position: [14, 12, 14], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          <SolarEnvironment azimuthDeg={azimuth} elevationDeg={elevation} />
          
          <ArchitecturalMesh
            meshData={meshData}
            thermalData={thermalData}
            wireframe={wireframe}
          />

          {/* Minimalist Dark Architectural Grid */}
          <Grid
            renderOrder={-1}
            position={[0, -0.01, 0]}
            infiniteGrid
            cellSize={1}
            cellThickness={0.7}
            cellColor="#1A1A1A"
            sectionSize={5}
            sectionThickness={1.2}
            sectionColor="#6D001A"
            fadeDistance={35}
            fadeStrength={1.5}
          />

          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.65}
            scale={20}
            blur={2}
            far={4}
            color="#000000"
          />

          <CameraControls />
        </Suspense>
      </Canvas>
    </div>
  );
}
