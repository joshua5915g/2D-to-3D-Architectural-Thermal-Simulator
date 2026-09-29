import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any

from app.models.schemas import (
    ESGCalculationRequest,
    ESGCalculationResponse,
)
from app.services.esg import (
    calculate_esg_and_roi,
    MATERIAL_SPECS,
    GRID_CARBON_FACTORS,
    TARIFF_RATES,
    NET_ZERO_THRESHOLD_KWH_PER_SQFT,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/calculate",
    response_model=ESGCalculationResponse,
    summary="Compute ESG Carbon Emissions, Energy Use Intensity, and 15-Year Financial ROI",
)
async def calculate_esg_metrics(request: ESGCalculationRequest):
    """
    Evaluates cooling electricity consumption, utility costs, operational carbon emissions,
    and calculates the dynamic break-even payback timeline for envelope material upgrades.
    """
    try:
        return calculate_esg_and_roi(request)
    except Exception as e:
        logger.error(f"ESG calculation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ESG calculation error: {str(e)}",
        )


@router.get(
    "/tariffs",
    summary="Retrieve Available Utility Tariffs, Regional Carbon Grids, and Material Specs",
)
async def get_esg_configuration():
    """
    Returns available materials with R-values, regional grid emission factors,
    utility tariff structures, and Net-Zero thresholds.
    """
    return {
        "materials": {
            k.value: {
                "name": v.name,
                "wall_r_value": v.wall_r_value,
                "roof_r_value": v.roof_r_value,
                "window_u_value": v.window_u_value,
                "shgc": v.shgc,
                "capex_premium_per_sqft": v.capex_premium_per_sqft,
            }
            for k, v in MATERIAL_SPECS.items()
        },
        "grid_carbon_factors_kg_kwh": {k.value: v for k, v in GRID_CARBON_FACTORS.items()},
        "tariffs": {k.value: v for k, v in TARIFF_RATES.items()},
        "net_zero_threshold_eui": NET_ZERO_THRESHOLD_KWH_PER_SQFT,
    }
