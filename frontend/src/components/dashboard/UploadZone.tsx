"use client";

import React, { useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { triggerFloorplanProcessing } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Upload, FileImage, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface UploadZoneProps {
  userId?: string;
  onProjectCreated?: (projectId: string) => void;
}

export function UploadZone({ userId = "guest_user", onProjectCreated }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default coordinates (e.g. Barcelona: 41.3879° N, 2.1699° E)
  const [latitude, setLatitude] = useState(41.3879);
  const [longitude, setLongitude] = useState(2.1699);
  const [projectName, setProjectName] = useState("Modern Residence Demo");

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }
    setError(null);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartPipeline = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      setStatusMessage("Uploading 2D floorplan to Cloud Storage...");
      const storageRef = ref(storage, `floorplans/${userId}/${projectId}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

      setStatusMessage("Initializing project in Firestore...");
      const projectRef = doc(db, "projects", projectId);
      await setDoc(projectRef, {
        id: projectId,
        userId,
        name: projectName,
        floorplanUrl: downloadUrl,
        status: "PROCESSING_VISION",
        progressPercent: 20,
        coordinates: {
          latitude,
          longitude,
          orientationDegrees: 0,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setStatusMessage("Triggering Python AI microservice (OpenCV + PINN)...");
      try {
        await triggerFloorplanProcessing({
          projectId,
          floorplanStorageUrl: downloadUrl,
          latitude,
          longitude,
          ambientTemperatureCelsius: 28.5,
        });
      } catch (backendErr: any) {
        console.warn("Backend microservice note:", backendErr.message);
        // Will continue so client can observe mock/fallback updates in demo mode
      }

      setStatusMessage("Floorplan uploaded successfully!");
      if (onProjectCreated) {
        onProjectCreated(projectId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process floorplan.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-[#0D0D0D] p-8 shadow-2xl">
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-burgundy shadow-burgundy animate-pulse" />
          Ingest 2D Architectural Floorplan
        </h2>
        <p className="text-sm text-neutral-400">
          Upload your architectural CAD drawing or image. Our vision engine will
          vectorize walls and feed structural polygons to the Thermal PINN solver.
        </p>
      </div>

      {/* Configuration inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-black border border-white/15 rounded-md px-3 py-2 text-sm text-white focus:border-burgundy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
            Latitude (°N)
          </label>
          <input
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
            className="w-full bg-black border border-white/15 rounded-md px-3 py-2 text-sm text-white focus:border-burgundy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
            Longitude (°E)
          </label>
          <input
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
            className="w-full bg-black border border-white/15 rounded-md px-3 py-2 text-sm text-white focus:border-burgundy-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-burgundy-500 bg-burgundy-950/20"
            : "border-white/15 hover:border-burgundy hover:bg-neutral-900/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={previewUrl}
              alt="Floorplan preview"
              className="max-h-56 object-contain rounded-lg border border-white/10"
            />
            <p className="text-xs text-neutral-400 font-mono">
              {file?.name} ({(file!.size / 1024).toFixed(1)} KB)
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-burgundy/20 border border-burgundy flex items-center justify-center text-burgundy-400">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Drag and drop your 2D floorplan image here
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Supports PNG, JPG, or high-contrast architectural drawings
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress & Status */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-4">
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-burgundy h-2 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Uploading: {uploadProgress}%
          </p>
        </div>
      )}

      {statusMessage && (
        <p className="text-xs text-burgundy-300 font-mono mt-3 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {statusMessage}
        </p>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-md bg-burgundy-950/60 border border-burgundy text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          disabled={!file || isProcessing}
          onClick={handleStartPipeline}
          size="lg"
          variant="burgundy"
          className="w-full sm:w-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing AI Pipeline...
            </>
          ) : (
            "Extrude & Simulate Thermal Flow"
          )}
        </Button>
      </div>
    </div>
  );
}
