export interface SolarFluxPoint {
  azimuthDeg: number;
  elevationDeg: number;
  directNormalIrradianceWm2: number; // W/m^2
  diffuseHorizontalIrradianceWm2: number;
}

export interface ThermalNodeResult {
  nodeId: string;
  position: [number, number, number];
  temperatureCelsius: number;
  heatFluxWm2: number;
}

export interface RoomThermalSummary {
  roomId: string;
  roomName: string;
  averageTempCelsius: number;
  minTempCelsius: number;
  maxTempCelsius: number;
  thermalComfortIndex: "OPTIMAL" | "WARM" | "HOT" | "CRITICAL";
}

export interface HourlySolarTelemetry {
  hour: number;
  time_label: string;
  elevation_deg: number;
  azimuth_deg: number;
  dni_wm2: number;
  dhi_wm2: number;
  window_penetration_flux_wm2: number;
}

export interface ThermalSimulationGridData {
  time_steps: string[];
  solar_telemetry: HourlySolarTelemetry[];
  thermal_grids: number[][][]; // shape [24, N, N]
  grid_resolution: number;
  min_temperature: number;
  max_temperature: number;
  average_temperature: number;
  status: string;
  message?: string;
}

export interface ThermalSimulationResult {
  projectId: string;
  ambientTempCelsius: number;
  solarFlux: SolarFluxPoint;
  thermalScalarField: number[]; // Temperature aligned with mesh vertices
  surfaceNodes: ThermalNodeResult[];
  roomSummaries: RoomThermalSummary[];
  simulatedAt: number;
  gridData?: ThermalSimulationGridData;
}

export interface HVACNodeData {
  id: string;
  name: string;
  position: [number, number, number]; // Three.js world coordinates
  setpointCelsius: number;
  coolingCapacityKw: number;
  active: boolean;
  radiusMeters?: number;
}

export interface HVACNodeSpec {
  id: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  cooling_capacity_kw: number;
  setpoint_celsius: number;
  active: boolean;
  radius_meters?: number;
}

export interface IoTSensorData {
  sensor_id: string;
  room_name: string;
  x: number;
  y: number;
  z: number;
  temperature_celsius: number;
  humidity_pct: number;
  simulated_temp_celsius?: number;
  variance_celsius?: number;
  battery_pct: number;
  rssi_dbm: number;
  timestamp: number;
  online: boolean;
}

export interface WindowStateData {
  window_id: string;
  is_open: boolean;
  open_fraction: number;
}

export interface CFDSimulateRequest {
  vector_data: any;
  window_states: WindowStateData[];
  wind_speed_mps: number;
  wind_direction_deg: number;
  outdoor_temp_celsius?: number;
  indoor_avg_temp_celsius?: number;
  grid_resolution?: number;
  epochs?: number;
}

export interface CFDSimulationResponse {
  velocity_grid: number[][][];
  streamlines: [number, number, number, number][][];
  grid_resolution: number;
  max_velocity_mps: number;
  avg_velocity_mps: number;
  air_changes_per_hour: number;
  cross_ventilation_efficiency: number;
  open_window_count: number;
  status: string;
  message?: string;
}

