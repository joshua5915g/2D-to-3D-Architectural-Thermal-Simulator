"use client";

import { OrbitControls } from "@react-three/drei";

export function CameraControls() {
  return (
    <OrbitControls
      makeDefault
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2 - 0.05} // Keep slightly above horizon
      minDistance={4}
      maxDistance={40}
      enableDamping
      dampingFactor={0.05}
    />
  );
}
