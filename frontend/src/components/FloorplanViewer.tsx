"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { WallMesh } from "./WallMesh";
import { HVACNode } from "./HVACNode";
import { IoTWidget } from "./IoTWidget";
import { WindMesh } from "./WindMesh";
import { VentilationWidget } from "./VentilationWidget";
import { ExteriorShadingScene, ShadingWidget } from "./ShadingTools";
import { TimelineControl } from "./TimelineControl";
import { useFloorplanData } from "@/hooks/useFloorplanData";
import { FloorplanVectorData } from "@/types/project";
import {
  ThermalSimulationGridData,
  HourlySolarTelemetry,
  HVACNodeData,
  IoTSensorData,
  WindowStateData,
  CFDSimulationResponse,
  ExteriorShadingElement,
  ShadingElementType,
} from "@/types/thermal";
import {
  Layers,
  Box,
  Flame,
  Sparkles,
  Thermometer,
  SunMedium,
  Snowflake,
  Plus,
  Wind,
  Sun,
  Umbrella,
} from "lucide-react";

interface FloorplanViewerProps {
  projectId?: string | null;
  customVectorData?: FloorplanVectorData | null;
  initialThermalMode?: boolean;
}

/**
 * 3D Physical Smart Sensor Pin Marker with Burgundy Halo
 */
