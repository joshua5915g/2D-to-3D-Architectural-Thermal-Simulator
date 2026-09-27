"use client";

import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FloorplanVectorData } from "@/types/project";
import "@/shaders/ThermalShaderMaterial";

interface WallMeshProps {
  vectorData: FloorplanVectorData;
  worldScale?: number;        // Extent of building in Three.js units (meters)
  wallHeight?: number;        // Extrusion height in meters
  wireframe?: boolean;
  thermalMode?: boolean;      // Toggle custom PINN thermal shader
  thermalGrids?: number[][][];// 24 hourly slices of [N, N] temperature matrix
  temperatureRange?: [number, number]; // [minTemp, maxTemp]
  activeHour?: number;
  activeHourRef?: React.MutableRefObject<number>;
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
  thermalMode = false,
  thermalGrids,
  temperatureRange = [20.0, 32.0],
  activeHour = 12.0,
  activeHourRef,
}: WallMeshProps) {
  // Shared ref for the active ThermalShaderMaterial
  const thermalMaterialRef = useRef<any>(null);
  const lastTextureHourRef = useRef<number>(-1);

  // 1. Generate 24 DataTextures from the PINN temporal grids
  const dataTextures = useMemo(() => {
    if (!thermalGrids || thermalGrids.length === 0) {
      // Procedural synthetic diurnal heat map fallback if no simulation loaded yet
      const fallbackTextures: THREE.DataTexture[] = [];
      const N = 24;
      for (let h = 0; h < 24; h++) {
        const buffer = new Uint8Array(N * N * 4);
        const sunFactor = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            const idx = (r * N + c) * 4;
            // Radial heat distribution from center with southern solar bias
            const dx = (c / N) - 0.5;
            const dy = (r / N) - 0.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const val = Math.max(0, Math.min(1, 0.2 + (sunFactor * 0.7 * (1.0 - dist * 0.9))));
            buffer[idx + 0] = Math.round(val * 255);
            buffer[idx + 1] = 0;
            buffer[idx + 2] = 0;
            buffer[idx + 3] = 255;
          }
        }
        const tex = new THREE.DataTexture(buffer, N, N, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        fallbackTextures.push(tex);
      }
      return fallbackTextures;
    }

    const [minT, maxT] = temperatureRange;
    const deltaT = Math.max(0.01, maxT - minT);

    return thermalGrids.map((grid) => {
      const N = grid.length;
      const buffer = new Uint8Array(N * N * 4);
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const idx = (r * N + c) * 4;
          const temp = grid[r][c];
          const norm = Math.max(0, Math.min(1, (temp - minT) / deltaT));
          buffer[idx + 0] = Math.round(norm * 255);
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
          buffer[idx + 3] = 255;
        }
      }
      const tex = new THREE.DataTexture(buffer, N, N, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    });
  }, [thermalGrids, temperatureRange]);

  // 2. High-performance useFrame loop: update uniforms via mutable ref without React re-render
  useFrame((state) => {
    if (!thermalMaterialRef.current) return;

    // Read high-frequency mutable ref (from timeline slider)
    const currentHour = activeHourRef ? activeHourRef.current : activeHour;
    thermalMaterialRef.current.uTime = state.clock.getElapsedTime();

    // Map float hour [0, 24) to integer index [0, 23]
    const hourIdx = Math.floor(THREE.MathUtils.clamp(currentHour, 0, 23.99));

    if (hourIdx !== lastTextureHourRef.current && dataTextures[hourIdx]) {
      thermalMaterialRef.current.uThermalData = dataTextures[hourIdx];
      lastTextureHourRef.current = hourIdx;
    }
  });

  // 3. Compute extruded 3D geometries with Planar UV mapping aligned to floorplan bounds
  const extrudedElements = useMemo(() => {
    const meshes: ExtrudedElementMesh[] = [];

    if (!vectorData || !vectorData.elements || vectorData.elements.length === 0) {
      return meshes;
    }

    for (const element of vectorData.elements) {
      const coords = element.coordinates;
      if (!coords || coords.length < 3) continue;

      // Construct 2D THREE.Shape on normalized plane centered at origin
      const shape = new THREE.Shape();
      const [startX, startY] = coords[0];
      shape.moveTo((startX - 0.5) * worldScale, (startY - 0.5) * worldScale);

      for (let i = 1; i < coords.length; i++) {
        const [x, y] = coords[i];
        shape.lineTo((x - 0.5) * worldScale, (y - 0.5) * worldScale);
      }

      // Configure extrusion parameters
      let depth = wallHeight;
      let elevationY = 0;
      let bevelEnabled = true;

      if (element.type === "window") {
        depth = wallHeight * 0.45;
        elevationY = wallHeight * 0.35;
        bevelEnabled = false;
      } else if (element.type === "door") {
        depth = 0.08;
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

        // Rotate from XY vertical into XZ ground plane
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();

        // Custom Planar UV mapping: Maps world XZ directly to [0.0, 1.0] floorplan bounding box
        const posAttr = geometry.getAttribute("position");
        if (posAttr) {
          const uvs = new Float32Array(posAttr.count * 2);
          for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vz = posAttr.getZ(i);
            // Map from [-worldScale/2, worldScale/2] to [0.0, 1.0]
            const u = THREE.MathUtils.clamp(vx / worldScale + 0.5, 0.0, 1.0);
            const v = THREE.MathUtils.clamp(vz / worldScale + 0.5, 0.0, 1.0);
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
          }
          geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        }

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
              {/* Translucent Glass Material with subtle burgundy tint */}
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
              {/* Door Threshold Marker */}
              <meshStandardMaterial
                color="#6D001A"
                roughness={0.3}
                metalness={0.4}
                wireframe={wireframe}
              />
            </mesh>
          );
        }

        // Solid Walls: Thermal Shader Material or Matte Charcoal Standard Material
        return (
          <mesh
            key={item.id}
            geometry={item.geometry}
            position={item.position}
            castShadow
            receiveShadow
          >
            {thermalMode ? (
              <thermalShaderMaterial
                ref={thermalMaterialRef}
                wireframe={wireframe}
                uTemperatureRange={new THREE.Vector2(temperatureRange[0], temperatureRange[1])}
                uColdColor={new THREE.Color("#000000")}
                uHotColor={new THREE.Color("#6D001A")}
                uEmissiveIntensity={1.8}
                side={THREE.DoubleSide}
              />
            ) : (
              <meshStandardMaterial
                color="#141414"
                roughness={0.7}
                metalness={0.2}
                wireframe={wireframe}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>
        );
      })}

      {/* Architectural Foundation Floor Slab with Thermal Radiant Floor if thermalMode active */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[worldScale * 1.05, 0.1, worldScale * 1.05]} />
        {thermalMode ? (
          <thermalShaderMaterial
            uTemperatureRange={new THREE.Vector2(temperatureRange[0], temperatureRange[1])}
            uColdColor={new THREE.Color("#000000")}
            uHotColor={new THREE.Color("#6D001A")}
            uEmissiveIntensity={0.8}
          />
        ) : (
          <meshStandardMaterial
            color="#080808"
            roughness={0.85}
            metalness={0.1}
          />
        )}
      </mesh>
    </group>
  );
}
