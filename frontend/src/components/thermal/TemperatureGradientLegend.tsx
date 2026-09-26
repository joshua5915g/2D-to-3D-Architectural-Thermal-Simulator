"use client";

import React from "react";

interface TemperatureGradientLegendProps {
  minTemp?: number;
  maxTemp?: number;
}

export function TemperatureGradientLegend({
  minTemp = 18,
  maxTemp = 38,
}: TemperatureGradientLegendProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/80 backdrop-blur-md p-4 w-72 text-white shadow-2xl">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase font-bold tracking-wider text-neutral-300">
          Thermal Gradient
        </span>
        <span className="text-xs text-neutral-400 font-mono">PINN Field</span>
      </div>

      {/* Gradient Bar: Black -> Burgundy -> White */}
      <div
        className="h-3 w-full rounded-full border border-white/20 shadow-inner"
        style={{
          background:
            "linear-gradient(to right, #050002 0%, #6D001A 50%, #FF6584 80%, #FFFFFF 100%)",
        }}
      />

      <div className="flex justify-between text-xs font-mono text-neutral-400 mt-2">
        <span>{minTemp}°C (Cold)</span>
        <span className="text-burgundy-300 font-semibold">
          {((minTemp + maxTemp) / 2).toFixed(0)}°C
        </span>
        <span>{maxTemp}°C (Solar Flux)</span>
      </div>
    </div>
  );
}