function IoTSensorPin({
  sensor,
  worldScale = 16.0,
}: {
  sensor: IoTSensorData;
  worldScale?: number;
}) {
  const posX = (sensor.x - 0.5) * worldScale;
  const posZ = (sensor.y - 0.5) * worldScale;
  const posY = sensor.z ?? 1.2;

  return (
    <group position={[posX, posY, posZ]}>
      {/* Sensor Beacon Sphere */}
      <mesh castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#6D001A"
          emissiveIntensity={1.8}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      {/* Sensor Stalk */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, -posY + 0.02, 0),
            ]);
          }}
        />
        <lineBasicMaterial attach="material" color="#6D001A" transparent opacity={0.4} />
      </line>
    </group>
  );
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

  // HVAC Digital Twin Nodes State
  const [hvacNodes, setHvacNodes] = useState<HVACNodeData[]>([
    {
      id: "hvac-1",
      name: "Terminal 01 (Living)",
      position: [-2.0, 1.3, -1.5],
      coolingCapacityKw: 3.5,
      setpointCelsius: 21.0,
      active: true,
      radiusMeters: 3.5,
    },
    {
      id: "hvac-2",
      name: "Terminal 02 (Suite)",
      position: [2.5, 1.3, 1.8],
      coolingCapacityKw: 2.8,
      setpointCelsius: 22.0,
      active: true,
      radiusMeters: 3.0,
    },
  ]);

  // Live IoT Smart Sensor State
  const [iotSensors, setIotSensors] = useState<IoTSensorData[]>([]);

  // CFD Natural Ventilation State
  const [ventilationMode, setVentilationMode] = useState(true);
  const [windSpeed, setWindSpeed] = useState(3.5);
  const [windDirection, setWindDirection] = useState(225.0);
  const [windowStates, setWindowStates] = useState<Record<string, boolean>>({});
  const [cfdData, setCfdData] = useState<CFDSimulationResponse | null>(null);
  const [isCfdSimulating, setIsCfdSimulating] = useState(false);

  const activeVectorData = customVectorData || streamedData;

  // Initialize all windows as operable/open
  useEffect(() => {
    if (!activeVectorData) return;
    const initial: Record<string, boolean> = {};
    activeVectorData.elements
      .filter((el) => el.type === "window")
      .forEach((el) => {
        initial[el.id] = true;
      });
    setWindowStates(initial);
  }, [activeVectorData]);

  const handleToggleWindow = (windowId: string) => {
    setWindowStates((prev) => ({
      ...prev,
      [windowId]: prev[windowId] === undefined ? false : !prev[windowId],
    }));
  };

  const handleOpenAllWindows = () => {
    if (!activeVectorData) return;
    const next: Record<string, boolean> = {};
    activeVectorData.elements
      .filter((el) => el.type === "window")
      .forEach((el) => {
        next[el.id] = true;
      });
    setWindowStates(next);
  };

  const handleCloseAllWindows = () => {
    if (!activeVectorData) return;
    const next: Record<string, boolean> = {};
    activeVectorData.elements
      .filter((el) => el.type === "window")
      .forEach((el) => {
        next[el.id] = false;
      });
    setWindowStates(next);
  };

  // Passive Solar Shading Interventions State
  const [shadingMode, setShadingMode] = useState(false);
  const [selectedShadingId, setSelectedShadingId] = useState<string | null>(null);
  const [shadingElements, setShadingElements] = useState<ExteriorShadingElement[]>([
    {
      id: "tree-south",
      type: "tree",
      position: [-5.5, -3.8, 0.0],
      dimensions: [3.6, 3.6, 5.0],
      transmittance: 0.15,
    },
    {
      id: "overhang-main",
      type: "overhang",
      position: [0.0, -5.2, 2.8],
      dimensions: [5.5, 1.2, 0.15],
      transmittance: 0.0,
    },
  ]);

  const handleAddShadingElement = (type: ShadingElementType) => {
    const id = `${type}-${Date.now().toString().slice(-4)}`;
    let newElem: ExteriorShadingElement;

    if (type === "tree") {
      newElem = {
        id,
        type: "tree",
        position: [-6.0 + (Math.random() - 0.5) * 4, -4.0 + (Math.random() - 0.5) * 4, 0.0],
        dimensions: [3.5, 3.5, 4.8],
        transmittance: 0.15,
      };
    } else if (type === "overhang") {
      newElem = {
        id,
        type: "overhang",
        position: [2.5, -4.5, 2.8],
        dimensions: [4.0, 1.2, 0.15],
        transmittance: 0.0,
      };
    } else {
      newElem = {
        id,
        type: "louver",
        position: [-2.0, 5.0, 1.4],
        dimensions: [2.5, 0.2, 1.6],
        transmittance: 0.1,
        angle_deg: 45,
      };
    }

    setShadingElements((prev) => [...prev, newElem]);
    setSelectedShadingId(id);
    setShadingMode(true);
  };

  const handleUpdateShadingElement = (
    id: string,
    updates: Partial<ExteriorShadingElement>
  ) => {
    setShadingElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  const handleRemoveShadingElement = (id: string) => {
    setShadingElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedShadingId === id) setSelectedShadingId(null);
  };

  // Debounced CFD Simulation trigger
  const cfdDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeVectorData || activeVectorData.elements.length === 0 || !ventilationMode) return;

    if (cfdDebounceRef.current) clearTimeout(cfdDebounceRef.current);

    let isMounted = true;
    cfdDebounceRef.current = setTimeout(async () => {
      try {
        setIsCfdSimulating(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";

        const winList: WindowStateData[] = activeVectorData.elements
          .filter((el) => el.type === "window")
          .map((el) => ({
            window_id: el.id,
            is_open: windowStates[el.id] ?? true,
            open_fraction: (windowStates[el.id] ?? true) ? 1.0 : 0.0,
          }));

        const res = await fetch(`${backendUrl}/api/cfd/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vector_data: activeVectorData,
            window_states: winList,
            wind_speed_mps: windSpeed,
            wind_direction_deg: windDirection,
            outdoor_temp_celsius: 24.0,
            indoor_avg_temp_celsius: gridData?.average_temperature ?? 28.0,
            grid_resolution: 24,
            epochs: 18,
          }),
        });

        if (res.ok) {
          const data: CFDSimulationResponse = await res.json();
          if (isMounted) setCfdData(data);
        }
      } catch (err) {
        console.warn("CFD simulation error:", err);
      } finally {
        if (isMounted) setIsCfdSimulating(false);
      }
    }, 450);

    return () => {
      isMounted = false;
      if (cfdDebounceRef.current) clearTimeout(cfdDebounceRef.current);
    };
  }, [activeVectorData, windowStates, windSpeed, windDirection, ventilationMode, gridData?.average_temperature]);

  const wallCount = activeVectorData?.element_counts?.wall ?? 0;
  const windowCount = activeVectorData?.element_counts?.window ?? 0;
  const doorCount = activeVectorData?.element_counts?.door ?? 0;

  // HVAC Interaction Handlers
  const handlePositionChange = (id: string, newPos: [number, number, number]) => {
    setHvacNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, position: newPos } : n))
    );
  };

  const handleToggleActive = (id: string) => {
    setHvacNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, active: !n.active } : n))
    );
  };

  const handleSetpointChange = (id: string, newSetpoint: number) => {
    setHvacNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, setpointCelsius: newSetpoint } : n))
    );
  };

  const handleDeleteHvac = (id: string) => {
    setHvacNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAddHvacNode = () => {
    const nextIdx = hvacNodes.length + 1;
    const rndX = (Math.random() - 0.5) * 6;
    const rndZ = (Math.random() - 0.5) * 6;
    const newNode: HVACNodeData = {
      id: `hvac-${Date.now()}`,
      name: `Terminal 0${nextIdx}`,
      position: [Math.round(rndX * 10) / 10, 1.3, Math.round(rndZ * 10) / 10],
      coolingCapacityKw: 3.0,
      setpointCelsius: 21.5,
      active: true,
      radiusMeters: 3.2,
    };
    setHvacNodes((prev) => [...prev, newNode]);
  };

  // Attempt fetching PINN simulation from backend when vector data or HVAC nodes change
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeVectorData || activeVectorData.elements.length === 0) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    let isMounted = true;
    debounceRef.current = setTimeout(async () => {
      try {
        setIsSimulating(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";

        // Map 3D positions to normalized [0, 1] for PINN PDE solver
        const hvacSpecs = hvacNodes.map((n) => ({
          id: n.id,
          name: n.name,
          x: Math.max(0.01, Math.min(0.99, n.position[0] / 16.0 + 0.5)),
          y: Math.max(0.01, Math.min(0.99, n.position[2] / 16.0 + 0.5)),
          z: Math.max(0.0, Math.min(1.0, n.position[1] / wallHeight)),
          cooling_capacity_kw: n.coolingCapacityKw,
          setpoint_celsius: n.setpointCelsius,
          active: n.active,
          radius_meters: n.radiusMeters ?? 3.0,
        }));

        const shadingSpecs = shadingElements.map((el) => ({
          id: el.id,
          type: el.type,
          position: el.position,
          dimensions: el.dimensions,
          transmittance: el.transmittance,
          angle_deg: el.angle_deg ?? 0.0,
        }));

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
            hvac_nodes: hvacSpecs,
            shading_elements: shadingSpecs,
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
    }, 450);

    return () => {
      isMounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeVectorData, hvacNodes, shadingElements, wallHeight]);

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

          {/* 3D Drag-and-Drop HVAC Digital Twin Terminals */}
          {hvacNodes.map((node) => (
            <HVACNode
              key={node.id}
              node={node}
              onPositionChange={handlePositionChange}
              onToggleActive={handleToggleActive}
              onSetpointChange={handleSetpointChange}
              onDelete={handleDeleteHvac}
              worldScale={16.0}
            />
          ))}

          {/* Physical IoT Smart Sensor Markers */}
          {iotSensors.map((sensor) => (
            <IoTSensorPin
              key={sensor.sensor_id}
              sensor={sensor}
              worldScale={16.0}
            />
          ))}

          {/* Natural Ventilation & CFD Streamlines */}
          {ventilationMode && (
            <WindMesh
              vectorData={activeVectorData}
              cfdData={cfdData}
              windowStates={windowStates}
              onToggleWindow={handleToggleWindow}
              worldScale={16.0}
              wallHeight={wallHeight}
              windSpeedMps={windSpeed}
              windDirectionDeg={windDirection}
            />
          )}

          {/* Passive Solar Shading Interventions (Trees, Overhangs, Louvers) */}
          <ExteriorShadingScene
            elements={shadingElements}
            selectedId={selectedShadingId}
            onSelect={setSelectedShadingId}
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

      {/* Floating Top Left: Mode, HVAC & Shading Controls */}
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

          {/* Natural Ventilation CFD Button */}
          <button
            onClick={() => setVentilationMode(!ventilationMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              ventilationMode
                ? "bg-[#6D001A] text-white shadow-[0_0_12px_#6D001A] border border-burgundy-400/50"
                : "bg-surface hover:bg-surface-hover text-neutral-400 border border-white/10"
            }`}
          >
            <Wind className={`w-3.5 h-3.5 ${ventilationMode ? "animate-pulse text-[#FF2A55]" : ""}`} />
            {ventilationMode ? "CFD Wind Flow" : "Wind Off"}
          </button>
 
           {/* Passive Solar Shading Interventions Button */}
           <button
             onClick={() => setShadingMode(!shadingMode)}
             className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
               shadingMode
                 ? "bg-[#6D001A] text-white shadow-[0_0_12px_#6D001A] border border-burgundy-400/50"
                 : "bg-surface hover:bg-surface-hover text-neutral-400 border border-white/10"
             }`}
           >
             <Umbrella className={`w-3.5 h-3.5 ${shadingMode ? "animate-bounce text-amber-400" : ""}`} />
             {shadingMode ? "Shading Active" : "Passive Shading"}
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

        {/* HVAC Twin Control Toolbar */}
        <div className="glass-panel rounded-xl p-2.5 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-burgundy-300">
            <Snowflake className="w-3.5 h-3.5 text-burgundy-400 animate-spin" style={{ animationDuration: "12s" }} />
            <span>HVAC Digital Twin:</span>
          </div>

          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-lg border border-white/10 font-mono text-[11px]">
            <span className="text-white font-bold">{hvacNodes.filter((n) => n.active).length}</span>
            <span className="text-neutral-400">/ {hvacNodes.length} Active</span>
          </div>

          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-lg border border-white/10 font-mono text-[11px]">
            <span className="text-neutral-400">Load:</span>
            <span className="text-burgundy-300 font-bold">
              {hvacNodes
                .filter((n) => n.active)
                .reduce((acc, curr) => acc + curr.coolingCapacityKw, 0)
                .toFixed(1)}{" "}
              kW
            </span>
          </div>

          <button
            onClick={handleAddHvacNode}
            className="px-2.5 py-1 rounded-lg bg-burgundy/80 hover:bg-burgundy text-white text-[11px] font-semibold transition-all flex items-center gap-1 shadow-burgundy border border-burgundy-400/40 ml-1"
            title="Deploy new HVAC node into 3D space"
          >
            <Plus className="w-3 h-3" />
            Add Terminal
          </button>
        </div>

        {isSimulating && (
          <div className="glass-burgundy rounded-lg px-3 py-1.5 text-[11px] font-mono text-burgundy-200 flex items-center gap-2 animate-pulse">
            <Sparkles className="w-3 h-3 text-burgundy-400" />
            SOLVING TRANSIENT PINN HEAT EQUATION...
          </div>
        )}
      </div>

      {/* Floating Top Right: Vector Telemetry Stats & Live IoT Digital Twin */}
      <div className="absolute top-5 right-5 z-10 flex flex-col gap-2.5 w-80 max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pointer-events-auto">
        {/* Vector & Thermal Telemetry Stats */}
        <div className="glass-panel rounded-xl p-4 text-white">
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

        {/* Live IoT Smart Home Sensor Synchronization Dashboard */}
        <IoTWidget onSensorsUpdate={setIotSensors} />

        {/* Natural Ventilation & CFD Streamlines Dashboard */}
        <VentilationWidget
          cfdData={cfdData}
          isSimulating={isCfdSimulating}
          windSpeed={windSpeed}
          onWindSpeedChange={setWindSpeed}
          windDirection={windDirection}
          onWindDirectionChange={setWindDirection}
          windowStates={windowStates}
          onOpenAllWindows={handleOpenAllWindows}
          onCloseAllWindows={handleCloseAllWindows}
          activeMode={ventilationMode}
          onToggleActive={() => setVentilationMode(!ventilationMode)}
        />

        {/* Passive Solar Shading Interventions Toolset */}
        {shadingMode && (
          <ShadingWidget
            elements={shadingElements}
            onAddElement={handleAddShadingElement}
            onUpdateElement={handleUpdateShadingElement}
            onRemoveElement={handleRemoveShadingElement}
            selectedId={selectedShadingId}
            onSelect={setSelectedShadingId}
            onClose={() => setShadingMode(false)}
            onTriggerResimulation={() => {
              setShadingElements((prev) => [...prev]);
            }}
          />
        )}
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
