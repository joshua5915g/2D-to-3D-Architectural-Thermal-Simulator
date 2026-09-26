from fastapi import APIRouter
from pydantic import BaseModel
from app.services.pinn.solar_model import SolarRadiationModel

router = APIRouter()


class SolarCalculateRequest(BaseModel):
    latitude: float
    longitude: float
    dayOfYear: int = 172
    solarHour: float = 13.5


@router.post("/calculate-solar")
async def calculate_solar_radiation(req: SolarCalculateRequest):
    return SolarRadiationModel.calculate_solar_position(
        req.latitude, req.longitude, req.dayOfYear, req.solarHour
    )
