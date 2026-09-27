"use client";

import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

// Create fallback 1x1 initial black texture
const defaultTexture = new THREE.DataTexture(
  new Uint8Array([0, 0, 0, 255]),
  1,
  1,
  THREE.RGBAFormat
);
defaultTexture.needsUpdate = true;

/**
 * Custom Three.js Thermal Shader Material
 * Maps normalized PINN thermal data textures onto 3D surfaces
 * transitioning strictly from Cold Black (#000000) to Hot Burgundy (#6D001A)
 * with a high-intensity emissive radiative glow on thermal hotspots.
 */
export const ThermalShaderMaterial = shaderMaterial(
  {
    uTime: 0.0,
    uThermalData: defaultTexture,
    uTemperatureRange: new THREE.Vector2(18.0, 36.0),
    uColdColor: new THREE.Color("#000000"),
    uHotColor: new THREE.Color("#6D001A"),
    uEmissiveIntensity: 1.6,
  },
  // Vertex Shader
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  // Fragment Shader
  /* glsl */ `
    precision highp float;

    uniform sampler2D uThermalData;
    uniform vec2 uTemperatureRange; // x = minTemp, y = maxTemp
    uniform float uTime;
    uniform vec3 uColdColor;       // #000000 (Black baseline)
    uniform vec3 uHotColor;        // #6D001A (Burgundy thermal peak)
    uniform float uEmissiveIntensity;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      // 1. Sample temperature scalar from the PINN DataTexture
      float rawTemp = texture2D(uThermalData, vUv).r;

      // 2. Normalize temperature into [0.0, 1.0] based on simulation bounds
      float minT = uTemperatureRange.x;
      float maxT = max(uTemperatureRange.y, minT + 0.001);
      float tNorm = clamp((rawTemp - minT) / (maxT - minT), 0.0, 1.0);

      // 3. Smooth non-linear hermite interpolation between Black and Burgundy
      float colorFactor = smoothstep(0.0, 1.0, tNorm);
      vec3 baseColor = mix(uColdColor, uHotColor, colorFactor);

      // 4. Emissive radiative gain for high thermal flux concentration
      // Non-linear power curve ensures radiant core glow at peak temperatures
      float peakGlow = pow(tNorm, 2.8) * uEmissiveIntensity;
      vec3 emissiveColor = uHotColor * (1.0 + peakGlow * 1.6);

      // Subtle architectural edge highlight to preserve geometric silhouette
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float rimFactor = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
      vec3 rimLight = uHotColor * pow(rimFactor, 3.0) * 0.45 * tNorm;

      // Composite final thermal radiation color
      vec3 finalColor = baseColor + (emissiveColor * peakGlow * 0.5) + rimLight;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Register custom element into React Three Fiber
extend({ ThermalShaderMaterial });

// Type definitions for React JSX
declare module "@react-three/fiber" {
  interface ThreeElements {
    thermalShaderMaterial: any;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      thermalShaderMaterial: any;
    }
  }
}
