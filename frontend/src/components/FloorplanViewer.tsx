"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { WallMesh } from "./WallMesh";
import { TimelineControl } from "./TimelineControl";
import { useFloorplanData } from "@/hooks/useFloorplanData";
import { FloorplanVectorData } from "@/types/project";
import { ThermalSimulationGridData, HourlySolarTelemetry } from "@/types/thermal";
import { Layers, Box, Flame, Sparkles, Thermometer, SunMedium } from "lucide-react";

interface FloorplanViewerProps {
  projectId?: string | null;
  customVectorData?: FloorplanVectorData | null;
  initialThermalMode?: boolean;
}

/**
 * Diurnal Sunlight Controller that updates light angle and intensity in real-time
 * without causing React re-renders.
 */
function DiurnalSunLight({
  activeHourRef,
  activeHour,
}: {
  activeHourRef: React.MutableRefObject<number>;
  activeHour: number;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const hour = activeHourRef ? activeHourRef.current : activeHour;

    // Sun trajectory calculation (6:00 AM rise to 18:00 PM set)
    const angle = ((hour - 6.0) / 12.0) * Math.PI;
    const isDay = hour >= 5.5 && hour <= 18.5;

    const elev = Math.sin(angle);
    const yPos = Math.max(1.0, elev * 24.0);
    const xPos = Math.cos(angle) * 22.0;
    const zPos = Math.sin(angle * 0.7) * 14.0;

    lightRef.current.position.set(xPos, yPos, zPos);
    lightRef.current.intensity = isDay ? Math.max(0.4, elev * 2.2) : 0.15;
    lightRef.current.color.set(isDay ? (elev < 0.25 ? "#FF9E79" : "#FFF7EB") : "#405070");
  });

  return (
    <directionalLight
      ref={lightRef}
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
  );
}

