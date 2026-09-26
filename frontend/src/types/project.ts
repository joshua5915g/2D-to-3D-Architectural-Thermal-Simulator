export type SimulationStatus =
  | "PENDING_UPLOAD"
  | "PROCESSING_VISION"
  | "PROCESSING_PINN"
  | "COMPLETED"
  | "FAILED";

export interface ProjectCoordinates {
  latitude: number;
  longitude: number;
  orientationDegrees: number; // 0 = North up
}

export interface ProjectMetadata {
  id: string;
  userId: string;
  name: string;
  floorplanUrl: string;
  status: SimulationStatus;
  progressPercent: number;
  coordinates: ProjectCoordinates;
  createdAt: number;
  updatedAt: number;
  meshUrl?: string;
  error?: string;
}
