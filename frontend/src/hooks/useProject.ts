"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProjectMetadata } from "@/types/project";
import { Extruded3DGeometry } from "@/types/mesh";
import { ThermalSimulationResult } from "@/types/thermal";

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<ProjectMetadata | null>(null);
  const [mesh, setMesh] = useState<Extruded3DGeometry | null>(null);
  const [thermal, setThermal] = useState<ThermalSimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Listen to parent project doc
    const unsubProject = onSnapshot(
      doc(db, "projects", projectId),
      (snapshot) => {
        if (snapshot.exists()) {
          setProject({ id: snapshot.id, ...snapshot.data() } as ProjectMetadata);
        } else {
          setProject(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    // Listen to mesh subcollection or doc
    const unsubMesh = onSnapshot(
      doc(db, `projects/${projectId}/data/mesh`),
      (snapshot) => {
        if (snapshot.exists()) {
          setMesh(snapshot.data() as Extruded3DGeometry);
        }
      },
      () => {
        // Mesh not yet ready or processing
      }
    );

    // Listen to thermal simulation subcollection or doc
    const unsubThermal = onSnapshot(
      doc(db, `projects/${projectId}/data/thermal`),
      (snapshot) => {
        if (snapshot.exists()) {
          setThermal(snapshot.data() as ThermalSimulationResult);
        }
      },
      () => {
        // Thermal not yet ready or processing
      }
    );

    return () => {
      unsubProject();
      unsubMesh();
      unsubThermal();
    };
  }, [projectId]);

  const updateCoordinates = async (lat: number, lon: number, orientation = 0) => {
    if (!projectId) return;
    await updateDoc(doc(db, "projects", projectId), {
      "coordinates.latitude": lat,
      "coordinates.longitude": lon,
      "coordinates.orientationDegrees": orientation,
      updatedAt: Date.now(),
    });
  };

  return { project, mesh, thermal, loading, error, updateCoordinates };
}
