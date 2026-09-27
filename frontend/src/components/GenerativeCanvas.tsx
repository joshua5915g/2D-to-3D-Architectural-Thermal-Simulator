"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bed,
  Bath,
  Maximize2,
  Building,
  ArrowRight,
  Layers,
  Cpu,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";
import { FloorplanVectorData } from "@/types/project";

interface RoomMeta {
  id: string;
  name: string;
  type: string;
  bounds: [number, number, number, number]; // [x0, y0, x1, y1]
  area_sqft: number;
  center: [number, number];
}

interface GenerativeResponse {
  vector_data: FloorplanVectorData;
  rooms: RoomMeta[];
  total_area_sqft: number;
  aspect_ratio: number;
  generator_loss?: number;
  status: string;
}

interface GenerativeCanvasProps {
  onLayoutGenerated?: (vectorData: FloorplanVectorData) => void;
  onNavigateTo3D?: (vectorData: FloorplanVectorData) => void;
  className?: string;
}

export function GenerativeCanvas({
  onLayoutGenerated,
  onNavigateTo3D,
  className = "",
}: GenerativeCanvasProps) {
  // Generative constraint states
  const [sqft, setSqft] = useState<number>(1800);
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [includeBalcony, setIncludeBalcony] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1.33);
  const [archStyle, setArchStyle] = useState<string>("MODERN_MINIMALIST");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<GenerativeResponse | null>(null);

  // Generate floorplan via backend API
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";
      const res = await fetch(`${backendUrl}/api/generate/floorplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          square_footage: sqft,
          num_bedrooms: bedrooms,
          num_bathrooms: bathrooms,
          include_balcony: includeBalcony,
          aspect_ratio: aspectRatio,
          architectural_style: archStyle,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: GenerativeResponse = await res.json();
      setGeneratedData(data);
      if (onLayoutGenerated) {
        onLayoutGenerated(data.vector_data);
      }
    } catch (err: any) {
      console.error("Generative synthesis error:", err);
      setError(err?.message || "Failed to synthesize floorplan layout.");
    } finally {
      setLoading(false);
    }
  };

  // Color mapping per room classification
  const getRoomColor = (type: string) => {
    switch (type) {
      case "living":
        return { fill: "rgba(109, 0, 26, 0.25)", border: "#6D001A", badge: "text-burgundy-300" };
      case "kitchen":
        return { fill: "rgba(180, 83, 9, 0.15)", border: "#B45309", badge: "text-amber-300" };
      case "bedroom":
        return { fill: "rgba(30, 41, 59, 0.4)", border: "#475569", badge: "text-slate-300" };
      case "bathroom":
        return { fill: "rgba(15, 76, 92, 0.25)", border: "#0F4C5C", badge: "text-teal-300" };
      case "balcony":
        return { fill: "rgba(74, 4, 78, 0.2)", border: "#701A75", badge: "text-purple-300" };
      default:
        return { fill: "rgba(23, 23, 23, 0.5)", border: "#333333", badge: "text-neutral-400" };
    }
  };

  return (
    <div className={`w-full min-h-[680px] bg-black text-white p-6 md:p-8 flex flex-col lg:flex-row gap-8 ${className}`}>
      {/* Left Control Panel: Programmatic Constraints */}
      <div className="w-full lg:w-[420px] flex flex-col gap-6 select-none">
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded bg-burgundy flex items-center justify-center shadow-burgundy border border-burgundy-500/40">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white uppercase flex items-center gap-2">
              Generative <span className="text-burgundy-400">cGAN</span> Studio
            </h2>
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            Define architectural boundaries and synthesize parametric vector floorplans.
          </p>
        </div>

        {/* Footprint Slider */}
        <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-300 flex items-center gap-1.5 font-sans font-medium">
              <Maximize2 className="w-3.5 h-3.5 text-burgundy-400" /> Target Footprint
            </span>
            <span className="text-white font-bold text-sm bg-black/60 px-2 py-0.5 rounded border border-white/10">
              {sqft.toLocaleString()} sq ft
            </span>
          </div>
          <input
            type="range"
            min="600"
            max="4500"
            step="50"
            value={sqft}
            onChange={(e) => setSqft(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-burgundy"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
            <span>600 sq ft</span>
            <span>Studio / Apt</span>
            <span>Villa 4,500 sq ft</span>
          </div>
        </div>

        {/* Room Counters (Bedrooms & Bathrooms) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Bedrooms */}
          <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-2">
            <div className="text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
              <Bed className="w-3.5 h-3.5 text-burgundy-400" /> Bedrooms
            </div>
            <div className="flex items-center justify-between bg-black/60 p-1.5 rounded-lg border border-white/10">
              <button
                onClick={() => setBedrooms((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition-all border border-white/10"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-white">{bedrooms}</span>
              <button
                onClick={() => setBedrooms((prev) => Math.min(6, prev + 1))}
                className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition-all border border-white/10"
              >
                +
              </button>
            </div>
          </div>

          {/* Bathrooms */}
          <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-2">
            <div className="text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
              <Bath className="w-3.5 h-3.5 text-burgundy-400" /> Bathrooms
            </div>
            <div className="flex items-center justify-between bg-black/60 p-1.5 rounded-lg border border-white/10">
              <button
                onClick={() => setBathrooms((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition-all border border-white/10"
              >
                -
              </button>
              <span className="font-mono text-base font-bold text-white">{bathrooms}</span>
              <button
                onClick={() => setBathrooms((prev) => Math.min(4, prev + 1))}
                className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center transition-all border border-white/10"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Options & Architectural Styles */}
        <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300 font-medium flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-burgundy-400" /> Exterior Balcony / Terrace
            </span>
            <input
              type="checkbox"
              checked={includeBalcony}
              onChange={(e) => setIncludeBalcony(e.target.checked)}
              className="w-4 h-4 accent-burgundy cursor-pointer rounded"
            />
          </div>

          <div className="h-[1px] bg-white/10" />

          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-medium">Architectural Typology</label>
            <select
              value={archStyle}
              onChange={(e) => setArchStyle(e.target.value)}
              className="w-full bg-black/70 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-burgundy"
            >
              <option value="MODERN_MINIMALIST">Modern Minimalist (High Thermal Mass)</option>
              <option value="CONTEMPORARY_OPEN">Contemporary Open-Plan (Daylight Optimized)</option>
              <option value="BIOPHILIC">Biophilic Courtyard (Passive Cross-Ventilation)</option>
            </select>
          </div>
        </div>

        {/* Action Button: Generate */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3.5 px-6 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white font-bold text-sm tracking-wider uppercase transition-all shadow-burgundy flex items-center justify-center gap-2 border border-burgundy-400/40 active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Synthesizing cGAN Topology...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Floorplan AI</span>
            </>
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs font-mono">
            {error}
          </div>
        )}
      </div>

      {/* Right Canvas: 2D Spatial Layout Blueprint & Navigation */}
      <div className="flex-1 flex flex-col glass-panel rounded-2xl border border-white/10 p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-burgundy-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Synthesized 2D Architectural Layout
            </h3>
          </div>

          {generatedData && onNavigateTo3D && (
            <button
              onClick={() => onNavigateTo3D(generatedData.vector_data)}
              className="px-4 py-2 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-xs font-bold uppercase tracking-wider transition-all shadow-burgundy flex items-center gap-1.5 border border-burgundy-400/40"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Extrude into 3D Viewport</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>

        {/* Blueprint Vector Viewer (SVG Coordinate Canvas) */}
        <div className="flex-1 relative min-h-[420px] bg-[#080808] rounded-xl border border-white/10 flex items-center justify-center p-4 overflow-hidden">
          {generatedData ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <svg
                viewBox="0 0 1000 1000"
                className="w-full h-full max-h-[460px] select-none"
              >
                {/* Architectural Grid pattern */}
                <defs>
                  <pattern id="archGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="1000" height="1000" fill="url(#archGrid)" />

                {/* Rooms boundaries and labels */}
                {generatedData.rooms.map((room) => {
                  const [x0, y0, x1, y1] = room.bounds;
                  const rx = x0 * 1000;
                  const ry = y0 * 1000;
                  const rw = (x1 - x0) * 1000;
                  const rh = (y1 - y0) * 1000;
                  const styling = getRoomColor(room.type);

                  return (
                    <g key={room.id} className="transition-all duration-300">
                      <rect
                        x={rx}
                        y={ry}
                        width={rw}
                        height={rh}
                        fill={styling.fill}
                        stroke={styling.border}
                        strokeWidth="2"
                        rx="4"
                      />
                      {/* Room Label & Area */}
                      <text
                        x={rx + rw / 2}
                        y={ry + rh / 2 - 8}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="14"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {room.name}
                      </text>
                      <text
                        x={rx + rw / 2}
                        y={ry + rh / 2 + 12}
                        textAnchor="middle"
                        fill="#A3A3A3"
                        fontSize="11"
                        fontFamily="monospace"
                      >
                        {room.area_sqft} sq ft
                      </text>
                    </g>
                  );
                })}

                {/* Vector Wall Overlays */}
                {generatedData.vector_data.elements.map((elem) => {
                  if (elem.type === "wall") {
                    const pts = elem.coordinates
                      .map(([x, y]) => `${x * 1000},${y * 1000}`)
                      .join(" ");
                    return (
                      <polygon
                        key={elem.id}
                        points={pts}
                        fill="#6D001A"
                        stroke="#990024"
                        strokeWidth="1.5"
                      />
                    );
                  }
                  if (elem.type === "window") {
                    const [p0, p1] = elem.coordinates;
                    return (
                      <line
                        key={elem.id}
                        x1={p0[0] * 1000}
                        y1={p0[1] * 1000}
                        x2={p1[0] * 1000}
                        y2={p1[1] * 1000}
                        stroke="#60A5FA"
                        strokeWidth="4"
                        strokeDasharray="4 2"
                      />
                    );
                  }
                  if (elem.type === "door") {
                    const [p0, p1] = elem.coordinates;
                    return (
                      <line
                        key={elem.id}
                        x1={p0[0] * 1000}
                        y1={p0[1] * 1000}
                        x2={p1[0] * 1000}
                        y2={p1[1] * 1000}
                        stroke="#34D399"
                        strokeWidth="3"
                      />
                    );
                  }
                  return null;
                })}
              </svg>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <Building className="w-12 h-12 mb-3 text-neutral-700 stroke-1" />
              <p className="text-sm font-medium text-neutral-400 mb-1">
                No Architectural Program Synthesized
              </p>
              <p className="text-xs font-mono max-w-sm">
                Adjust square footage and room specifications on the left, then click{" "}
                <span className="text-burgundy-400 font-bold">Generate Floorplan AI</span>.
              </p>
            </div>
          )}
        </div>

        {/* Telemetry Footer */}
        {generatedData && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-black/60 p-2.5 rounded-lg border border-white/10">
              <span className="text-neutral-500 block text-[10px] uppercase">Total Living Area</span>
              <span className="text-white font-bold text-sm">
                {generatedData.total_area_sqft} sq ft
              </span>
            </div>
            <div className="bg-black/60 p-2.5 rounded-lg border border-white/10">
              <span className="text-neutral-500 block text-[10px] uppercase">Rooms Generated</span>
              <span className="text-burgundy-300 font-bold text-sm">
                {generatedData.rooms.length} Zones
              </span>
            </div>
            <div className="bg-black/60 p-2.5 rounded-lg border border-white/10">
              <span className="text-neutral-500 block text-[10px] uppercase">3D Extrusion Elements</span>
              <span className="text-white font-bold text-sm">
                {generatedData.vector_data.elements.length} Vectors
              </span>
            </div>
            <div className="bg-black/60 p-2.5 rounded-lg border border-white/10">
              <span className="text-neutral-500 block text-[10px] uppercase">Aspect Ratio</span>
              <span className="text-neutral-300 font-bold text-sm">
                {generatedData.aspect_ratio}:1
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
