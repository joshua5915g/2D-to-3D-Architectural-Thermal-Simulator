"use client";

import React, { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { FloorplanVectorData } from "@/types/project";
import { WindowStateData, CFDSimulationResponse } from "@/types/thermal";
import { Wind, Compass, Gauge, Sparkles, CheckCircle2, XCircle } from "lucide-react";

interface WindMeshProps {
  vectorData: FloorplanVectorData;
  cfdData?: CFDSimulationResponse | null;
  windowStates: Record<string, boolean>; // window_id -> is_open
  onToggleWindow: (windowId: string) => void;
  worldScale?: number;
  wallHeight?: number;
  windSpeedMps?: number;
  windDirectionDeg?: number;
}

/**
 * Animated Particle flowing along a streamline curve
 */
function StreamlineParticle({
  curve,
  speed,
  offset,
}: {
  curve: THREE.CatmullRomCurve3;
  speed: number;
  offset: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.elapsedTime * 0.18 * speed + offset) % 1.0;
    const pt = curve.getPointAt(t);
    meshRef.current.position.copy(pt);

    // Pulse size slightly based on speed
    const scale = 0.08 + Math.min(0.08, speed * 0.03);
    meshRef.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#FF3366" transparent opacity={0.85} />
    </mesh>
  );
}

/**
 * Single 3D Wind Streamline Tube with Burgundy Color Mapping
 */
function SingleStreamline({
  points,
  worldScale,
  wallHeight,
}: {
  points: [number, number, number, number][];
  worldScale: number;
  wallHeight: number;
}) {
  const { curve, avgSpeed, colors } = useMemo(() => {
    const vectors = points.map((p) => {
      const wx = (p[0] - 0.5) * worldScale;
      const wz = (p[1] - 0.5) * worldScale;
      const wy = Math.max(0.1, p[2] * wallHeight);
      return new THREE.Vector3(wx, wy, wz);
    });

    const curve = new THREE.CatmullRomCurve3(vectors);
    const speeds = points.map((p) => p[3]);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

    // Generate vertex colors based on local velocity
    const colors: number[] = [];
    const colorLow = new THREE.Color("#2A000A");
    const colorMed = new THREE.Color("#6D001A");
    const colorHigh = new THREE.Color("#FF1744");

    for (const p of points) {
      const spd = p[3];
      const c = new THREE.Color();
      if (spd < 0.8) {
        c.lerpColors(colorLow, colorMed, spd / 0.8);
      } else {
        c.lerpColors(colorMed, colorHigh, Math.min(1.0, (spd - 0.8) / 1.5));
      }
      colors.push(c.r, c.g, c.b);
    }

    return { curve, avgSpeed, colors };
  }, [points, worldScale, wallHeight]);

  const tubeGeo = useMemo(() => {
    return new THREE.TubeGeometry(curve, Math.max(20, points.length * 3), 0.04, 8, false);
  }, [curve, points.length]);

  return (
    <group>
      {/* Glowing Burgundy Streamline Tube */}
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color={avgSpeed > 1.0 ? "#990024" : "#6D001A"}
          emissive={avgSpeed > 1.0 ? "#6D001A" : "#30000C"}
          emissiveIntensity={avgSpeed > 1.0 ? 2.2 : 0.9}
          roughness={0.2}
          metalness={0.7}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Floating Animated Flow Particles */}
      <StreamlineParticle curve={curve} speed={avgSpeed} offset={0.0} />
      <StreamlineParticle curve={curve} speed={avgSpeed} offset={0.5} />
    </group>
  );
}

/**
 * Operable Interactive Window Sash
 */
function OperableWindowPane({
  element,
  isOpen,
  onToggle,
  worldScale,
  wallHeight,
}: {
  element: any;
  isOpen: boolean;
  onToggle: () => void;
  worldScale: number;
  wallHeight: number;
}) {
  const [hovered, setHovered] = useState(false);

  const { center, length, angle } = useMemo(() => {
    const coords = element.coordinates;
    const p1 = coords[0];
    const p2 = coords[coords.length - 1];

    const wx1 = (p1[0] - 0.5) * worldScale;
    const wz1 = (p1[1] - 0.5) * worldScale;
    const wx2 = (p2[0] - 0.5) * worldScale;
    const wz2 = (p2[1] - 0.5) * worldScale;

    const cx = (wx1 + wx2) / 2.0;
    const cz = (wz1 + wz2) / 2.0;
    const len = Math.hypot(wx2 - wx1, wz2 - wz1);
    const ang = Math.atan2(wz2 - wz1, wx2 - wx1);

    return {
      center: [cx, wallHeight * 0.45, cz] as [number, number, number],
      length: Math.max(0.6, len),
      angle: ang,
    };
  }, [element, worldScale, wallHeight]);

  // Window pivots outwards when open
  const openRotation = isOpen ? 0.65 : 0.0;

  return (
    <group position={center} rotation={[0, -angle + openRotation, 0]}>
      {/* Clickable Window Glass Sash */}
      <mesh
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[length * 0.95, wallHeight * 0.45, 0.06]} />
        <meshPhysicalMaterial
          color={isOpen ? "#6D001A" : "#1A1A1A"}
          emissive={isOpen ? "#6D001A" : "#000000"}
          emissiveIntensity={isOpen ? 1.6 : hovered ? 0.8 : 0.1}
          transmission={isOpen ? 0.75 : 0.5}
          opacity={0.7}
          transparent
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Frame Border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(length * 0.95, wallHeight * 0.45, 0.06)]} />
        <lineBasicMaterial color={isOpen ? "#FF2A55" : "#555555"} linewidth={2} />
      </lineSegments>

      {/* Floating 3D Badge on Hover or Active */}
      {(hovered || isOpen) && (
        <Html position={[0, wallHeight * 0.35, 0]} center distanceFactor={16}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="cursor-pointer glass-panel px-2.5 py-1 rounded-lg text-white font-mono text-[10px] flex items-center gap-1.5 shadow-2xl border border-white/20 whitespace-nowrap bg-black/85 select-none"
          >
            {isOpen ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-burgundy-400" />
                <span className="font-bold text-white">OPEN (Click to Close)</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-neutral-400" />
                <span className="text-neutral-300">CLOSED (Click to Open)</span>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export function WindMesh({
  vectorData,
  cfdData,
  windowStates,
  onToggleWindow,
  worldScale = 16.0,
  wallHeight = 2.8,
}: WindMeshProps) {
  // Extract all window elements from floorplan
  const windowElements = useMemo(() => {
    return vectorData.elements.filter((el) => el.type === "window");
  }, [vectorData]);

  const streamlines = cfdData?.streamlines || [];

  return (
    <group>
      {/* 1. Animated CFD Navier-Stokes Streamlines */}
      {streamlines.map((pts, idx) => (
        <SingleStreamline
          key={`streamline-${idx}`}
          points={pts}
          worldScale={worldScale}
          wallHeight={wallHeight}
        />
      ))}

      {/* 2. Operable 3D Windows */}
      {windowElements.map((el) => {
        const isOpen = windowStates[el.id] ?? true;
        return (
          <OperableWindowPane
            key={el.id}
            element={el}
            isOpen={isOpen}
            onToggle={() => onToggleWindow(el.id)}
            worldScale={worldScale}
            wallHeight={wallHeight}
          />
        );
      })}
    </group>
  );
}
