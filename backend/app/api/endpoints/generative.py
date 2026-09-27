import logging
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import GenerateFloorplanRequest, GeneratedFloorplanResponse
from app.ml.gan import generate_architectural_floorplan

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/floorplan",
    response_model=GeneratedFloorplanResponse,
    summary="Generate 2D Architectural Floorplan Layout with Conditional GAN",
)
@router.post(
    "/generate/floorplan",
    response_model=GeneratedFloorplanResponse,
    summary="Generate 2D Architectural Floorplan Layout with Conditional GAN (Alias)",
)
async def generate_floorplan_endpoint(request: GenerateFloorplanRequest):
    """
    Receives target square footage, programmatic room schedule (bedrooms, bathrooms, balcony),
    and architectural style. Executes conditional GAN generation and derives normalized
    wall, door, and window vector geometries suitable for immediate 3D WebGL extrusion.
    """
    try:
        logger.info(
            f"Generating floorplan: SqFt={request.square_footage}, Beds={request.num_bedrooms}, "
            f"Baths={request.num_bathrooms}, Style={request.architectural_style}"
        )
        response = generate_architectural_floorplan(request)
        logger.info(
            f"Floorplan synthesized: {len(response.rooms)} rooms, "
            f"{response.vector_data.element_counts.get('wall', 0)} walls, "
            f"Total SqFt={response.total_area_sqft}"
        )
        return response
    except Exception as e:
        logger.error(f"Failed to generate floorplan: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generative floorplan synthesis failed: {str(e)}",
        )
