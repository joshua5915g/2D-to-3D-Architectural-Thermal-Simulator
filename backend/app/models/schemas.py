from enum import Enum
from typing import List, Tuple, Dict, Optional
from pydantic import BaseModel, Field, HttpUrl


class ElementType(str, Enum):
    WALL = "wall"
    WINDOW = "window"
    DOOR = "door"


class ExtractFloorplanRequest(BaseModel):
    firebase_image_url: str = Field(
        ...,
        description="Public or authenticated Firebase Cloud Storage URL for the floorplan image",
        examples=["https://firebasestorage.googleapis.com/v0/b/.../floorplan.png"],
    )
    epsilon_factor: float = Field(
        default=0.015,
        ge=0.001,
        le=0.1,
        description="Douglas-Peucker polygon approximation tolerance factor",
    )
    min_contour_area: float = Field(
        default=80.0,
        ge=10.0,
        description="Minimum contour pixel area threshold to filter small drawing artifacts",
    )
    normalize_coordinates: bool = Field(
        default=True,
        description="Whether to normalize polygon points into [0.0, 1.0] viewport space",
    )


class ArchitecturalElement(BaseModel):
    id: str = Field(..., description="Unique element identifier (e.g. wall_0, door_2)")
    type: ElementType = Field(..., description="Classification: wall, window, or door")
    coordinates: List[Tuple[float, float]] = Field(
        ...,
        description="Ordered sequence of 2D [x, y] polygon vertices (normalized 0.0 to 1.0 or pixel metrics)",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Detection / segmentation model confidence score",
    )
    thickness: Optional[float] = Field(
        default=None,
        description="Estimated element thickness in normalized or metric units",
    )


class FloorplanVectorData(BaseModel):
    elements: List[ArchitecturalElement] = Field(
        ..., description="List of extracted architectural vector elements"
    )
    image_dimensions: Tuple[int, int] = Field(
        ..., description="Original image dimensions [width, height] in pixels"
    )
    normalized: bool = Field(
        default=True, description="Indicates if coordinates are scaled from 0.0 to 1.0"
    )
    element_counts: Dict[str, int] = Field(
        default_factory=dict, description="Summary counts per element type"
    )
    message: Optional[str] = Field(
        default=None, description="Diagnostic status or processing summary"
    )
