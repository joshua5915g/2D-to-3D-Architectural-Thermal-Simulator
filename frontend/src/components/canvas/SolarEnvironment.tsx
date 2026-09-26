"use client";

import { useMemo } from "react";
import * as THREE from "three";

interface SolarEnvironmentProps {
  azimuthDeg?: number;
  elevationDeg?: number;
  intensity?: number;
}

export function SolarEnvironment({
  azimuthDeg = 145,
  elevationDeg = 42,
  intensity = 1.6,
}: SolarEnvironmentProps) {
  // Convert spherical solar coordinates to 3D Cartesian coordinates
  const sunPosition = useMemo(() => {
    const phi = (90 - elevationDeg) * (Math.PI / 180);
    const theta = (azimuthDeg - 90) * (Math.PI / 180);
    const radius = 25;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }, [azimuthDeg, elevationDeg]);

  return (
    <group>
      {/* Ambient Fill Light */}
      <ambientLight intensity={0.4} color="#FFFFFF" />

      {/* Main Solar Beam */}
      <directionalLight
        position={sunPosition}
        intensity={intensity}
        color="#FFF6E8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
      />

      {/* Subtle Burgundy Ground Bounce Light */}
      <directionalLight
        position={[0, -5, 0]}
        intensity={0.2}
        color="#6D001A"
      />

      {/* Visual Sun Sphere indicator */}
      <mesh position={sunPosition}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial color="#FFE8A3" />
      </mesh>
    </group>
  );
}
