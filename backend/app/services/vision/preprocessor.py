import cv2
import numpy as np
import httpx
import logging

logger = logging.getLogger(__name__)


class FloorplanPreprocessor:
    @staticmethod
    async def fetch_image_bytes(url: str) -> bytes:
        """Download image from Firebase Storage or any HTTP URL."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content

    @staticmethod
    def preprocess_image(image_bytes: bytes) -> np.ndarray:
        """
        Process raw image bytes into a clean binary mask highlighting walls.
        Applies grayscale, bilateral filtering, Otsu/adaptive thresholding,
        and morphological opening/closing.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Unable to decode floorplan image data.")

        # 1. Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Denoising preserving architectural sharp corners
        denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

        # 3. Adaptive threshold to isolate black wall ink from white canvas
        thresh = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            15,
            4,
        )

        # 4. Morphological closing to seal small architectural gap strokes
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        return closed
