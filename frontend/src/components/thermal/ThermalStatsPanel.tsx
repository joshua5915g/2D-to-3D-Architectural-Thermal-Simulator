"use client";

import React from "react";
import { ThermalSimulationResult } from "@/types/thermal";
import { Sun, Thermometer, Wind, Compass } from "lucide-react";

interface ThermalStatsPanelProps {
  thermal?: ThermalSimulationResult | null;
  ambientTemp?: number;
}

export function ThermalStatsPanel({
  thermal,
  ambientTemp = 28.5,
}: ThermalStatsPanelProps) {
  const solar = thermal?.solarFlux ?? {
    azimuthDeg: 145,
    elevationDeg: 48,
    directNormalIrradianceWm2: 840,
    diffuseHorizontalIrradianceWm2: 120,
  };

  const roomSummaries = thermal?.roomSummaries ?? [
    {
      roomId: "r1",
      roomName: "South-Facing Living Hall",
      averageTempCelsius: 32.4,
      minTempCelsius: 28.1,
      maxTempCelsius: 35.8,
      thermalComfortIndex: "WARM",
    },
    {
      roomId: "r2",
      roomName: "North Bedroom Suite",
      averageTempCelsius: 24.2,
      minTempCelsius: 22.0,
      maxTempCelsius: 25.4,
      thermalComfortIndex: "OPTIMAL",
    },
    {
      roomId: "r3",
      roomName: "Central Atrium Corridor",
      averageTempCelsius: 27.8,
      minTempCelsius: 25.2,
      maxTempCelsius: 29.5,
      thermalComfortIndex: "OPTIMAL",
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-black/85 backdrop-blur-md p-5 text-white w-80 shadow-2xl space-y-4">
      <div className="border-b border-white/10 pb-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-burgundy-400 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-burgundy" />
          PINN Thermodynamic Telemetry
        </h4>
        <p className="text-xs text-neutral-400 mt-0.5">
          Physics-Informed Solar Heat Equation
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-surface p-2.5 rounded-lg border border-white/5">
          <div className="text-neutral-400 flex items-center gap-1.5 mb-1">
            <Sun className="w-3.5 h-3.5 text-yellow-500" />
            Direct DNI
          </div>
          <div className="text-base font-bold font-mono">
            {solar.directNormalIrradianceWm2} <span className="text-xs font-normal">W/m²</span>
          </div>
        </div>

        <div className="bg-surface p-2.5 rounded-lg border border-white/5">
          <div className="text-neutral-400 flex items-center gap-1.5 mb-1">
            <Compass className="w-3.5 h-3.5 text-burgundy-400" />
            Solar Azimuth
          </div>
          <div className="text-base font-bold font-mono">
            {solar.azimuthDeg}° <span className="text-xs font-normal">/ {solar.elevationDeg}°</span>
          </div>
        </div>
      </div>

      {/* Room thermal comfort index */}
      <div className="space-y-2 pt-2">
        <span className="text-xs uppercase font-semibold text-neutral-400">
          Zonal Thermal Distribution
        </span>
        <div className="space-y-2">
          {roomSummaries.map((room) => (
            <div
              key={room.roomId}
              className="bg-[#121212] p-2.5 rounded-lg border border-white/5 text-xs flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-white">{room.roomName}</p>
                <p className="text-neutral-500 font-mono text-[11px]">
                  Min: {room.minTempCelsius.toFixed(1)}° / Max:{" "}
                  {room.maxTempCelsius.toFixed(1)}°
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-burgundy-300 font-mono">
                  {room.averageTempCelsius.toFixed(1)}°C
                </span>
                <div
                  className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                    room.thermalComfortIndex === "OPTIMAL"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-burgundy-950 text-burgundy-300 border border-burgundy-800"
                  }`}
                >
                  {room.thermalComfortIndex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