export function FloorplanViewer({
  projectId = null,
  customVectorData = null,
  initialThermalMode = true,
}: FloorplanViewerProps) {
  const { vectorData: streamedData, loading, isCustomProject } = useFloorplanData(
    projectId
  );
  const [wireframe, setWireframe] = useState(false);
  const [wallHeight, setWallHeight] = useState(2.8);
  const [thermalMode, setThermalMode] = useState(initialThermalMode);
  const [activeHour, setActiveHour] = useState(13.5); // 1:30 PM peak solar
  const activeHourRef = useRef<number>(13.5);

  const [gridData, setGridData] = useState<ThermalSimulationGridData | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const activeVectorData = customVectorData || streamedData;

  const wallCount = activeVectorData?.element_counts?.wall ?? 0;
  const windowCount = activeVectorData?.element_counts?.window ?? 0;
  const doorCount = activeVectorData?.element_counts?.door ?? 0;

  // Attempt fetching PINN simulation from backend when vector data is available
  useEffect(() => {
    if (!activeVectorData || activeVectorData.elements.length === 0) return;

    let isMounted = true;
    const fetchSimulation = async () => {
      try {
        setIsSimulating(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";
        const res = await fetch(`${backendUrl}/api/thermal/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vector_data: activeVectorData,
            latitude: 41.3879,
            longitude: 2.1699,
            date: "2026-06-21",
            ambient_base_temp: 24.0,
            grid_resolution: 24,
            epochs: 15,
          }),
        });

        if (res.ok) {
          const data: ThermalSimulationGridData = await res.json();
          if (isMounted) {
            setGridData(data);
          }
        }
      } catch (err) {
        console.warn("Backend thermal simulation unavailable, falling back to neural procedure:", err);
      } finally {
        if (isMounted) setIsSimulating(false);
      }
    };

    fetchSimulation();
    return () => {
      isMounted = false;
    };
  }, [activeVectorData]);

  // Current hour telemetry
  const hourIdx = Math.floor(Math.max(0, Math.min(23, activeHour)));
  const currentSolarTelemetry = gridData?.solar_telemetry?.[hourIdx] || {
    azimuthDeg: 215,
    elevationDeg: 62,
    dniWm2: 780,
    sunVisible: activeHour >= 6 && activeHour <= 19,
  };

  const tempRange: [number, number] = [
    gridData?.min_temperature ?? 19.5,
    gridData?.max_temperature ?? 34.2,
  ];

  return (
    <div className="relative w-full h-full min-h-[600px] bg-black overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [13, 14, 16], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          {/* Base Ambient Room Fill */}
          <ambientLight intensity={0.4} color="#FFFFFF" />

          {/* Diurnal Key Sun Light that tracks the active hour */}
          <DiurnalSunLight activeHourRef={activeHourRef} activeHour={activeHour} />

          {/* Soft Burgundy Fill Light from opposite quadrant */}
          <directionalLight
            position={[-14, 10, -14]}
            intensity={thermalMode ? 0.6 : 0.3}
            color="#6D001A"
          />

          {/* Core Extrusion Engine with Custom Thermal Shader */}
          <WallMesh
            vectorData={activeVectorData}
            worldScale={16.0}
            wallHeight={wallHeight}
            wireframe={wireframe}
            thermalMode={thermalMode}
            thermalGrids={gridData?.thermal_grids}
            temperatureRange={tempRange}
            activeHour={activeHour}
            activeHourRef={activeHourRef}
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
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={5}
            maxDistance={45}
            enableDamping
            dampingFactor={0.06}
          />
        </Suspense>
      </Canvas>

      {/* Floating Top Left: Mode & Shading Controls */}
      <div className="absolute top-5 left-5 z-10 flex flex-col gap-2">
        <div className="glass-panel rounded-xl p-3 flex flex-wrap items-center gap-2">
          {/* Thermal Shader Toggle Button */}
          <button
            onClick={() => setThermalMode(!thermalMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              thermalMode
                ? "bg-burgundy text-white shadow-burgundy border border-burgundy-400/50"
                : "bg-surface hover:bg-surface-hover text-neutral-300 border border-white/10"
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${thermalMode ? "animate-pulse text-burgundy-300" : ""}`} />
            {thermalMode ? "PINN Thermal Shader Active" : "Matte Architectural Shading"}
          </button>

          {/* Wireframe Button */}
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              wireframe
                ? "bg-white/20 text-white border border-white/40"
                : "bg-surface hover:bg-surface-hover text-neutral-400 border border-white/10"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {wireframe ? "Wireframe" : "Solid"}
          </button>

          <div className="h-4 w-[1px] bg-white/15 mx-1" />

          {/* Wall Height Slider */}
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

        {isSimulating && (
          <div className="glass-burgundy rounded-lg px-3 py-1.5 text-[11px] font-mono text-burgundy-200 flex items-center gap-2 animate-pulse">
            <Sparkles className="w-3 h-3 text-burgundy-400" />
            SOLVING TRANSIENT PINN HEAT EQUATION...
          </div>
        )}
      </div>

      {/* Floating Top Right: Vector & Thermal Telemetry Stats */}
      <div className="absolute top-5 right-5 z-10 glass-panel rounded-xl p-4 text-white min-w-[240px]">
        <div className="border-b border-white/10 pb-2 mb-2 flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-burgundy-400 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5" /> Phase 5 Thermal Engine
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">60 FPS WebGL</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
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

        {/* Thermal Palette Scale Preview */}
        <div className="bg-[#121212] p-2.5 rounded-lg border border-white/5 space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-neutral-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-burgundy-400" /> Temp Range
            </span>
            <span className="text-white font-bold">
              {tempRange[0].toFixed(1)}°C - {tempRange[1].toFixed(1)}°C
            </span>
          </div>
          {/* Black to Burgundy Gradient Bar */}
          <div className="w-full h-2 rounded-full border border-white/10 overflow-hidden bg-gradient-to-r from-black via-[#38000C] to-[#6D001A]" />
          <div className="flex justify-between text-[9px] font-mono text-neutral-500">
            <span>0.0 (Cold #000000)</span>
            <span className="text-burgundy-400">1.0 (Peak #6D001A)</span>
          </div>
        </div>
      </div>

      {/* Floating Bottom Center: Diurnal Timeline Scrubber */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-2xl pointer-events-auto">
        <TimelineControl
          activeHour={activeHour}
          onHourChange={setActiveHour}
          activeHourRef={activeHourRef}
          solarTelemetry={currentSolarTelemetry}
        />
      </div>
    </div>
  );
}
