"use client";

import React, { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { HVACNodeData } from "@/types/thermal";
import { Snowflake, Power, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface HVACNodeProps {
  node: HVACNodeData;
  onPositionChange: (id: string, newPos: [number, number, number]) => void;
  onToggleActive?: (id: string) => void;
  onSetpointChange?: (id: string, newSetpoint: number) => void;
  onDelete?: (id: string) => void;
  worldScale?: number;
}

export function HVACNode({
  node,
  onPositionChange,
  onToggleActive,
  onSetpointChange,
  onDelete,
  worldScale = 16.0,
}: HVACNodeProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -node.position[1]));
  const planeIntersect = useRef(new THREE.Vector3());

  // Subtle emissive pulse animation for active cooling terminal
  useFrame((state) => {
    if (sphereRef.current && node.active) {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.06;
      sphereRef.current.scale.set(pulse, pulse, pulse);
    }
    if (ringRef.current && node.active) {
      ringRef.current.rotation.z += 0.008;
    }
  });

  // Pointer drag interactions on horizontal XZ plane
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    // @ts-ignore
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(false);
    // @ts-ignore
    e.target.releasePointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    e.stopPropagation();

    // Raycast onto horizontal plane
    if (e.ray.intersectPlane(dragPlane.current, planeIntersect.current)) {
      const halfBound = (worldScale / 2.0) * 0.95;
      const clampedX = Math.max(-halfBound, Math.min(halfBound, planeIntersect.current.x));
      const clampedZ = Math.max(-halfBound, Math.min(halfBound, planeIntersect.current.z));

      onPositionChange(node.id, [
        round2(clampedX),
        node.position[1],
        round2(clampedZ),
      ]);
    }
  };

  const round2 = (num: number) => Math.round(num * 100) / 100;

  const floorHeightOffset = -node.position[1] + 0.02;

  return (
    <group position={node.position}>
      {/* 1. Glowing Burgundy 3D Sphere */}
      <mesh
        ref={sphereRef}
        castShadow
        onPointerDown={(e) => {
          document.body.style.cursor = "grabbing";
          handlePointerDown(e);
        }}
        onPointerUp={(e) => {
          document.body.style.cursor = "grab";
          handlePointerUp(e);
        }}
        onPointerMove={handlePointerMove}
        onPointerOver={() => {
          document.body.style.cursor = "grab";
          setShowTooltip(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          if (!isDragging) setShowTooltip(false);
        }}
      >
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color="#6D001A"
          emissive="#6D001A"
          emissiveIntensity={node.active ? 2.8 : 0.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 2. Outer Halo Glow (Atmospheric Cooling Indicator) */}
      {node.active && (
        <mesh scale={[1.2, 1.2, 1.2]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial
            color="#6D001A"
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* 3. Downward Diffuser Plume Projection Ring on Floor */}
      {node.active && (
        <mesh
          ref={ringRef}
          position={[0, floorHeightOffset, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <ringGeometry args={[0.7, 1.9, 32]} />
          <meshBasicMaterial
            color="#6D001A"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Center drop-line to floor plane */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, floorHeightOffset, 0),
            ]);
          }}
        />
        <lineBasicMaterial
          attach="material"
          color="#6D001A"
          transparent
          opacity={0.5}
        />
      </line>

      {/* 4. Floating 3D HTML Tooltip Badge */}
      <Html
        position={[0, 0.65, 0]}
        center
        distanceFactor={18}
        style={{
          pointerEvents: "auto",
          userSelect: "none",
          transition: "opacity 0.2s ease",
          opacity: showTooltip || isDragging ? 1 : 0.85,
        }}
      >
        <div className="glass-panel px-3 py-1.5 rounded-xl text-white shadow-2xl border border-white/15 flex items-center gap-2 whitespace-nowrap bg-black/85 backdrop-blur-md text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Snowflake className={`w-3.5 h-3.5 ${node.active ? "text-burgundy-400 animate-spin" : "text-neutral-500"}`} style={{ animationDuration: "8s" }} />
            <span className="font-bold text-white text-[11px]">{node.name}</span>
          </div>

          <div className="h-3 w-[1px] bg-white/20" />

          {/* Setpoint Stepper */}
          <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
            <span className="text-[11px] font-bold text-burgundy-300">
              {node.setpointCelsius.toFixed(1)}°C
            </span>
            {onSetpointChange && (
              <div className="flex flex-col ml-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetpointChange(node.id, Math.min(28.0, node.setpointCelsius + 0.5));
                  }}
                  className="hover:text-burgundy-300 text-neutral-400"
                >
                  <ChevronUp className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetpointChange(node.id, Math.max(16.0, node.setpointCelsius - 0.5));
                  }}
                  className="hover:text-burgundy-300 text-neutral-400"
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Power Toggle */}
          {onToggleActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive(node.id);
              }}
              className={`p-1 rounded transition-colors ${
                node.active
                  ? "bg-burgundy text-white shadow-burgundy"
                  : "bg-white/10 text-neutral-400 hover:text-white"
              }`}
              title={node.active ? "Power Off Terminal" : "Power On Terminal"}
            >
              <Power className="w-3 h-3" />
            </button>
          )}

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="p-1 rounded bg-white/5 hover:bg-red-950/60 text-neutral-400 hover:text-red-300 transition-colors"
              title="Remove Terminal"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </Html>
    </group>
  );
}
