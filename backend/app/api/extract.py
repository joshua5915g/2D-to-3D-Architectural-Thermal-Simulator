import logging
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import ExtractFloorplanRequest, FloorplanVectorData
from app.services.vision import VisionProcessingService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/extract-floorplan",
    response_model=FloorplanVectorData,
    status_code=status.HTTP_200_OK,
    summary="Extract architectural vector geometry from 2D floorplan",
    description=(
        "Downloads a floorplan from a Firebase Storage URL (or Base64 data URL), "
        "runs semantic segmentation and contour analysis, applies the Douglas-Peucker "
        "polygon simplification algorithm (cv2.approxPolyDP), and returns normalized "
        "vector coordinates for walls, doors, and windows ready for 3D Three.js extrusion."
    ),
)
async def extract_floorplan(request: ExtractFloorplanRequest) -> FloorplanVectorData:
    """
    POST /api/vision/extract-floorplan
    Payload:
    - firebase_image_url: string
    - epsilon_factor: float (default 0.015)
    - min_contour_area: float (default 80.0)
    - normalize_coordinates: bool (default True)
    """
    if not request.firebase_image_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'firebase_image_url' field cannot be empty.",
        )

    try:
        logger.info(
            "Initiating architectural feature extraction for URL: %s (epsilon=%s, area=%s)",
            request.firebase_image_url[:60] + "...",
            request.epsilon_factor,
            request.min_contour_area,
        )

        vector_data = await VisionProcessingService.extract_floorplan_vectors(
            firebase_image_url=request.firebase_image_url,
            epsilon_factor=request.epsilon_factor,
            min_contour_area=request.min_contour_area,
            normalize_coordinates=request.normalize_coordinates,
        )

        return vector_data

    except ValueError as ve:
        logger.warning("Validation or image decode error: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as e:
        logger.exception("Unexpected error during floorplan vector extraction: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Floorplan computer vision processing failed: {str(e)}",
        )
