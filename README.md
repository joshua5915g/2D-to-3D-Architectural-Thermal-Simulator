# 2D-to-3D Architectural Thermal Simulator

An elite web application and AI microservice suite that converts 2D architectural floorplans into extruded 3D building meshes, applying Physics-Informed Neural Networks (PINNs) to simulate and visualize solar-driven thermodynamic heat transfer.

## Architecture

* **Frontend (`/frontend`)**: Next.js 15 (App Router), React 19, TypeScript, React Three Fiber, Three.js, Tailwind CSS (Black `#000000`, Burgundy `#6D001A`, White `#FFFFFF`), and Firebase Client SDK (Auth, Cloud Storage, Cloud Firestore).
* **Backend (`/backend`)**: Python 3.11+, FastAPI, OpenCV (Contour & Vector Segmentation), PyTorch/SciPy (Thermal PINN Engine), Firebase Admin SDK.

## Getting Started

### 1. Frontend Setup
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
