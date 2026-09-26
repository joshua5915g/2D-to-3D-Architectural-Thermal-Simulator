from pydantic import BaseModel
from typing import List, Tuple


class SolarFluxSchema(BaseModel):
    azimuthDeg: float
    elevationDeg: float
    directNormalIrradianceWm2: float
    diffuseHorizontalIrradianceWm2: float


class RoomThermalSummarySchema(BaseModel):
    roomId: str
    roomName: str
    averageTempCelsius: float
    minTempCelsius: float
    maxTempCelsius: float
    thermalComfortIndex: str


class ThermalSimulationResponse(BaseModel):
    projectId: str
    ambientTempCelsius: float
    solarFlux: SolarFluxSchema
    thermalScalarField: List[float]
    roomSummaries: List[RoomThermalSummarySchema]
    simulatedAt: int
