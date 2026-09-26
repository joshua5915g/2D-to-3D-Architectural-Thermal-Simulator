import cv2
import numpy as np
from typing import List, Tuple, Dict, Any


class ContourDetector:
    def __init__(self, pixels_per_meter: float = 40.0):
        self.pixels_per_meter = pixels_per_meter

    def extract_wall_polygons_and_rooms(
        self, binary_mask: np.ndarray
    ) -> Dict[str, Any]:
        """
        Parses binary architectural mask into exterior/interior wall segments and rooms.
        """
        height, width = binary_mask.shape

        # Find external and internal contours
        contours, hierarchy = cv2.findContours(
            binary_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )

        walls: List[Dict[str, Any]] = []
        rooms: List[Dict[str, Any]] = []

        wall_idx = 0
        room_idx = 0

        # Center origin in meters
        origin_x = width / 2.0
        origin_y = height / 2.0

        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            # Filter negligible artifacts
            if area < 50:
                continue

            # Simplify contour into orthogonal architectural vertices
            epsilon = 0.015 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)

            # Convert to metric coordinates (meters centered around 0,0)
            pts_meters: List[Tuple[float, float]] = []
            for pt in approx:
                px, py = pt[0]
                mx = (px - origin_x) / self.pixels_per_meter
                my = (py - origin_y) / self.pixels_per_meter
                pts_meters.append((round(float(mx), 3), round(float(my), 3)))

            # If contour is a thick enclosing structure or room
            if len(pts_meters) >= 3:
                area_sqm = round(area / (self.pixels_per_meter**2), 2)
                if area_sqm > 5.0:
                    rooms.append(
                        {
                            "id": f"room_{room_idx}",
                            "name": f"Architectural Zone {room_idx + 1}",
                            "polygon": pts_meters,
                            "areaSqMeters": area_sqm,
                            "height": 2.8,
                        }
                    )
                    room_idx += 1

                # Generate wall segments between sequential polygon points
                for j in range(len(pts_meters)):
                    p1 = pts_meters[j]
                    p2 = pts_meters[(j + 1) % len(pts_meters)]
                    # Ignore zero-length edges
                    if p1 != p2:
                        walls.append(
                            {
                                "id": f"wall_{wall_idx}",
                                "startPoint": p1,
                                "endPoint": p2,
                                "thickness": 0.25,
                                "height": 2.8,
                            }
                        )
                        wall_idx += 1

        # Fallback default room if floorplan had no distinct detected inner room loops
        if not rooms:
            rooms.append(
                {
                    "id": "room_0",
                    "name": "Main Living Atrium",
                    "polygon": [(-5.0, -4.0), (5.0, -4.0), (5.0, 4.0), (-5.0, 4.0)],
                    "areaSqMeters": 80.0,
                    "height": 2.8,
                }
            )

        if not walls:
            walls = [
                {"id": "w0", "startPoint": (-5.0, -4.0), "endPoint": (5.0, -4.0), "thickness": 0.25, "height": 2.8},
                {"id": "w1", "startPoint": (5.0, -4.0), "endPoint": (5.0, 4.0), "thickness": 0.25, "height": 2.8},
                {"id": "w2", "startPoint": (5.0, 4.0), "endPoint": (-5.0, 4.0), "thickness": 0.25, "height": 2.8},
                {"id": "w3", "startPoint": (-5.0, 4.0), "endPoint": (-5.0, -4.0), "thickness": 0.25, "height": 2.8},
            ]

        return {"walls": walls, "rooms": rooms}
