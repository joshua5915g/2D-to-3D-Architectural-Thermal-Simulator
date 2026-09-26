export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface WallSegment {
  id: string;
  startPoint: [number, number]; // 2D coordinates in meters
  endPoint: [number, number];
  thickness: number; // in meters (e.g. 0.2m)
  height: number; // in meters (e.g. 2.8m)
}

export interface RoomPolygon {
  id: string;
  name: string;
  polygon: [number, number][]; // 2D boundary polygon
  areaSqMeters: number;
  height: number;
}

export interface Extruded3DGeometry {
  vertices: number[]; // Flat array of [x, y, z, ...]
  indices: number[];  // Triangles
  normals: number[];
  uvs: number[];
  walls: WallSegment[];
  rooms: RoomPolygon[];
  boundingBox: {
    min: Vector3D;
    max: Vector3D;
  };
}
