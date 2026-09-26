"use client";

import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import { WallMesh } from "./WallMesh";
import { useFloorplanData } from "@/hooks/useFloorplanData";
import { FloorplanVectorData } from "@/types/project";
import { Layers, Box, Eye, Sparkles } from "lucide-react";

interface FloorplanViewerProps {
  projectId?: string | null;
  customVectorData?: FloorplanVectorData | null;
}

export function FloorplanViewer({
  projectId = null,
  customVectorData = null,
}: FloorplanViewerProps) {
  const { vectorData: streamedData, loading, isCustomProject } = useFloorplanData(
    projectId
  );
  const [wireframe, setWireframe] = useState(false);
  const [wallHeight, setWallHeight] = useState(2.8);

  const activeVectorData = customVectorData || streamedData;

  const wallCount = activeVectorData?.element_counts?.wall ?? 0;
  const windowCount = activeVectorData?.element_counts?.window ?? 0;
  const doorCount = activeVectorData?.element_counts?.door ?? 0;

  return (
    <div className="relative w-full h-full min-h-[550px] bg-black overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [12, 14, 16], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          {/* Moody Architectural Lighting Studio */}
          <ambientLight intensity={0.45} color="#FFFFFF" />

          {/* Key Sun Directional Light with soft shadows */}
          <directionalLight
            position={[18, 22, 14]}
            intensity={1.8}
            color="#FFF8F0"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={60}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
            shadow-bias={-0.0004}
          />

          {/* Soft Burgundy Fill Light from opposite quadrant */}
          <directionalLight
            position={[-14, 10, -14]}
            intensity={0.45}
            color="#6D001A"
          />

          {/* Core Extrusion Engine */}
          <WallMesh
            vectorData={activeVectorData}
            worldScale={16.0}
            wallHeight={wallHeight}
            wireframe={wireframe}
          />

          {/* Architectural Dark Grid with Burgundy Accents */}
          <Grid
            renderOrder={-1}
            position={[0, -0.01, 0]}
            infiniteGrid
            cellSize={1}
            cellThickness={0.7}
            cellColor="#171717"
            sectionSize={5}
            sectionThickness={1.2}
            sectionColor="#6D001A"
            fadeDistance={38}
            fadeStrength={1.4}
          />

          {/* Soft Ground Contact Shadows */}
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.75}
            scale={22}
            blur={2.5}
            far={4}
            color="#000000"
          />

          {/* Orbit Controls with smooth damping */}
          <OrbitControls
            makeDefault
            minPolarAngle={Math.PI / 10}
            maxPolarAngle={Math.PI / 2 - 0.05} // Constrain camera above ground level
            minDistance={5}
            maxDistance={45}
            enableDamping
            dampingFactor={0.06}
          />
        </Suspense>
      </Canvas>

      {/* Floating Top Left: Mode & Height Controls */}
      <div className="absolute top-5 left-5 z-10 flex flex-col gap-2">
        <div className="glass-panel rounded-xl p-3 flex items-center gap-2">
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              wireframe
                ? "bg-burgundy text-white shadow-burgundy border border-burgundy-400/40"
                : "bg-surface hover:bg-surface-hover text-neutral-300 border border-white/10"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {wireframe ? "Wireframe Active" : "Matte Shading"}
          </button>

          <div className="h-4 w-[1px] bg-white/15 mx-1" />

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Wall Height:</span>
            <input
              type="range"
              min="1.8"
              max="4.5"
              step="0.2"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseFloat(e.target.value))}
              className="w-20 accent-burgundy cursor-pointer"
            />
            <span className="text-white font-mono w-8">{wallHeight.toFixed(1)}m</span>
          </div>
        </div>

        {isCustomProject && (
          <div className="glass-burgundy rounded-lg px-3 py-1.5 text-[11px] font-mono text-burgundy-200 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-burgundy-400 animate-pulse" />
            LIVE FIRESTORE VECTOR STREAM
          </div>
        )}
      </div>

      {/* Floating Top Right: Vector Telemetry Stats */}
      <div className="absolute top-5 right-5 z-10 glass-panel rounded-xl p-4 text-white min-w-[220px]">
        <div className="border-b border-white/10 pb-2 mb-2 flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-burgundy-400 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5" /> Extruded Geometry
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">Phase 3</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-[#121212] p-2 rounded-lg border border-white/5">
            <div className="text-[10px] uppercase text-neutral-400">Walls</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {wallCount}
            </div>
          </div>
          <div className="bg-[#121212] p-2 rounded-lg border border-white/5">
            <div className="text-[10px] uppercase text-neutral-400">Windows</div>
            <div className="text-base font-bold font-mono text-burgundy-300 mt-0.5">
              {windowCount}
            </div>
          </div>
          <div className="bg-[#121212] p-2 rounded-lg border border-white/5">
            <div className="text-[10px] uppercase text-neutral-400">Doors</div>
            <div className="text-base font-bold font-mono text-neutral-200 mt-0.5">
              {doorCount}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 mt-2 font-mono text-center">
          Left Drag: Rotate • Right Drag: Pan • Scroll: Zoom
        </p>
      </div>
    </div>
  );
}
