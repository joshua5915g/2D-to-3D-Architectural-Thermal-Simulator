import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.models.schemas import (
    ThermalSimulateRequest,
    ThermalSimulationGridResponse,
    HourlySolarTelemetry,
    ElementType,
)
from app.services.solar import (
    calculate_24h_solar_trajectory,
    calculate_full_diurnal_solar_data,
)
from app.ml.pinn import solve_24h_thermal_grid
from app.services.pinn.solar_model import SolarRadiationModel
from app.services.pinn.solver import ThermalPINNSolver

logger = logging.getLogger(__name__)

router = APIRouter()


class SolarCalculateRequest(BaseModel):
    latitude: float
    longitude: float
    dayOfYear: int = 172
    solarHour: float = 13.5


class MeshSimulateRequest(BaseModel):
    projectId: str
    vertices: List[float]
    rooms: List[Dict[str, Any]] = []
    latitude: float = 41.3879
    longitude: float = 2.1699
    ambientTempCelsius: float = 28.0
    orientationDegrees: float = 0.0


@router.post("/calculate-solar", summary="Calculate instantaneous solar radiation & geometry")
async def calculate_solar_radiation(req: SolarCalculateRequest):
    """
    Computes solar azimuth, elevation, and clear-sky radiation components
    for a given hour and geographical location.
    """
    try:
        return SolarRadiationModel.calculate_solar_position(
            req.latitude, req.longitude, req.dayOfYear, req.solarHour
        )
    except Exception as e:
        logger.error(f"Error calculating solar position: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Solar calculation failed: {str(e)}",
        )


@router.post(
    "/simulate",
    response_model=ThermalSimulationGridResponse,
    summary="Run 24-Hour Physics-Informed Neural Network (PINN) Thermal Simulation",
)
async def simulate_thermal_cycle(request: ThermalSimulateRequest):
    """
    Receives extracted floorplan vector data (walls, doors, windows) and GPS coordinates.
    Computes a 24-hour diurnal solar trajectory, simulates thermal heat transfer
    and solar aperture penetration via a transient PINN PDE solver,
    and returns a discretized [24, N, N] temperature heatmap matrix.
    """
    try:
        logger.info(
            f"Starting 24h PINN simulation: Lat={request.latitude}, Lon={request.longitude}, "
            f"GridRes={request.grid_resolution}, Epochs={request.epochs}, "
            f"Elements={len(request.vector_data.elements)}"
        )

        # 1. Filter window elements for solar aperture penetration
        windows = [
            elem for elem in request.vector_data.elements if elem.type == ElementType.WINDOW
        ]

        # 2. Compute 24-hour diurnal solar trajectory & aperture penetration
        solar_telemetry = calculate_full_diurnal_solar_data(
            latitude=request.latitude,
            longitude=request.longitude,
            date_str=request.date,
            windows=windows,
        )

        # 3. Train PINN model and generate temporal grid heatmaps
        grid_response = solve_24h_thermal_grid(
            request=request,
            solar_telemetry=solar_telemetry,
        )

        logger.info(
            f"PINN simulation complete. MinTemp={grid_response.min_temperature}°C, "
            f"MaxTemp={grid_response.max_temperature}°C, AvgTemp={grid_response.average_temperature}°C"
        )
        return grid_response

    except Exception as e:
        logger.error(f"Thermal PINN simulation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PINN thermal simulation failed: {str(e)}",
        )


@router.post(
    "/simulate-mesh",
    summary="Simulate 3D mesh vertex temperatures with PINN",
)
async def simulate_mesh_thermal(req: MeshSimulateRequest):
    """
    Calculates vertex-level thermal scalar fields directly for extruded 3D meshes.
    """
    try:
        solver = ThermalPINNSolver()
        result = solver.simulate(
            project_id=req.projectId,
            vertices=req.vertices,
            rooms=req.rooms,
            latitude=req.latitude,
            longitude=req.longitude,
            ambient_temp_celsius=req.ambientTempCelsius,
            orientation_degrees=req.orientationDegrees,
        )
        return result
    except Exception as e:
        logger.error(f"Mesh thermal simulation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mesh thermal simulation failed: {str(e)}",
        )
