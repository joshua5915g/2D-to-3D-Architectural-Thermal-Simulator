"""
CFD & Natural Ventilation API Endpoints
Provides Navier-Stokes PINN simulation for natural cross-ventilation and thermal stack effects.
"""

import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import CFDSimulateRequest, CFDSimulationResponse
from app.ml.cfd_pinn import solve_cfd_ventilation

logger = logging.getLogger("thermal.api.cfd")

router = APIRouter()


@router.post("/simulate", response_model=CFDSimulationResponse)
async def simulate_natural_ventilation(request: CFDSimulateRequest):
    """
    Executes a Physics-Informed Neural Network (PINN) CFD simulation
    solving the steady-state incompressible Navier-Stokes equations
    with Boussinesq buoyancy stack effect across the 3D floorplan.
    """
    try:
        logger.info(
            f"Starting CFD Ventilation PINN: wind_speed={request.wind_speed_mps}m/s, "
            f"azimuth={request.wind_direction_deg}°, windows={len(request.window_states)}"
        )
        response = solve_cfd_ventilation(request)
        return response
    except Exception as e:
        logger.error(f"CFD simulation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Fluid dynamics simulation failed: {str(e)}"
        )


@router.get("/config")
async def get_cfd_config():
    """Returns default meteorological wind boundary conditions and CFD constants."""
    return {
        "default_wind_speed_mps": 3.5,
        "default_wind_direction_deg": 225.0, # Southwest prevailing breeze
        "air_kinematic_viscosity": 1.5e-5,
        "boussinesq_thermal_expansion": 0.0034,
        "comfort_velocity_threshold_mps": 0.2,
    }
