"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Extruded3DGeometry } from "@/types/mesh";
import { ThermalSimulationResult } from "@/types/thermal";

interface ArchitecturalMeshProps {
  meshData?: Extruded3DGeometry | null;
  thermalData?: ThermalSimulationResult | null;
  wireframe?: boolean;
}

export function ArchitecturalMesh({
  meshData,
  thermalData,
  wireframe = false,
}: ArchitecturalMeshProps) {
  // If no dynamic mesh data is provided yet, render an architectural demonstration villa
  const geometry = useMemo(() => {
    if (meshData && meshData.vertices.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(meshData.vertices, 3)
      );

      if (meshData.indices.length > 0) {
        geom.setIndex(meshData.indices);
      }

      if (meshData.normals.length > 0) {
        geom.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(meshData.normals, 3)
        );
      } else {
        geom.computeVertexNormals();
      }

      // If thermal data exists, generate temperature vertex colors
      if (
        thermalData &&
        thermalData.thermalScalarField.length === meshData.vertices.length / 3
      ) {
        const colors: number[] = [];
        const minT = 18;
        const maxT = 38;

        for (const temp of thermalData.thermalScalarField) {
          const t = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));
          // Color ramp: Black (0.0) -> Burgundy #6D001A (0.5) -> White #FFFFFF (1.0)
          let color: THREE.Color;
          if (t < 0.5) {
            const factor = t / 0.5;
            color = new THREE.Color().lerpColors(
              new THREE.Color("#050002"),
              new THREE.Color("#6D001A"),
              factor
            );
          } else {
            const factor = (t - 0.5) / 0.5;
            color = new THREE.Color().lerpColors(
              new THREE.Color("#6D001A"),
              new THREE.Color("#FFFFFF"),
              factor
            );
          }
          colors.push(color.r, color.g, color.b);
        }
        geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      }

      return geom;
    }

    return null;
  }, [meshData, thermalData]);

  // Fallback demo architectural building if awaiting processing
  if (!geometry) {
    return (
      <group position={[0, 0, 0]}>
        {/* Exterior Perimeter Walls with burgundy accents */}
        <mesh position={[0, 1.4, -4]} castShadow receiveShadow>
          <boxGeometry args={[10, 2.8, 0.25]} />
          <meshStandardMaterial
            color="#6D001A"
            roughness={0.4}
            metalness={0.2}
            wireframe={wireframe}
          />
        </mesh>
        <mesh position={[0, 1.4, 4]} castShadow receiveShadow>
          <boxGeometry args={[10, 2.8, 0.25]} />
          <meshStandardMaterial
            color="#3D000F"
            roughness={0.4}
            metalness={0.2}
            wireframe={wireframe}
          />
        </mesh>
        <mesh position={[-5, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 2.8, 8]} />
          <meshStandardMaterial
            color="#550014"
            roughness={0.4}
            metalness={0.2}
            wireframe={wireframe}
          />
        </mesh>
        <mesh position={[5, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 2.8, 8]} />
          <meshStandardMaterial
            color="#8B0022"
            roughness={0.4}
            metalness={0.2}
            wireframe={wireframe}
          />
        </mesh>

        {/* Interior Partition Wall */}
        <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 2.8, 5]} />
          <meshStandardMaterial
            color="#262626"
            roughness={0.7}
            wireframe={wireframe}
          />
        </mesh>

        {/* Foundation Slab */}
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <boxGeometry args={[10.5, 0.1, 8.5]} />
          <meshStandardMaterial color="#0A0A0A" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  const hasVertexColors = geometry.hasAttribute("color");

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors={hasVertexColors}
        color={hasVertexColors ? undefined : "#6D001A"}
        roughness={0.35}
        metalness={0.2}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
