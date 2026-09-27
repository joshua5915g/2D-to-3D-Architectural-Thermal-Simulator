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


class HourlySolarTelemetry(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of the day [0-23]")
    time_label: str = Field(..., description="Timestamp label (e.g., '14:00')")
    elevation_deg: float = Field(..., description="Sun elevation angle in degrees")
    azimuth_deg: float = Field(..., description="Sun azimuth angle in degrees")
    dni_wm2: float = Field(..., description="Direct Normal Irradiance in W/m^2")
    dhi_wm2: float = Field(..., description="Diffuse Horizontal Irradiance in W/m^2")
    window_penetration_flux_wm2: float = Field(
        default=0.0, description="Calculated solar thermal flux entering interior windows"
    )


class ThermalSimulateRequest(BaseModel):
    vector_data: FloorplanVectorData = Field(
        ..., description="Extracted architectural vector elements from Phase 2"
    )
    latitude: float = Field(
        default=41.3879, ge=-90.0, le=90.0, description="Site latitude in degrees"
    )
    longitude: float = Field(
        default=2.1699, ge=-180.0, le=180.0, description="Site longitude in degrees"
    )
    date: str = Field(
        default="2026-06-21", description="Simulation calendar date in YYYY-MM-DD format"
    )
    ambient_base_temp: float = Field(
        default=24.0, description="Baseline ambient outdoor temperature in Celsius"
    )
    grid_resolution: int = Field(
        default=32, ge=16, le=64, description="Spatial resolution per 2D heatmap slice"
    )
    epochs: int = Field(
        default=25, ge=5, le=100, description="Fine-tuning training epochs for PINN"
    )


class ThermalSimulationGridResponse(BaseModel):
    time_steps: List[str] = Field(
        ..., description="List of 24 hourly interval labels ('00:00' to '23:00')"
    )
    solar_telemetry: List[HourlySolarTelemetry] = Field(
        ..., description="Calculated 24-hour solar trajectory and irradiance"
    )
    thermal_grids: List[List[List[float]]] = Field(
        ...,
        description="Temporal thermal heatmap array of shape [24, resolution, resolution] in Celsius",
    )
    grid_resolution: int = Field(..., description="Grid dimension N for N x N matrix")
    min_temperature: float = Field(..., description="Global minimum temperature in Celsius")
    max_temperature: float = Field(..., description="Global maximum temperature in Celsius")
    average_temperature: float = Field(..., description="Mean interior temperature in Celsius")
    status: str = Field(default="COMPLETED", description="Simulation execution status")
    message: str = Field(default="24-hour PINN thermal simulation completed.")

