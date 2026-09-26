"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { FloorplanVectorData, ArchitecturalElement } from "@/types/project";

interface WallMeshProps {
  vectorData: FloorplanVectorData;
  worldScale?: number;    // Extent of building in Three.js units (meters)
  wallHeight?: number;    // Extrusion height in meters
  wireframe?: boolean;
}

interface ExtrudedElementMesh {
  id: string;
  type: string;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
}

export function WallMesh({
  vectorData,
  worldScale = 16.0,
  wallHeight = 2.8,
  wireframe = false,
}: WallMeshProps) {
  // Compute extruded 3D geometries inside useMemo for optimal GPU & CPU performance
  const extrudedElements = useMemo(() => {
    const meshes: ExtrudedElementMesh[] = [];

    if (!vectorData || !vectorData.elements || vectorData.elements.length === 0) {
      return meshes;
    }

    for (const element of vectorData.elements) {
      const coords = element.coordinates;
      if (!coords || coords.length < 3) continue;

      // 1. Construct 2D THREE.Shape on normalized plane centered at origin (0, 0)
      const shape = new THREE.Shape();
      const [startX, startY] = coords[0];
      shape.moveTo((startX - 0.5) * worldScale, (startY - 0.5) * worldScale);

      for (let i = 1; i < coords.length; i++) {
        const [x, y] = coords[i];
        shape.lineTo((x - 0.5) * worldScale, (y - 0.5) * worldScale);
      }

      // 2. Configure extrusion parameters based on architectural element classification
      let depth = wallHeight;
      let elevationY = 0;
      let bevelEnabled = true;

      if (element.type === "window") {
        depth = wallHeight * 0.45; // Window glass height
        elevationY = wallHeight * 0.35; // Sill elevation above floor
        bevelEnabled = false;
      } else if (element.type === "door") {
        depth = 0.08; // Floor threshold indicator
        elevationY = 0.01;
        bevelEnabled = false;
      }

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 1,
        depth: depth,
        bevelEnabled: bevelEnabled,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelSegments: 2,
      };

      try {
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // 3. Rotate geometry from Three.js default XY vertical plane into horizontal XZ ground plane
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();

        meshes.push({
          id: element.id,
          type: element.type,
          geometry: geometry,
          position: [0, elevationY, 0],
        });
      } catch (err) {
        console.warn(`Could not extrude element ${element.id}:`, err);
      }
    }

    return meshes;
  }, [vectorData, worldScale, wallHeight]);

  return (
    <group position={[0, 0, 0]}>
      {extrudedElements.map((item) => {
        if (item.type === "window") {
          return (
            <mesh
              key={item.id}
              geometry={item.geometry}
              position={item.position}
              castShadow
            >
              {/* Translucent Smoked Glass Material with subtle burgundy tint */}
              <meshPhysicalMaterial
                color="#6D001A"
                transmission={0.65}
                opacity={0.5}
                transparent
                roughness={0.15}
                metalness={0.1}
                wireframe={wireframe}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        }

        if (item.type === "door") {
          return (
            <mesh
              key={item.id}
              geometry={item.geometry}
              position={item.position}
            >
              {/* Door Threshold Marker in Accent Burgundy */}
              <meshStandardMaterial
                color="#6D001A"
                roughness={0.3}
                metalness={0.4}
                wireframe={wireframe}
              />
            </mesh>
          );
        }

        // Standard Solid Wall: Matte Dark Graphite / Black with subtle metallic sheen
        return (
          <mesh
            key={item.id}
            geometry={item.geometry}
            position={item.position}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#141414"
              roughness={0.7}
              metalness={0.2}
              wireframe={wireframe}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Architectural Foundation Floor Slab */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[worldScale * 1.05, 0.1, worldScale * 1.05]} />
        <meshStandardMaterial
          color="#080808"
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
