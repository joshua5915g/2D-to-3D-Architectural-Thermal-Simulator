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

export interface ThermalSimulationResult {
  projectId: string;
  ambientTempCelsius: number;
  solarFlux: SolarFluxPoint;
  thermalScalarField: number[]; // Temperature aligned with mesh vertices
  surfaceNodes: ThermalNodeResult[];
  roomSummaries: RoomThermalSummary[];
  simulatedAt: number;
}
