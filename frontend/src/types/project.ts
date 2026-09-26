export type SimulationStatus =
  | "PENDING_UPLOAD"
  | "PROCESSING_VISION"
  | "PROCESSING_PINN"
  | "COMPLETED"
  | "FAILED";

export type ElementType = "wall" | "window" | "door";

export interface ArchitecturalElement {
  id: string;
  type: ElementType;
  coordinates: [number, number][]; // normalized [x, y] coordinates 0.0 - 1.0
  confidence?: number;
  thickness?: number;
}

export interface FloorplanVectorData {
  elements: ArchitecturalElement[];
  image_dimensions: [number, number];
  normalized: boolean;
  element_counts: Record<string, number>;
  message?: string;
}

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

