from pydantic import BaseModel, Field
from typing import List, Tuple, Optional


class ProcessFloorplanRequest(BaseModel):
    projectId: str
    floorplanStorageUrl: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    orientationDegrees: float = 0.0
    ambientTemperatureCelsius: float = 28.0
    wallHeightMeters: float = 2.8


class WallSegmentSchema(BaseModel):
    id: str
    startPoint: Tuple[float, float]
    endPoint: Tuple[float, float]
    thickness: float = 0.25
    height: float = 2.8


class RoomPolygonSchema(BaseModel):
    id: str
    name: str
    polygon: List[Tuple[float, float]]
    areaSqMeters: float
    height: float = 2.8


class Extruded3DGeometrySchema(BaseModel):
    vertices: List[float]
    indices: List[int]
    normals: List[float]
    uvs: List[float]
    walls: List[WallSegmentSchema]
    rooms: List[RoomPolygonSchema]
