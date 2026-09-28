"use client";

import React, { useState } from "react";
import { ExteriorShadingElement, ShadingElementType } from "@/types/thermal";

// --- 3D R3F MESH COMPONENT ---

interface ExteriorShadingSceneProps {
  elements: ExteriorShadingElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove?: (id: string, newPos: [number, number, number]) => void;
}

export function ExteriorShadingScene({
  elements,
  selectedId,
  onSelect,
}: ExteriorShadingSceneProps) {
  return (
    <group name="exterior-shading-group">
      {elements.map((el) => {
        const isSelected = el.id === selectedId;

        if (el.type === "tree") {
          const [radius, , height] = el.dimensions;
          const canopyHeight = height * 0.65;
          const trunkHeight = height * 0.35;
          const trunkRadius = Math.max(0.12, radius * 0.08);

          return (
            <group
              key={el.id}
              position={[el.position[0], el.position[2] ?? 0, el.position[1]]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : el.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              {/* Selection Ring */}
              {isSelected && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[radius * 0.9, radius * 1.05, 32]} />
                  <meshBasicMaterial color="#FF1744" transparent opacity={0.8} />
                </mesh>
              )}

              {/* Tree Trunk */}
              <mesh position={[0, trunkHeight / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[trunkRadius * 0.8, trunkRadius * 1.2, trunkHeight, 12]} />
                <meshStandardMaterial color="#2d1e18" roughness={0.9} />
              </mesh>

              {/* Primary Canopy */}
              <mesh
                position={[0, trunkHeight + canopyHeight * 0.45, 0]}
                castShadow
                receiveShadow
              >
                <dodecahedronGeometry args={[radius * 0.85, 1]} />
                <meshStandardMaterial
                  color={isSelected ? "#8B0021" : "#1B4332"}
                  emissive={isSelected ? "#6D001A" : "#0D2818"}
                  emissiveIntensity={isSelected ? 0.6 : 0.2}
                  roughness={0.7}
                  metalness={0.1}
                />
              </mesh>

              {/* Secondary Upper Canopy */}
              <mesh
                position={[0, trunkHeight + canopyHeight * 0.8, 0]}
                castShadow
                receiveShadow
              >
                <dodecahedronGeometry args={[radius * 0.6, 1]} />
                <meshStandardMaterial
                  color={isSelected ? "#B71C1C" : "#2D6A4F"}
                  emissive={isSelected ? "#8B0000" : "#143621"}
                  emissiveIntensity={isSelected ? 0.7 : 0.2}
                  roughness={0.65}
                />
              </mesh>
            </group>
          );
        }

        if (el.type === "overhang") {
          const [width, depth, thickness] = el.dimensions;
          return (
            <group
              key={el.id}
              position={[el.position[0], el.position[2] ?? 2.8, el.position[1]]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : el.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              {/* Cantilever Slab */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[width, thickness, depth]} />
                <meshStandardMaterial
                  color={isSelected ? "#4A0012" : "#1A1A1A"}
                  roughness={0.4}
                  metalness={0.8}
                />
              </mesh>

              {/* Glowing Burgundy Edge Trim */}
              <mesh position={[0, -thickness / 2 - 0.01, depth / 2]}>
                <boxGeometry args={[width, 0.04, 0.04]} />
                <meshBasicMaterial color={isSelected ? "#FF1744" : "#6D001A"} />
              </mesh>
            </group>
          );
        }

        if (el.type === "louver") {
          const [width, depth, height] = el.dimensions;
          const slatCount = Math.max(3, Math.round(height / 0.25));
          const slatPitchRad = ((el.angle_deg ?? 45) * Math.PI) / 180;

          return (
            <group
              key={el.id}
              position={[el.position[0], el.position[2] ?? 1.5, el.position[1]]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : el.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              {/* Louver Slats */}
              {Array.from({ length: slatCount }).map((_, i) => {
                const yOffset = -height / 2 + (i + 0.5) * (height / slatCount);
                return (
                  <mesh
                    key={i}
                    position={[0, yOffset, 0]}
                    rotation={[slatPitchRad, 0, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[width, 0.02, depth]} />
                    <meshStandardMaterial
                      color={isSelected ? "#6D001A" : "#333333"}
                      metalness={0.7}
                      roughness={0.3}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}

// --- HUD CONTROLS WIDGET ---

interface ShadingWidgetProps {
  elements: ExteriorShadingElement[];
  onAddElement: (type: ShadingElementType) => void;
  onUpdateElement: (id: string, updates: Partial<ExteriorShadingElement>) => void;
  onRemoveElement: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onTriggerResimulation: () => void;
}

export function ShadingWidget({
  elements,
  onAddElement,
  onUpdateElement,
  onRemoveElement,
  selectedId,
  onSelect,
  onClose,
  onTriggerResimulation,
}: ShadingWidgetProps) {
  const selectedElem = elements.find((e) => e.id === selectedId);

  // Compute aggregate stats
  const treeCount = elements.filter((e) => e.type === "tree").length;
  const overhangCount = elements.filter((e) => e.type === "overhang").length;
  const louverCount = elements.filter((e) => e.type === "louver").length;

  const estimatedAttenuationPct = Math.min(
    92,
    Math.round(treeCount * 22 + overhangCount * 18 + louverCount * 28)
  );

  return (
    <div className="flex flex-col gap-3 p-4 bg-black/95 backdrop-blur-xl border border-neutral-800 rounded-xl shadow-2xl text-white w-80 font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#6D001A] animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-semibold text-white">
            Passive Solar Shading
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded border border-neutral-800"
        >
          ✕
        </button>
      </div>

      {/* Aggregate Telemetry */}
      <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/60">
        <div>
          <span className="text-[10px] text-neutral-400 block">SOLAR REDUCTION</span>
          <span className="text-base font-bold text-white tracking-tight">
            ~{estimatedAttenuationPct}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 block">INTERVENTIONS</span>
          <span className="text-base font-bold text-[#FF1744] tracking-tight">
            {elements.length} ACTIVE
          </span>
        </div>
      </div>

      {/* Add Element Toolset */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
          Place Exterior Interventions
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onAddElement("tree")}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-[#6D001A]/30 hover:border-[#6D001A] transition-all text-center group"
          >
            <span className="text-sm mb-0.5">🌳</span>
            <span className="text-[10px] font-medium text-neutral-300 group-hover:text-white">
              Tree
            </span>
          </button>

          <button
            onClick={() => onAddElement("overhang")}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-[#6D001A]/30 hover:border-[#6D001A] transition-all text-center group"
          >
            <span className="text-sm mb-0.5">⛩️</span>
            <span className="text-[10px] font-medium text-neutral-300 group-hover:text-white">
              Overhang
            </span>
          </button>

          <button
            onClick={() => onAddElement("louver")}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-[#6D001A]/30 hover:border-[#6D001A] transition-all text-center group"
          >
            <span className="text-sm mb-0.5">▦</span>
            <span className="text-[10px] font-medium text-neutral-300 group-hover:text-white">
              Louvers
            </span>
          </button>
        </div>
      </div>

      {/* Selected Element Parameters */}
      {selectedElem ? (
        <div className="space-y-2.5 p-2.5 rounded-lg border border-[#6D001A]/60 bg-neutral-950/80">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
            <span className="text-[11px] font-bold text-white uppercase">
              {selectedElem.type} ({selectedElem.id})
            </span>
            <button
              onClick={() => onRemoveElement(selectedElem.id)}
              className="text-[10px] text-red-400 hover:text-red-300 hover:underline"
            >
              Remove
            </button>
          </div>

          {selectedElem.type === "tree" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-400">Canopy Radius</span>
                <span className="text-white font-semibold">
                  {selectedElem.dimensions[0].toFixed(1)} m
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.2"
                value={selectedElem.dimensions[0]}
                onChange={(e) => {
                  const r = parseFloat(e.target.value);
                  onUpdateElement(selectedElem.id, {
                    dimensions: [r, r, selectedElem.dimensions[2]],
                  });
                }}
                className="w-full accent-[#FF1744] h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />

              <div className="flex justify-between text-[10px] pt-1">
                <span className="text-neutral-400">Tree Height</span>
                <span className="text-white font-semibold">
                  {selectedElem.dimensions[2].toFixed(1)} m
                </span>
              </div>
              <input
                type="range"
                min="2.5"
                max="8.0"
                step="0.5"
                value={selectedElem.dimensions[2]}
                onChange={(e) => {
                  const h = parseFloat(e.target.value);
                  onUpdateElement(selectedElem.id, {
                    dimensions: [selectedElem.dimensions[0], selectedElem.dimensions[1], h],
                  });
                }}
                className="w-full accent-[#FF1744] h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {selectedElem.type === "overhang" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-400">Projection Depth</span>
                <span className="text-white font-semibold">
                  {selectedElem.dimensions[1].toFixed(1)} m
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.1"
                value={selectedElem.dimensions[1]}
                onChange={(e) => {
                  const d = parseFloat(e.target.value);
                  onUpdateElement(selectedElem.id, {
                    dimensions: [selectedElem.dimensions[0], d, selectedElem.dimensions[2]],
                  });
                }}
                className="w-full accent-[#FF1744] h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {selectedElem.type === "louver" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-400">Blade Angle</span>
                <span className="text-white font-semibold">
                  {selectedElem.angle_deg ?? 45}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="75"
                step="5"
                value={selectedElem.angle_deg ?? 45}
                onChange={(e) => {
                  const a = parseFloat(e.target.value);
                  onUpdateElement(selectedElem.id, { angle_deg: a });
                }}
                className="w-full accent-[#FF1744] h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-neutral-500 italic p-2 border border-neutral-900 rounded bg-neutral-950/40 text-center">
          Click any 3D tree, overhang, or louver to configure parameters.
        </div>
      )}

      {/* Recalculate PINN simulation */}
      <button
        onClick={onTriggerResimulation}
        className="w-full py-2 px-3 rounded-lg bg-[#6D001A] hover:bg-[#8B0021] text-white text-xs font-semibold tracking-wider uppercase transition-colors shadow-lg shadow-[#6D001A]/30 flex items-center justify-center gap-2"
      >
        <span>Apply Shading & Re-Simulate</span>
      </button>
    </div>
  );
}
