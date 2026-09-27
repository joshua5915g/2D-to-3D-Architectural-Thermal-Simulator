"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Sun, Moon, Sunrise, Sunset, Clock, Flame, RotateCcw } from "lucide-react";
import { HourlySolarTelemetry } from "@/types/thermal";

interface TimelineControlProps {
  activeHour: number;
  onHourChange: (hour: number) => void;
  activeHourRef?: React.MutableRefObject<number>;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  solarTelemetry?: (HourlySolarTelemetry | {
    azimuthDeg?: number;
    elevationDeg?: number;
    dniWm2?: number;
    sunVisible?: boolean;
    elevation_deg?: number;
    azimuth_deg?: number;
    dni_wm2?: number;
  }) | null;
  className?: string;
}

export function TimelineControl({
  activeHour,
  onHourChange,
  activeHourRef,
  isPlaying: externalIsPlaying,
  onTogglePlay: externalTogglePlay,
  solarTelemetry,
  className = "",
}: TimelineControlProps) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [displayHour, setDisplayHour] = useState(activeHour);
  const sliderRef = useRef<HTMLInputElement>(null);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalPlaying;

  const togglePlay = () => {
    if (externalTogglePlay) {
      externalTogglePlay();
    } else {
      setInternalPlaying((prev) => !prev);
    }
  };

  // Keep local display hour synchronized if changed from outside
  useEffect(() => {
    setDisplayHour(activeHour);
  }, [activeHour]);

  // Automated 24-hour playback animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setDisplayHour((prev) => {
        const next = (prev + 0.15) % 24;
        if (activeHourRef) {
          activeHourRef.current = next;
        }
        onHourChange(next);
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, onHourChange, activeHourRef]);

  // High-performance slider scrub handler
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setDisplayHour(val);

      // Instantaneous mutable ref mutation for 60 FPS GPU update without React lag
      if (activeHourRef) {
        activeHourRef.current = val;
      }
      onHourChange(val);
    },
    [activeHourRef, onHourChange]
  );

  // Time formatting (e.g. 14.5 -> "14:30")
  const hourInt = Math.floor(displayHour);
  const minInt = Math.floor((displayHour - hourInt) * 60);
  const formattedTime = `${hourInt.toString().padStart(2, "0")}:${minInt.toString().padStart(2, "0")}`;

  // Solar state indicator
  const isDaytime = displayHour >= 6 && displayHour <= 19;
  const isDawnOrDusk = (displayHour >= 5 && displayHour < 7) || (displayHour >= 18 && displayHour <= 20);

  const SolarIcon = isDawnOrDusk ? Sunset : isDaytime ? Sun : Moon;
  const solarStatusText = isDawnOrDusk
    ? displayHour < 12
      ? "Dawn / Solar Rise"
      : "Dusk / Sunset"
    : isDaytime
    ? "Direct Daylight"
    : "Nocturnal Cooling";

  // Percentage for custom slider track fill
  const progressPercent = (displayHour / 24) * 100;

  return (
    <div
      className={`glass-panel rounded-2xl p-4 sm:p-5 text-white shadow-2xl border border-white/10 select-none ${className}`}
      style={{
        backdropFilter: "blur(20px)",
        background: "rgba(10, 10, 10, 0.85)",
      }}
    >
      <div className="flex flex-col gap-3">
        {/* Header Row: Telemetry & Time Readout */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white flex items-center justify-center transition-all shadow-burgundy border border-burgundy-400/40 active:scale-95"
              title={isPlaying ? "Pause Timeline" : "Play Diurnal Cycle"}
              aria-label={isPlaying ? "Pause Timeline" : "Play Diurnal Cycle"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => {
                const zero = 0;
                setDisplayHour(zero);
                if (activeHourRef) activeHourRef.current = zero;
                onHourChange(zero);
              }}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all border border-white/10 active:scale-95"
              title="Reset to 00:00 Midnight"
              aria-label="Reset to 00:00 Midnight"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
              <Clock className="w-3.5 h-3.5 text-burgundy-400" />
              <span className="font-mono text-base font-bold tracking-wider text-white">
                {formattedTime}
              </span>
              <span className="text-[10px] uppercase font-mono text-neutral-400">
                {displayHour < 12 ? "AM" : "PM"}
              </span>
            </div>
          </div>

          {/* Solar & Diurnal Telemetry Indicator */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 font-mono text-neutral-300">
              <SolarIcon
                className={`w-3.5 h-3.5 ${
                  isDaytime ? "text-amber-400" : isDawnOrDusk ? "text-burgundy-400" : "text-sky-300"
                }`}
              />
              <span className="text-[11px] hidden sm:inline">{solarStatusText}</span>
              {(solarTelemetry?.elevation_deg !== undefined || (solarTelemetry as any)?.elevationDeg !== undefined) && (
                <span className="text-burgundy-300 font-bold ml-1">
                  {(solarTelemetry?.elevation_deg ?? (solarTelemetry as any)?.elevationDeg ?? 0).toFixed(0)}° Elev
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-burgundy/20 border border-burgundy-500/30 text-[11px] font-mono text-burgundy-200">
              <Flame className="w-3.5 h-3.5 text-burgundy-400" />
              <span>PINN 24H SOLVER</span>
            </div>
          </div>
        </div>

        {/* Custom Range Scrubber Slider */}
        <div className="relative flex flex-col gap-1.5 pt-1">
          <div className="relative w-full flex items-center h-6">
            {/* Visual Custom Track */}
            <div className="absolute w-full h-2 rounded-full bg-neutral-900 border border-white/10 overflow-hidden pointer-events-none">
              <div
                className="h-full bg-burgundy shadow-burgundy transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Input Range Slider with White Thumb & Transparent native track */}
            <input
              ref={sliderRef}
              type="range"
              min="0"
              max="23.99"
              step="0.05"
              value={displayHour}
              onChange={handleSliderChange}
              className="relative w-full h-6 appearance-none bg-transparent cursor-pointer z-10 
                [&::-webkit-slider-thumb]:appearance-none 
                [&::-webkit-slider-thumb]:w-5 
                [&::-webkit-slider-thumb]:h-5 
                [&::-webkit-slider-thumb]:rounded-full 
                [&::-webkit-slider-thumb]:bg-white 
                [&::-webkit-slider-thumb]:border-2 
                [&::-webkit-slider-thumb]:border-burgundy 
                [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(255,255,255,0.7)]
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-125
                [&::-webkit-slider-thumb]:active:scale-110
                [&::-moz-range-thumb]:w-5 
                [&::-moz-range-thumb]:h-5 
                [&::-moz-range-thumb]:rounded-full 
                [&::-moz-range-thumb]:bg-white 
                [&::-moz-range-thumb]:border-2 
                [&::-moz-range-thumb]:border-burgundy 
                [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(255,255,255,0.7)]
                [&::-moz-range-thumb]:transition-transform
                [&::-moz-range-thumb]:hover:scale-125
                [&::-moz-range-thumb]:active:scale-110"
              aria-label="Time of Day Scrubber"
            />
          </div>

          {/* Hour Hash Markers */}
          <div className="flex justify-between text-[10px] font-mono text-neutral-500 px-1">
            <span>00:00</span>
            <span className="hidden sm:inline">04:00</span>
            <span>08:00</span>
            <span className="text-burgundy-400 font-bold">12:00 NOON</span>
            <span>16:00</span>
            <span className="hidden sm:inline">20:00</span>
            <span>23:59</span>
          </div>
        </div>
      </div>
    </div>
  );
}
