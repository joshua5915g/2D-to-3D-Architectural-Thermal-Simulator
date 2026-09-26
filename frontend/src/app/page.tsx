"use client";

import React, { useState } from "react";
import { Scene } from "@/components/canvas/Scene";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { ThermalStatsPanel } from "@/components/thermal/ThermalStatsPanel";
import { TemperatureGradientLegend } from "@/components/thermal/TemperatureGradientLegend";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import {
  Layers,
  Thermometer,
  UploadCloud,
  Box,
  Sun,
  Shield,
  LogIn,
  LogOut,
  Maximize2,
} from "lucide-react";

export default function HomePage() {
  const { user, loginWithEmail, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"viewport" | "upload">("viewport");
  const [wireframeMode, setWireframeMode] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Top Architectural Header */}
      <header className="z-20 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-burgundy flex items-center justify-center font-bold text-white shadow-burgundy border border-burgundy-500/50">
            3D
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white uppercase flex items-center gap-2">
              ThermalSim <span className="text-burgundy-400">PINN</span>
            </h1>
            <p className="text-[10px] text-neutral-400 font-mono tracking-wider">
              2D-TO-3D ARCHITECTURAL THERMODYNAMICS
            </p>
          </div>
        </div>

        {/* View Switcher Navigation */}
        <div className="flex items-center gap-2 bg-[#121212] p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab("viewport")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "viewport"
                ? "bg-burgundy text-white shadow-burgundy"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Box className="w-3.5 h-3.5" /> 3D Viewport
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "upload"
                ? "bg-burgundy text-white shadow-burgundy"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Ingest Floorplan
          </button>
        </div>

        {/* Authentication Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-300 font-mono hidden sm:inline">
                {user.email || "Architect User"}
              </span>
              <Button size="sm" variant="outline" onClick={logout}>
                <LogOut className="w-3.5 h-3.5 mr-1" /> Logout
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="burgundy"
              onClick={() => loginWithEmail("demo@thermalsim.ai", "password123").catch(() => {})}
            >
              <LogIn className="w-3.5 h-3.5 mr-1" /> Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 relative flex">
        {activeTab === "viewport" ? (
          <div className="relative w-full h-[calc(100vh-4rem)]">
            {/* 3D Canvas Scene */}
            <Scene wireframe={wireframeMode} />

            {/* Floating Top Left Controls */}
            <div className="absolute top-6 left-6 z-10 space-y-3 pointer-events-auto">
              <div className="glass-panel rounded-xl p-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={wireframeMode ? "burgundy" : "outline"}
                  onClick={() => setWireframeMode(!wireframeMode)}
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  {wireframeMode ? "Solid Shading" : "Wireframe Mesh"}
                </Button>
              </div>
            </div>

            {/* Floating Top Right: Telemetry Metrics Panel */}
            <div className="absolute top-6 right-6 z-10 pointer-events-auto hidden md:block">
              <ThermalStatsPanel />
            </div>

            {/* Floating Bottom Center: Thermal Heatmap Legend */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
              <TemperatureGradientLegend minTemp={18} maxTemp={38} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-12 flex items-center justify-center">
            <UploadZone
              userId={user?.uid || "guest_architect"}
              onProjectCreated={(id) => {
                setSelectedProjectId(id);
                setActiveTab("viewport");
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
