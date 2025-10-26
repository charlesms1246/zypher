"use client";

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface ThreeDPreviewProps {
  selectedCollateral: number;
}

/**
 * 3D Model Component
 * Renders the appropriate 3D GLTF model based on collateral type
 */
function Model({ collateralIndex }: { collateralIndex: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Animate rotation using useFrame
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15; // Slow rotation
    }
  });

  // Model configurations with GLTF paths
  const models = [
    { 
      name: "Gold Bar", 
      path: "/models/gold/scene.gltf",
      color: "#FFD700", 
      scale: 0.8,
      position: [0, -0.5, 0] as [number, number, number]
    },
    { 
      name: "Treasury Bond", 
      path: "/models/treasury_bond/scene.gltf",
      color: "#4169E1", 
      scale: 0.6,
      position: [0, -0.3, 0] as [number, number, number]
    },
    { 
      name: "Real Estate", 
      path: "/models/real_estate/scene.gltf",
      color: "#8B4513", 
      scale: 1.2,
      position: [0, -1, 0] as [number, number, number]
    },
    { 
      name: "Commodity", 
      path: "/models/commodity/scene.gltf",
      color: "#CD853F", 
      scale: 0.5,
      position: [0, -0.5, 0] as [number, number, number]
    },
    { 
      name: "Equity Token", 
      path: "/models/equity_token/scene.gltf",
      color: "#32CD32", 
      scale: 0.7,
      position: [0, -0.4, 0] as [number, number, number]
    }
  ];

  const model = models[collateralIndex] || models[0];

  // Load GLTF model
  let gltf;
  try {
    gltf = useGLTF(model.path);
  } catch (error) {
    console.error("Error loading GLTF model:", error);
    // Fallback to simple geometry
    return (
      <group ref={groupRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={model.color}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <primitive 
        object={gltf.scene.clone()} 
        scale={model.scale}
        position={model.position}
      />
    </group>
  );
}

// Preload all models
const modelPaths = [
  "/models/gold/scene.gltf",
  "/models/treasury_bond/scene.gltf",
  "/models/real_estate/scene.gltf",
  "/models/commodity/scene.gltf",
  "/models/equity_token/scene.gltf"
];

modelPaths.forEach(path => {
  useGLTF.preload(path);
});

/**
 * ThreeDPreview Component
 * Interactive 3D visualization of RWA collateral
 * @param selectedCollateral - Index of selected collateral type (0-4)
 */
export default function ThreeDPreview({ selectedCollateral }: ThreeDPreviewProps) {
  const models = [
    "Gold Bar",
    "Treasury Bond",
    "Real Estate",
    "Commodity",
    "Equity Token"
  ];

  const collateralName = models[selectedCollateral] || models[0];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          Collateral Preview
        </h3>
        <p className="text-sm text-text-secondary">
          {collateralName}
        </p>
      </div>

      {/* 3D Canvas */}
      <div 
        className="w-full h-96 md:h-[400px] bg-gradient-to-br from-abyss/20 to-surface rounded-lg overflow-hidden relative"
        aria-label="Interactive RWA Preview"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-text-secondary">Loading 3D model...</p>
              </div>
            </div>
          }
        >
          <Canvas
            style={{ width: '100%', height: '100%' }}
            gl={{ antialias: true, alpha: true }}
          >
            {/* Camera */}
            <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00FFB3" />
            <spotLight
              position={[0, 10, 0]}
              angle={0.3}
              penumbra={1}
              intensity={0.5}
              castShadow
            />

            {/* 3D Model */}
            <Model collateralIndex={selectedCollateral} />

            {/* Controls */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={10}
              autoRotate={false}
            />
          </Canvas>
        </Suspense>

        {/* Interaction hint */}
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-xs text-text-secondary/60 bg-surface/80 backdrop-blur-sm rounded px-3 py-1 inline-block">
            🖱️ Drag to rotate • Scroll to zoom
          </p>
        </div>
      </div>

      {/* Model info */}
      <div className="mt-4 p-3 bg-surface/50 rounded-lg">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-secondary">Type:</span>
            <span className="ml-2 text-text-primary font-medium">{collateralName}</span>
          </div>
          <div>
            <span className="text-text-secondary">Status:</span>
            <span className="ml-2 text-primary font-medium">✓ Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
