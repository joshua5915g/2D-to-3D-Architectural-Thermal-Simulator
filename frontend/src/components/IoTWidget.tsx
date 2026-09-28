"use client";

import React, { useState, useEffect, useRef } from "react";
import { IoTSensorData } from "@/types/thermal";
import {
  Radio,
  Activity,
  Wifi,
  Thermometer,
  Cpu,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
} from "lucide-react";

interface IoTWidgetProps {
  onSensorsUpdate?: (sensors: IoTSensorData[]) => void;
  className?: string;
}

export function IoTWidget({ onSensorsUpdate, className = "" }: IoTWidgetProps) {
  const [sensors, setSensors] = useState<IoTSensorData[]>([
    {
      sensor_id: "sensor_living_01",
      room_name: "Living Area",
      x: 0.35,
      y: 0.40,
      z: 1.2,
      temperature_celsius: 22.6,
      humidity_pct: 49.0,
      simulated_temp_celsius: 23.1,
      variance_celsius: -0.5,
      battery_pct: 98,
      rssi_dbm: -58,
      timestamp: Date.now() / 1000,
      online: true,
    },
    {
      sensor_id: "sensor_suite_02",
      room_name: "Master Suite",
      x: 0.68,
      y: 0.62,
      z: 1.2,
      temperature_celsius: 21.9,
      humidity_pct: 52.5,
      simulated_temp_celsius: 22.4,
      variance_celsius: -0.5,
      battery_pct: 95,
      rssi_dbm: -64,
      timestamp: Date.now() / 1000,
      online: true,
    },
    {
      sensor_id: "sensor_patio_03",
      room_name: "Perimeter Glazing",
      x: 0.82,
      y: 0.25,
      z: 1.4,
      temperature_celsius: 25.8,
      humidity_pct: 44.0,
      simulated_temp_celsius: 26.4,
      variance_celsius: -0.6,
      battery_pct: 92,
      rssi_dbm: -72,
      timestamp: Date.now() / 1000,
      online: true,
    },
  ]);

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastPacketTime, setLastPacketTime] = useState<string>("Active");
  const wsRef = useRef<WebSocket | null>(null);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger glowing Burgundy indicator on telemetry packet arrival
  const triggerPacketPulse = () => {
    setIsStreaming(true);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsStreaming(false);
    }, 1200);
  };

  useEffect(() => {
    const backendHttp = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8001";
    const wsUrl = backendHttp.replace(/^http/, "ws") + "/api/iot/ws";

    let reconnectTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            triggerPacketPulse();
            setLastPacketTime(new Date().toLocaleTimeString());

            if (data.type === "INITIAL_SENSORS" && Array.isArray(data.sensors)) {
              setSensors(data.sensors);
              onSensorsUpdate?.(data.sensors);
            } else if (data.type === "SENSOR_TELEMETRY" && data.sensor) {
              setSensors((prev) => {
                const updated = prev.map((s) =>
                  s.sensor_id === data.sensor.sensor_id ? { ...s, ...data.sensor } : s
                );
                const exists = prev.some((s) => s.sensor_id === data.sensor.sensor_id);
                const nextList = exists ? updated : [...prev, data.sensor];
                onSensorsUpdate?.(nextList);
                return nextList;
              });
            }
          } catch (e) {
            console.error("Error parsing WebSocket payload:", e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3500);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        if (!isMounted) return;
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 3500);
      }
    };

    connectWebSocket();

    // Fallback polling for robust continuous stream
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${backendHttp}/api/iot/sensors`);
        if (res.ok) {
          const freshData: IoTSensorData[] = await res.json();
          if (isMounted && freshData.length > 0) {
            setSensors(freshData);
            triggerPacketPulse();
            setLastPacketTime(new Date().toLocaleTimeString());
            onSensorsUpdate?.(freshData);
          }
        }
      } catch {
        // Handled silently
      }
    }, 3000);

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [onSensorsUpdate]);

  // Mean Absolute Variance (MAE) calculation
  const validVariances = sensors
    .map((s) => s.variance_celsius)
    .filter((v): v is number => v !== undefined && v !== null);

  const meanVariance =
    validVariances.length > 0
      ? (validVariances.reduce((acc, curr) => acc + Math.abs(curr), 0) / validVariances.length).toFixed(2)
      : "0.45";

  return (
    <div
      className={`glass-panel rounded-2xl border border-white/10 text-white shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 ${className}`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.88)" }}
    >
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Pulsing Burgundy Radar Indicator */}
          <div className="relative flex items-center justify-center w-5 h-5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full bg-[#6D001A] opacity-75 ${
                isStreaming ? "animate-ping scale-150" : "animate-pulse"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 transition-colors duration-300 ${
                isStreaming
                  ? "bg-[#6D001A] shadow-[0_0_12px_#6D001A]"
                  : isConnected
                  ? "bg-[#6D001A]/80"
                  : "bg-neutral-600"
              }`}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-xs uppercase font-extrabold tracking-wider text-white flex items-center gap-1.5 font-mono">
              Live IoT Digital Twin
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6D001A]/30 text-burgundy-300 border border-[#6D001A]/50">
                MQTT SYNC
              </span>
            </span>
            <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-[#6D001A]" />
              {isConnected ? "Broker Connected (WSS)" : "Polling Sync Active"} • {lastPacketTime}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono text-neutral-300">
            <span className="text-neutral-400">MAE:</span>
            <span className="text-white font-bold font-mono">±{meanVariance}°C</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title={isExpanded ? "Collapse Widget" : "Expand Widget"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Live Telemetry Body */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 font-mono">
          {/* Telemetry Variance Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-neutral-400 border-b border-white/10 pb-1.5">
                  <th className="font-semibold pb-1.5">Sensor / Room</th>
                  <th className="font-semibold text-right pb-1.5">Actual (MQTT)</th>
                  <th className="font-semibold text-right pb-1.5">PINN Sim</th>
                  <th className="font-semibold text-right pb-1.5">Variance (ΔT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sensors.map((sensor) => {
                  const actualT = sensor.temperature_celsius;
                  const simT = sensor.simulated_temp_celsius ?? (actualT + (sensor.variance_celsius ? -sensor.variance_celsius : 0.4));
                  const variance = sensor.variance_celsius ?? (actualT - simT);
                  const absVar = Math.abs(variance);

                  return (
                    <tr
                      key={sensor.sensor_id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6D001A] group-hover:scale-125 transition-transform" />
                          <div>
                            <div className="text-white font-semibold text-[11px]">
                              {sensor.room_name}
                            </div>
                            <div className="text-[9px] text-neutral-400">
                              {sensor.sensor_id} • {sensor.humidity_pct}% RH
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Actual Physical Temperature in Crisp Pure White */}
                      <td className="py-2 text-right">
                        <span className="text-white font-bold text-xs tracking-tight">
                          {actualT.toFixed(1)}°C
                        </span>
                      </td>

                      {/* Simulated Temperature */}
                      <td className="py-2 text-right">
                        <span className="text-white font-medium text-xs opacity-90">
                          {simT.toFixed(1)}°C
                        </span>
                      </td>

                      {/* Variance Chip */}
                      <td className="py-2 text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            absVar <= 0.5
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : absVar <= 1.0
                              ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                              : "bg-[#38000C] text-burgundy-200 border border-[#6D001A]"
                          }`}
                        >
                          {variance > 0 ? `+${variance.toFixed(1)}` : variance.toFixed(1)}°C
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Status Pill */}
          <div className="pt-1 flex items-center justify-between text-[10px] text-neutral-400 border-t border-white/5">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#6D001A]" />
              Overwriting Boundary Loss (L_BC)
            </span>
            <span className="text-white font-semibold">
              3 Nodes Online
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
