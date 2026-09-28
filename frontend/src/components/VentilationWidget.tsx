"use client";

import React from "react";
import { CFDSimulationResponse } from "@/types/thermal";
import {
  Wind,
  Compass,
  Gauge,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCw,
} from "lucide-react";

interface VentilationWidgetProps {
  cfdData: CFDSimulationResponse | null;
  isSimulating: boolean;
  windSpeed: number;
  onWindSpeedChange: (speed: number) => void;
  windDirection: number;
  onWindDirectionChange: (deg: number) => void;
  windowStates: Record<string, boolean>;
  onOpenAllWindows: () => void;
  onCloseAllWindows: () => void;
  activeMode: boolean;
  onToggleActive: () => void;
  className?: string;
}

export function VentilationWidget({
  cfdData,
  isSimulating,
  windSpeed,
  onWindSpeedChange,
  windDirection,
  onWindDirectionChange,
  windowStates,
  onOpenAllWindows,
  onCloseAllWindows,
  activeMode,
  onToggleActive,
  className = "",
}: VentilationWidgetProps) {
  const totalWindows = Object.keys(windowStates).length || 3;
  const openWindows = Object.values(windowStates).filter(Boolean).length;

  const ach = cfdData?.air_changes_per_hour ?? 8.2;
  const efficiency = cfdData?.cross_ventilation_efficiency ?? 68.5;
  const maxVel = cfdData?.max_velocity_mps ?? (windSpeed * 0.85);

  const getCompassDirection = (deg: number) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  };

  return (
    <div
      className={`glass-panel rounded-2xl border border-white/10 text-white shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 ${className}`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.88)" }}
    >
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#6D001A]/30 border border-[#6D001A]/60 text-burgundy-300">
            <Wind className={`w-4 h-4 ${activeMode ? "animate-pulse text-[#FF2A55]" : "text-neutral-400"}`} />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-white font-mono flex items-center gap-1.5">
              Natural Ventilation CFD
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#6D001A]/40 text-burgundy-200 border border-[#6D001A]/60">
                NAVIER-STOKES
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 font-mono">
              Stack Effect & Cross-Breeze Coupled
            </div>
          </div>
        </div>

        {/* Mode Toggle Button */}
        <button
          onClick={onToggleActive}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all font-mono flex items-center gap-1.5 ${
            activeMode
              ? "bg-[#6D001A] text-white shadow-[0_0_12px_#6D001A] border border-burgundy-400/50"
              : "bg-surface hover:bg-surface-hover text-neutral-400 border border-white/10"
          }`}
        >
          {activeMode ? "Streamlines Active" : "Enable Flow"}
        </button>
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-3 font-mono text-xs">
        {/* KPI Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#121212] p-2 rounded-xl border border-white/5">
            <div className="text-[9px] uppercase text-neutral-400">Renewal (ACH)</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {ach.toFixed(1)} <span className="text-[10px] font-normal text-neutral-400">/hr</span>
            </div>
          </div>
          <div className="bg-[#121212] p-2 rounded-xl border border-white/5">
            <div className="text-[9px] uppercase text-neutral-400">Efficiency</div>
            <div className="text-sm font-bold text-burgundy-300 mt-0.5">
              {efficiency.toFixed(0)}%
            </div>
          </div>
          <div className="bg-[#121212] p-2 rounded-xl border border-white/5">
            <div className="text-[9px] uppercase text-neutral-400">Peak Draft</div>
            <div className="text-sm font-bold text-neutral-200 mt-0.5">
              {maxVel.toFixed(1)} <span className="text-[10px] font-normal text-neutral-400">m/s</span>
            </div>
          </div>
        </div>

        {/* Ambient Wind Controls */}
        <div className="space-y-2 bg-[#101010] p-2.5 rounded-xl border border-white/5">
          {/* Wind Velocity Slider */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-[#FF2A55]" /> Incident Wind:
            </span>
            <span className="text-white font-bold">{windSpeed.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10.0"
            step="0.5"
            value={windSpeed}
            onChange={(e) => onWindSpeedChange(parseFloat(e.target.value))}
            className="w-full accent-[#6D001A] cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
          />

          {/* Wind Direction Slider & Compass */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-neutral-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-[#FF2A55]" /> Direction:
            </span>
            <span className="text-white font-bold">
              {Math.round(windDirection)}° ({getCompassDirection(windDirection)})
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="15"
            value={windDirection}
            onChange={(e) => onWindDirectionChange(parseInt(e.target.value))}
            className="w-full accent-[#6D001A] cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
          />
        </div>

        {/* Operable Windows Status */}
        <div className="flex items-center justify-between pt-1 text-[11px]">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6D001A]" />
            Operable Windows:
          </span>
          <span className="text-white font-bold">
            {openWindows} / {totalWindows} Open
          </span>
        </div>

        {/* Window Batch Controls */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            onClick={onOpenAllWindows}
            className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3 text-burgundy-400" /> Open All
          </button>
          <button
            onClick={onCloseAllWindows}
            className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
          >
            <XCircle className="w-3 h-3 text-neutral-400" /> Close All
          </button>
        </div>

        {/* Loading Indicator */}
        {isSimulating && (
          <div className="glass-burgundy rounded-lg px-2.5 py-1 text-[10px] text-burgundy-200 flex items-center justify-center gap-1.5 animate-pulse">
            <Sparkles className="w-3 h-3 text-burgundy-400" />
            SOLVING NAVIER-STOKES PINN...
          </div>
        )}
      </div>
    </div>
  );
}
