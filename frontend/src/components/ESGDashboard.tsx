"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  EnvelopeMaterialType,
  GridTariffType,
  GridEmissionRegion,
  ESGCalculationResponse,
} from "@/types/thermal";
import {
  TrendingUp,
  DollarSign,
  Leaf,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Globe,
  Layers,
  Calendar,
  X,
  RefreshCw,
  Flame,
} from "lucide-react";

interface ESGDashboardProps {
  floorAreaSqft?: number;
  simulatedAvgTemp?: number;
  isOpen: boolean;
  onClose: () => void;
  onMaterialChange?: (material: EnvelopeMaterialType) => void;
}

export function ESGDashboard({
  floorAreaSqft = 1800,
  simulatedAvgTemp = 27.5,
  isOpen,
  onClose,
  onMaterialChange,
}: ESGDashboardProps) {
  const [selectedMaterial, setSelectedMaterial] =
    useState<EnvelopeMaterialType>("HIGH_EFFICIENCY");
  const [tariffType, setTariffType] = useState<GridTariffType>("TIME_OF_USE");
  const [gridRegion, setGridRegion] = useState<GridEmissionRegion>("US_AVERAGE");
  const [esgData, setEsgData] = useState<ESGCalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch ESG calculation from FastAPI backend
  const fetchESGData = async () => {
    try {
      setLoading(true);
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";
      const res = await fetch(`${backendUrl}/api/esg/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floor_area_sqft: floorAreaSqft,
          ceiling_height_meters: 2.8,
          target_temp_celsius: 22.2, // 72°F
          envelope_material: selectedMaterial,
          tariff_type: tariffType,
          grid_region: gridRegion,
          simulated_avg_temp: simulatedAvgTemp,
          outdoor_avg_temp: 32.0,
          hvac_cop: 3.6,
          discount_rate_pct: 5.0,
        }),
      });

      if (res.ok) {
        const data: ESGCalculationResponse = await res.json();
        setEsgData(data);
      }
    } catch (err) {
      console.warn("ESG Calculation API error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchESGData();
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, selectedMaterial, tariffType, gridRegion, floorAreaSqft, simulatedAvgTemp]);

  if (!isOpen) return null;

  const isNetZeroViolated = esgData ? !esgData.net_zero_compliant : false;

  return (
    <div className="absolute top-5 right-5 z-30 w-96 max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar bg-black/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl shadow-2xl p-4 text-white font-mono select-none flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#6D001A] animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF1744]" /> Enterprise ESG & ROI
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white transition-colors text-xs px-2 py-0.5 rounded border border-neutral-800 hover:border-neutral-700"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Net-Zero Compliance Alert Banner */}
      {esgData && (
        <div
          className={`p-3 rounded-xl border transition-all duration-300 ${
            isNetZeroViolated
              ? "bg-[#6D001A]/30 border-[#6D001A] shadow-[0_0_18px_rgba(109,0,26,0.5)] animate-pulse"
              : "bg-emerald-950/30 border-emerald-800/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {isNetZeroViolated ? (
                <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isNetZeroViolated ? "text-[#FF1744]" : "text-emerald-400"
                }`}
              >
                {isNetZeroViolated ? "Net-Zero Violation" : "Net-Zero Compliant"}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400">
              Target: &le; {esgData.net_zero_threshold_kwh_per_sqft} kWh/ft²
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-neutral-300">
              Cooling Energy Use Intensity (EUI):
            </span>
            <span
              className={`text-sm font-bold ${
                isNetZeroViolated ? "text-[#FF2A55]" : "text-emerald-300"
              }`}
            >
              {esgData.energy_use_intensity_kwh_per_sqft.toFixed(2)} kWh/ft²
            </span>
          </div>

          {isNetZeroViolated && (
            <div className="text-[10px] text-[#FF9E9E] mt-1">
              Exceeds Net-Zero threshold by +{esgData.net_zero_variance_pct}% under
              72°F (22.2°C) continuous setpoint. Upgrade envelope to resolve.
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      {esgData && (
        <div className="grid grid-cols-2 gap-2">
          {/* Annual Electricity Cost */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-1">
              <DollarSign className="w-3 h-3 text-neutral-400" /> ANNUAL UTILITY BILL
            </div>
            <div className="text-xl font-bold tracking-tight text-white">
              ${esgData.annual_electricity_cost_usd.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-[9px] text-neutral-500 mt-0.5">
              HVAC: {esgData.annual_hvac_cooling_kwh.toLocaleString()} kWh/yr
            </div>
          </div>

          {/* Annual Carbon Footprint */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-1">
              <Leaf className="w-3 h-3 text-emerald-400" /> CO₂e FOOTPRINT
            </div>
            <div className="text-xl font-bold tracking-tight text-white">
              {esgData.annual_carbon_emissions_metric_tons.toFixed(2)}{" "}
              <span className="text-xs font-normal text-neutral-400">t/yr</span>
            </div>
            <div className="text-[9px] text-neutral-500 mt-0.5">
              Scope 2 ({esgData.carbon_intensity_kg_per_kwh} kg/kWh)
            </div>
          </div>
        </div>
      )}

      {/* Material Envelope Selector */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] uppercase text-neutral-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-neutral-400" /> Envelope Insulation Grade
          </span>
          <span className="text-neutral-500">{floorAreaSqft.toFixed(0)} sqft</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              setSelectedMaterial("STANDARD");
              onMaterialChange?.("STANDARD");
            }}
            className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
              selectedMaterial === "STANDARD"
                ? "bg-[#6D001A]/40 border-[#6D001A] text-white shadow-[0_0_10px_#6D001A]"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <div className="text-[10px] font-bold">Standard</div>
            <div className="text-[8px] text-neutral-400 mt-0.5">R-13 Wall</div>
            <div className="text-[8px] text-neutral-500">$0/ft²</div>
          </button>

          <button
            onClick={() => {
              setSelectedMaterial("HIGH_EFFICIENCY");
              onMaterialChange?.("HIGH_EFFICIENCY");
            }}
            className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
              selectedMaterial === "HIGH_EFFICIENCY"
                ? "bg-[#6D001A]/40 border-[#6D001A] text-white shadow-[0_0_10px_#6D001A]"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <div className="text-[10px] font-bold">High-Perf</div>
            <div className="text-[8px] text-neutral-400 mt-0.5">R-24 Low-E</div>
            <div className="text-[8px] text-emerald-400">+$3.80/ft²</div>
          </button>

          <button
            onClick={() => {
              setSelectedMaterial("PASSIVE_HOUSE_ULTRA");
              onMaterialChange?.("PASSIVE_HOUSE_ULTRA");
            }}
            className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
              selectedMaterial === "PASSIVE_HOUSE_ULTRA"
                ? "bg-[#6D001A]/40 border-[#6D001A] text-white shadow-[0_0_10px_#6D001A]"
                : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <div className="text-[10px] font-bold">Ultra Net-Zero</div>
            <div className="text-[8px] text-neutral-400 mt-0.5">R-40 Aerogel</div>
            <div className="text-[8px] text-emerald-400">+$7.50/ft²</div>
          </button>
        </div>
      </div>

      {/* Financial ROI & Payback Timeline */}
      {esgData && (
        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#FF1744]" /> Capital Payback & ROI
            </span>
            {esgData.simple_payback_years !== null ? (
              <span className="text-xs font-bold text-emerald-400">
                {esgData.simple_payback_years === 0
                  ? "Baseline (0 yr)"
                  : `${esgData.simple_payback_years} Yrs Breakeven`}
              </span>
            ) : (
              <span className="text-xs text-neutral-500">N/A</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-neutral-400 block">Upfront CapEx Delta:</span>
              <span className="text-white font-bold text-xs">
                ${esgData.upfront_capex_delta_usd.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">Annual OpEx Savings:</span>
              <span className="text-emerald-400 font-bold text-xs">
                +${esgData.annual_opex_savings_usd.toLocaleString()}/yr
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">15-Yr Net Present Value:</span>
              <span
                className={`font-bold text-xs ${
                  esgData.npv_15_year_usd >= 0 ? "text-emerald-400" : "text-[#FF1744]"
                }`}
              >
                ${esgData.npv_15_year_usd.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">IRR / Discount Rate:</span>
              <span className="text-neutral-300 font-bold text-xs">5.0% Real</span>
            </div>
          </div>

          {/* Interactive Payback Curve Visualizer */}
          {esgData.cashflows_15_year && esgData.cashflows_15_year.length > 0 && (
            <div className="pt-1">
              <div className="flex justify-between text-[8px] text-neutral-500 mb-1">
                <span>Year 1</span>
                <span>Cumulative Savings Curve (15 Years)</span>
                <span>Year 15</span>
              </div>
              <div className="h-14 w-full bg-black/60 rounded border border-neutral-800 p-1 flex items-end justify-between gap-1">
                {esgData.cashflows_15_year.map((pt) => {
                  const maxNet = Math.max(
                    ...esgData.cashflows_15_year.map((p) => Math.abs(p.net_savings)),
                    100
                  );
                  const isPositive = pt.net_savings >= 0;
                  const barHeightPct = Math.min(
                    100,
                    Math.max(10, (Math.abs(pt.net_savings) / maxNet) * 100)
                  );

                  return (
                    <div
                      key={pt.year}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className={`w-full rounded-t-sm transition-all ${
                          isPositive
                            ? "bg-emerald-500/80 hover:bg-emerald-400"
                            : "bg-[#6D001A] hover:bg-[#8B0021]"
                        }`}
                      />
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-neutral-700 text-[8px] px-1 py-0.5 rounded pointer-events-none whitespace-nowrap z-50 text-white">
                        Yr {pt.year}: ${pt.net_savings.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid Tariff & Regional Carbon Settings */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-neutral-400 block mb-1">Utility Tariff</span>
          <select
            value={tariffType}
            onChange={(e) => setTariffType(e.target.value as GridTariffType)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded p-1 text-white text-[10px]"
          >
            <option value="TIME_OF_USE">Time-of-Use (Peak $0.32)</option>
            <option value="FLAT">Flat ($0.185/kWh)</option>
          </select>
        </div>

        <div>
          <span className="text-neutral-400 block mb-1">Regional Grid</span>
          <select
            value={gridRegion}
            onChange={(e) => setGridRegion(e.target.value as GridEmissionRegion)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded p-1 text-white text-[10px]"
          >
            <option value="US_AVERAGE">US Grid (0.386 kg/kWh)</option>
            <option value="CALIFORNIA_CLEAN">CA Clean (0.210 kg/kWh)</option>
            <option value="EU_GREEN">EU Green (0.135 kg/kWh)</option>
            <option value="COAL_INTENSIVE">Coal Grid (0.720 kg/kWh)</option>
          </select>
        </div>
      </div>

      {/* Recalculate / Refresh button */}
      <button
        onClick={fetchESGData}
        disabled={loading}
        className="w-full py-2 px-3 rounded-lg bg-[#6D001A] hover:bg-[#8B0021] text-white text-xs font-semibold tracking-wider uppercase transition-colors shadow-lg shadow-[#6D001A]/30 flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Re-Evaluating Carbon Grid..." : "Refresh ESG Projections"}</span>
      </button>
    </div>
  );
}
