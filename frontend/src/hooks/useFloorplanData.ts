"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FloorplanVectorData } from "@/types/project";

// High-fidelity fallback architectural floorplan in normalized coordinates [0.0, 1.0]
const DEFAULT_SAMPLE_FLOORPLAN: FloorplanVectorData = {
  image_dimensions: [1000, 800],
  normalized: true,
  element_counts: { wall: 5, window: 3, door: 2 },
  elements: [
    // Outer boundary walls
    {
      id: "wall_ext_north",
      type: "wall",
      coordinates: [
        [0.1, 0.1],
        [0.9, 0.1],
        [0.9, 0.13],
        [0.1, 0.13],
        [0.1, 0.1],
      ],
      thickness: 0.03,
    },
    {
      id: "wall_ext_south",
      type: "wall",
      coordinates: [
        [0.1, 0.87],
        [0.9, 0.87],
        [0.9, 0.9],
        [0.1, 0.9],
        [0.1, 0.87],
      ],
      thickness: 0.03,
    },
    {
      id: "wall_ext_west",
      type: "wall",
      coordinates: [
        [0.1, 0.1],
        [0.13, 0.1],
        [0.13, 0.9],
        [0.1, 0.9],
        [0.1, 0.1],
      ],
      thickness: 0.03,
    },
    {
      id: "wall_ext_east",
      type: "wall",
      coordinates: [
        [0.87, 0.1],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.87, 0.9],
        [0.87, 0.1],
      ],
      thickness: 0.03,
    },
    // Interior dividing partition wall
    {
      id: "wall_int_partition",
      type: "wall",
      coordinates: [
        [0.48, 0.13],
        [0.52, 0.13],
        [0.52, 0.58],
        [0.48, 0.58],
        [0.48, 0.13],
      ],
      thickness: 0.04,
    },
    // Windows on outer envelope
    {
      id: "window_north_1",
      type: "window",
      coordinates: [
        [0.25, 0.09],
        [0.42, 0.09],
        [0.42, 0.14],
        [0.25, 0.14],
        [0.25, 0.09],
      ],
    },
    {
      id: "window_south_1",
      type: "window",
      coordinates: [
        [0.6, 0.86],
        [0.8, 0.86],
        [0.8, 0.91],
        [0.6, 0.91],
        [0.6, 0.86],
      ],
    },
    {
      id: "window_west_1",
      type: "window",
      coordinates: [
        [0.09, 0.35],
        [0.14, 0.35],
        [0.14, 0.55],
        [0.09, 0.55],
        [0.09, 0.35],
      ],
    },
    // Doors / Openings
    {
      id: "door_entrance_south",
      type: "door",
      coordinates: [
        [0.32, 0.86],
        [0.44, 0.86],
        [0.44, 0.91],
        [0.32, 0.91],
        [0.32, 0.86],
      ],
    },
    {
      id: "door_interior_corridor",
      type: "door",
      coordinates: [
        [0.48, 0.58],
        [0.52, 0.58],
        [0.52, 0.72],
        [0.48, 0.72],
        [0.48, 0.58],
      ],
    },
  ],
};

export function useFloorplanData(projectId: string | null = null) {
  const [vectorData, setVectorData] = useState<FloorplanVectorData>(
    DEFAULT_SAMPLE_FLOORPLAN
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomProject, setIsCustomProject] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setVectorData(DEFAULT_SAMPLE_FLOORPLAN);
      setIsCustomProject(false);
      return;
    }

    setLoading(true);

    // Listen to Firestore real-time updates for vectorData
    const unsubVector = onSnapshot(
      doc(db, `projects/${projectId}/data/vectorData`),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FloorplanVectorData;
          if (data && data.elements && data.elements.length > 0) {
            setVectorData(data);
            setIsCustomProject(true);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore vectorData subscription note:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubVector();
  }, [projectId]);

  return { vectorData, loading, error, isCustomProject };
}
