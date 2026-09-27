"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { GenerativeCanvas } from "@/components/GenerativeCanvas";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { FloorplanVectorData } from "@/types/project";
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
  Building2,
  Sparkles,
} from "lucide-react";

const FloorplanViewer = dynamic(
  () => import("@/components/FloorplanViewer").then((mod) => mod.FloorplanViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] bg-black flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-burgundy border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
          EXTRUDING 3D VECTOR GEOMETRY & THERMAL SHADER...
        </p>
      </div>
    ),
  }
);

export default function HomePage() {
  const { user, loginWithEmail, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"extrusion" | "thermal" | "generative" | "upload">("extrusion");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [generatedVectorData, setGeneratedVectorData] = useState<FloorplanVectorData | null>(null);

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
        <div className="flex items-center gap-1.5 bg-[#121212] p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab("extrusion")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "extrusion"
                ? "bg-burgundy text-white shadow-burgundy"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> 3D Extrusion
          </button>
          <button
            onClick={() => setActiveTab("thermal")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "thermal"
                ? "bg-burgundy text-white shadow-burgundy"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" /> Thermal PINN
          </button>
          <button
            onClick={() => setActiveTab("generative")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "generative"
                ? "bg-burgundy text-white shadow-burgundy border border-burgundy-400/40"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-burgundy-400" /> Generative AI
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
        {activeTab === "extrusion" ? (
          <div className="relative w-full h-[calc(100vh-4rem)]">
            <FloorplanViewer
              projectId={selectedProjectId}
              customVectorData={generatedVectorData}
              initialThermalMode={false}
            />
          </div>
        ) : activeTab === "thermal" ? (
          <div className="relative w-full h-[calc(100vh-4rem)]">
            <FloorplanViewer
              projectId={selectedProjectId}
              customVectorData={generatedVectorData}
              initialThermalMode={true}
            />
          </div>
        ) : activeTab === "generative" ? (
          <div className="flex-1 overflow-y-auto">
            <GenerativeCanvas
              onLayoutGenerated={(data) => setGeneratedVectorData(data)}
              onNavigateTo3D={(data) => {
                setGeneratedVectorData(data);
                setActiveTab("extrusion");
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-12 flex items-center justify-center">
            <UploadZone
              userId={user?.uid || "guest_architect"}
              onProjectCreated={(id) => {
                setSelectedProjectId(id);
                setActiveTab("extrusion");
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
