from pydantic import BaseModel
from typing import Optional
from app.schemas.floorplan import Extruded3DGeometrySchema
from app.schemas.thermal import ThermalSimulationResponse


class ProjectStatusUpdate(BaseModel):
    projectId: str
    status: str
    progressPercent: int
    error: Optional[str] = None


class FullProcessResponse(BaseModel):
    projectId: str
    status: str
    message: str
    geometry: Extruded3DGeometrySchema
    thermal: ThermalSimulationResponse
