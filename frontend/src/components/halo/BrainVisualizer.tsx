"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useHaloStore } from "@/lib/store";
import { Plus, Minus, RotateCcw, Target, Sparkles, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// 22 Electrode positions projected onto the anatomical FreeSurfer cortical surface
interface ElectrodeDef {
  name: string;
  x: number;
  y: number;
  z: number;
  region: "left_motor" | "right_motor" | "midline" | "frontal" | "parietal" | "occipital";
  isPrimary?: boolean;
}

const ELECTRODES: ElectrodeDef[] = [
  // Left motor cortex (contralateral to right hand)
  { name: "C3", x: -0.68, y: 0.56, z: 0.05, region: "left_motor", isPrimary: true },
  { name: "C5", x: -0.86, y: 0.35, z: 0.05, region: "left_motor", isPrimary: true },
  { name: "C1", x: -0.38, y: 0.72, z: 0.05, region: "left_motor" },
  { name: "FC3", x: -0.64, y: 0.58, z: 0.38, region: "left_motor", isPrimary: true },
  { name: "CP3", x: -0.64, y: 0.50, z: -0.28, region: "left_motor", isPrimary: true },
  { name: "FC1", x: -0.36, y: 0.72, z: 0.36, region: "left_motor" },
  { name: "CP1", x: -0.36, y: 0.64, z: -0.28, region: "left_motor" },

  // Right motor cortex (contralateral to left hand)
  { name: "C4", x: 0.68, y: 0.56, z: 0.05, region: "right_motor", isPrimary: true },
  { name: "C6", x: 0.86, y: 0.35, z: 0.05, region: "right_motor", isPrimary: true },
  { name: "C2", x: 0.38, y: 0.72, z: 0.05, region: "right_motor" },
  { name: "FC4", x: 0.64, y: 0.58, z: 0.38, region: "right_motor", isPrimary: true },
  { name: "CP4", x: 0.64, y: 0.50, z: -0.28, region: "right_motor", isPrimary: true },
  { name: "FC2", x: 0.36, y: 0.72, z: 0.36, region: "right_motor" },
  { name: "CP2", x: 0.36, y: 0.64, z: -0.28, region: "right_motor" },

  // Midline / Vertex
  { name: "Cz", x: 0.00, y: 0.80, z: 0.05, region: "midline", isPrimary: true },
  { name: "FCz", x: 0.00, y: 0.75, z: 0.40, region: "midline" },
  { name: "CPz", x: 0.00, y: 0.70, z: -0.28, region: "midline" },
  { name: "Fz", x: 0.00, y: 0.62, z: 0.86, region: "frontal" },
  { name: "Pz", x: 0.00, y: 0.54, z: -0.76, region: "parietal" },
  { name: "P1", x: -0.34, y: 0.46, z: -0.74, region: "parietal" },
  { name: "P2", x: 0.34, y: 0.46, z: -0.74, region: "parietal" },
  { name: "Oz", x: 0.00, y: 0.02, z: -1.16, region: "occipital" },
];

export function BrainVisualizer({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const latestFrame = useHaloStore((state) => state.latestFrame);
  const status = useHaloStore((state) => state.status);

  const [selectedElectrode, setSelectedElectrode] = useState<string>("C4");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // References for 3D state & animation loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const brainGroupRef = useRef<THREE.Group | null>(null);
  const leftCortexLightRef = useRef<THREE.PointLight | null>(null);
  const rightCortexLightRef = useRef<THREE.PointLight | null>(null);
  const leftMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const rightMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const electrodeMeshesRef = useRef<Map<string, { mesh: THREE.Mesh; glow: THREE.Mesh; def: ElectrodeDef }>>(new Map());

  // Mouse drag controls
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0.22, y: -0.55 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0.22, y: -0.55 });
  const zoomDistanceRef = useRef<number>(3.3);

  // Real-time intent metrics
  const isRunning = status?.state === "running";
  const pLeft = isRunning && latestFrame?.pred ? latestFrame.pred.left : 0.5;
  const pRight = isRunning && latestFrame?.pred ? latestFrame.pred.right : 0.5;
  const confidence = latestFrame?.pred?.confidence ?? 0.84;
  const label = latestFrame?.pred?.label ?? "right";

  // Initialize Three.js Scene and Load Real Anatomical Mesh
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.2, zoomDistanceRef.current);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and ACES tone mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x0a1420, 2.2);
    scene.add(ambientLight);

    const topSun = new THREE.DirectionalLight(0xffffff, 2.0);
    topSun.position.set(2, 6, 4);
    scene.add(topSun);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    fillLight.position.set(-4, -2, -3);
    scene.add(fillLight);

    // Dynamic Cortical Point Lights for Left and Right Motor Strips
    const leftMotorLight = new THREE.PointLight(0x4cc9f0, 0.4, 2.5);
    leftMotorLight.position.set(-0.75, 0.65, 0.05);
    scene.add(leftMotorLight);
    leftCortexLightRef.current = leftMotorLight;

    const rightMotorLight = new THREE.PointLight(0xffb547, 0.4, 2.5);
    rightMotorLight.position.set(0.75, 0.65, 0.05);
    scene.add(rightMotorLight);
    rightCortexLightRef.current = rightMotorLight;

    // 5. Brain Container Group
    const brainGroup = new THREE.Group();
    brainGroup.position.set(0, -0.05, 0);
    scene.add(brainGroup);
    brainGroupRef.current = brainGroup;

    // 6. Concentric Holographic Pedestal Platform (underneath brain)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -1.05, 0);
    pedestalGroup.rotation.x = -Math.PI / 2;
    scene.add(pedestalGroup);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.265, 64), ringMat);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.895, 64), ringMat);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.07, side: THREE.DoubleSide })
    );
    pedestalGroup.add(ring1);
    pedestalGroup.add(ring2);
    pedestalGroup.add(disk);

    // 7. Load Anatomical FreeSurfer Cortical Surface from /models/fsaverage_brain.json
    fetch("/models/fsaverage_brain.json")
      .then((res) => res.json())
      .then((data) => {
        // Create Left Hemisphere Geometry
        const lhGeo = new THREE.BufferGeometry();
        lhGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.lh.vertices), 3));
        lhGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(data.lh.normals), 3));
        lhGeo.setIndex(data.lh.faces);

        // Create Right Hemisphere Geometry
        const rhGeo = new THREE.BufferGeometry();
        rhGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.rh.vertices), 3));
        rhGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(data.rh.normals), 3));
        rhGeo.setIndex(data.rh.faces);

        // Bioluminescent Physical Cortical Materials
        // Translucent glass/silicone shader with internal transmission & cortical emission
        const lhMat = new THREE.MeshPhysicalMaterial({
          color: 0x0c2538,
          emissive: 0x06141f,
          emissiveIntensity: 0.35,
          roughness: 0.22,
          metalness: 0.12,
          transmission: 0.68,
          thickness: 0.9,
          ior: 1.38,
          transparent: true,
          opacity: 0.92,
        });
        leftMatRef.current = lhMat;

        const rhMat = new THREE.MeshPhysicalMaterial({
          color: 0x0c2538,
          emissive: 0x06141f,
          emissiveIntensity: 0.35,
          roughness: 0.22,
          metalness: 0.12,
          transmission: 0.68,
          thickness: 0.9,
          ior: 1.38,
          transparent: true,
          opacity: 0.92,
        });
        rightMatRef.current = rhMat;

        const lhMesh = new THREE.Mesh(lhGeo, lhMat);
        const rhMesh = new THREE.Mesh(rhGeo, rhMat);
        brainGroup.add(lhMesh);
        brainGroup.add(rhMesh);

        // Subtle neural gyral wireframe overlay for scientific visualization
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x4cc9f0,
          wireframe: true,
          transparent: true,
          opacity: 0.05,
        });
        brainGroup.add(new THREE.Mesh(lhGeo, wireMat));
        brainGroup.add(new THREE.Mesh(rhGeo, wireMat));

        // 8. Internal Bioluminescent Synaptic Node Plexus (Inside ventricles/white matter)
        const nodeCount = 180;
        const positions = new Float32Array(nodeCount * 3);
        const colors = new Float32Array(nodeCount * 3);

        for (let i = 0; i < nodeCount; i++) {
          const idx = i * 3;
          const isLeft = i % 2 === 0;
          const side = isLeft ? -1 : 1;

          // Distribute inside the deep cortical mantle
          const r = 0.25 + Math.random() * 0.45;
          const theta = Math.random() * Math.PI * 2;
          const phi = (Math.random() - 0.2) * Math.PI * 0.9;

          positions[idx] = side * 0.25 + r * Math.sin(phi) * Math.cos(theta) * 0.65;
          positions[idx + 1] = r * Math.cos(phi) * 0.7 - 0.05;
          positions[idx + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.85;

          if (isLeft) {
            colors[idx] = 0.3;
            colors[idx + 1] = 0.79;
            colors[idx + 2] = 0.94;
          } else {
            colors[idx] = 1.0;
            colors[idx + 1] = 0.71;
            colors[idx + 2] = 0.28;
          }
        }

        const neuralGeo = new THREE.BufferGeometry();
        neuralGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        neuralGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const neuralPoints = new THREE.Points(
          neuralGeo,
          new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.75 })
        );
        brainGroup.add(neuralPoints);

        // Synaptic line segments
        const lineIndices: number[] = [];
        for (let i = 0; i < nodeCount; i++) {
          for (let j = i + 1; j < nodeCount; j++) {
            const dx = positions[i * 3] - positions[j * 3];
            const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
            const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 0.24) {
              lineIndices.push(i, j);
            }
          }
        }
        const axonGeo = new THREE.BufferGeometry();
        axonGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        axonGeo.setIndex(lineIndices);
        const axonLines = new THREE.LineSegments(
          axonGeo,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.14 })
        );
        brainGroup.add(axonLines);
      })
      .catch((err) => {
        console.error("Failed to load anatomical brain model:", err);
      });

    // 9. 22 EEG Electrode Nodes on the Scalp Surface
    ELECTRODES.forEach((elec) => {
      // Outer glow aura
      const glowGeo = new THREE.SphereGeometry(elec.isPrimary ? 0.05 : 0.032, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color:
          elec.region === "left_motor"
            ? 0x4cc9f0
            : elec.region === "right_motor"
            ? 0xffb547
            : 0x94a3b8,
        transparent: true,
        opacity: elec.isPrimary ? 0.38 : 0.2,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.set(elec.x, elec.y, elec.z);
      brainGroup.add(glowMesh);

      // Core electrode sphere
      const sphereGeo = new THREE.SphereGeometry(elec.isPrimary ? 0.026 : 0.018, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color:
          elec.region === "left_motor"
            ? 0x4cc9f0
            : elec.region === "right_motor"
            ? 0xffb547
            : 0xf1f5f9,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.set(elec.x, elec.y, elec.z);
      brainGroup.add(sphereMesh);

      electrodeMeshesRef.current.set(elec.name, {
        mesh: sphereMesh,
        glow: glowMesh,
        def: elec,
      });
    });

    // 10. Animation Loop
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse rotation damping
      if (!isDraggingRef.current && autoRotate) {
        targetRotationRef.current.y += 0.003;
      }

      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

      if (brainGroupRef.current) {
        brainGroupRef.current.rotation.x = currentRotationRef.current.x;
        brainGroupRef.current.rotation.y = currentRotationRef.current.y;
      }

      // Smooth camera zoom
      if (cameraRef.current) {
        cameraRef.current.position.z += (zoomDistanceRef.current - cameraRef.current.position.z) * 0.1;
      }

      // Pedestal rotation
      pedestalGroup.rotation.z = elapsed * 0.06;

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Handling
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [autoRotate]);

  // Dynamic Cortical & Electrode Illumination based on Live Intent
  useEffect(() => {
    // When Left Hand Imagery is decoded (p_left is high):
    // The RIGHT motor cortex activates (C4, C6, FC4, CP4, C2)!
    // When Right Hand Imagery is decoded (p_right is high):
    // The LEFT motor cortex activates (C3, C5, FC3, CP3, C1)!

    const rightActivation = pLeft; // Contralateral: left hand activates right motor cortex
    const leftActivation = pRight; // Contralateral: right hand activates left motor cortex

    // Update Right Motor Cortex Light (Amber)
    if (rightCortexLightRef.current) {
      rightCortexLightRef.current.intensity = 0.2 + rightActivation * 3.2;
      rightCortexLightRef.current.distance = 2.0 + rightActivation * 1.5;
    }

    // Update Left Motor Cortex Light (Cyan)
    if (leftCortexLightRef.current) {
      leftCortexLightRef.current.intensity = 0.2 + leftActivation * 3.2;
      leftCortexLightRef.current.distance = 2.0 + leftActivation * 1.5;
    }

    // Dynamic Cortical Mesh Emission Flares
    if (leftMatRef.current) {
      leftMatRef.current.emissive.setHex(leftActivation > 0.6 ? 0x0284c7 : 0x06141f);
      leftMatRef.current.emissiveIntensity = 0.3 + leftActivation * 0.8;
    }
    if (rightMatRef.current) {
      rightMatRef.current.emissive.setHex(rightActivation > 0.6 ? 0xb45309 : 0x06141f);
      rightMatRef.current.emissiveIntensity = 0.3 + rightActivation * 0.8;
    }

    // Update electrode auras and sizes
    electrodeMeshesRef.current.forEach(({ mesh, glow, def }) => {
      let activation = 0.15;
      if (def.region === "right_motor") {
        activation = rightActivation;
      } else if (def.region === "left_motor") {
        activation = leftActivation;
      } else if (def.region === "midline") {
        activation = (leftActivation + rightActivation) * 0.4;
      }

      const isPrimary = def.isPrimary;
      const baseScale = isPrimary ? 1.0 : 0.7;
      const dynamicScale = baseScale * (1.0 + activation * 0.9);

      mesh.scale.set(dynamicScale, dynamicScale, dynamicScale);
      glow.scale.set(dynamicScale * (1.2 + activation * 1.4), dynamicScale * (1.2 + activation * 1.4), dynamicScale * (1.2 + activation * 1.4));

      // Glow opacity modulates with activation
      const glowMat = glow.material as THREE.MeshBasicMaterial;
      glowMat.opacity = 0.15 + activation * 0.7;
    });
  }, [pLeft, pRight]);

  // Mouse Interaction handlers for orbit & pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;

    targetRotationRef.current.y += deltaX * 0.008;
    targetRotationRef.current.x = Math.max(-0.6, Math.min(0.8, targetRotationRef.current.x + deltaY * 0.008));

    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleZoomIn = () => {
    zoomDistanceRef.current = Math.max(1.8, zoomDistanceRef.current - 0.4);
  };

  const handleZoomOut = () => {
    zoomDistanceRef.current = Math.min(5.0, zoomDistanceRef.current + 0.4);
  };

  const handleRecenter = () => {
    targetRotationRef.current = { x: 0.22, y: -0.55 };
    zoomDistanceRef.current = 3.3;
    setAutoRotate(true);
  };

  return (
    <div
      className={cn(
        "relative w-full h-[480px] lg:h-[520px] rounded-3xl overflow-hidden select-none bg-gradient-to-b from-[#0D1117] via-[#090D13] to-[#07090C] border border-white/10 shadow-2xl group",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Left Floating 3D Navigation Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 p-1 rounded-2xl halo-glass bg-[#0D0F12]/80 backdrop-blur-xl border-white/10 shadow-lg">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-xl text-muted hover:text-text hover:bg-white/[0.08] transition-colors"
          title="Zoom In"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-xl text-muted hover:text-text hover:bg-white/[0.08] transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="w-full h-[1px] bg-white/10 my-0.5" />
        <button
          onClick={handleRecenter}
          className="p-2 rounded-xl text-muted hover:text-text hover:bg-white/[0.08] transition-colors"
          title="Recenter View & Resume Auto-Orbit"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Right Active Cortical Region Badge */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
        {pLeft > 0.65 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFB547]/15 border border-[#FFB547]/30 backdrop-blur-md shadow-[0_0_15px_rgba(255,181,71,0.25)] animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-[#FFB547] animate-ping" />
            <span className="text-xs font-semibold text-[#FFB547] font-mono">
              RIGHT CORTEX ACTIVE (C4, C6)
            </span>
          </div>
        ) : pRight > 0.65 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4CC9F0]/15 border border-[#4CC9F0]/30 backdrop-blur-md shadow-[0_0_15px_rgba(76,201,240,0.25)] animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-[#4CC9F0] animate-ping" />
            <span className="text-xs font-semibold text-[#4CC9F0] font-mono">
              LEFT CORTEX ACTIVE (C3, C5)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <span className="text-xs font-medium text-muted font-mono">
              RESTING BASELINE
            </span>
          </div>
        )}
      </div>

      {/* Bottom Left Floating Glass On-Target Card (Matching Reference Screenshot) */}
      <div className="absolute bottom-4 left-4 z-20 p-4 rounded-2xl halo-glass bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl max-w-[200px]">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-mono font-semibold tracking-tight text-text tabular-nums">
            {(confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-3">
          <Target className="w-3.5 h-3.5 text-emerald-400" />
          <span>On Target ({label.toUpperCase()})</span>
        </div>
        <div className="w-full py-1.5 px-3 rounded-full bg-white/[0.08] border border-white/10 text-[11px] font-medium text-text flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#4CC9F0]" />
          <span>FreeSurfer fsaverage</span>
        </div>
      </div>

      {/* Bottom Center 3D Orbit Tip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5 text-[11px] text-muted/80 pointer-events-none">
        <Eye className="w-3 h-3 text-muted" />
        <span>Drag to orbit • Scroll to zoom</span>
      </div>

      {/* Bottom Right Selected Electrode Pill Cluster */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
        {["C3", "C5", "Cz", "C4", "C6"].map((name) => {
          const isSelected = selectedElectrode === name;
          const isLeft = name === "C3" || name === "C5";
          const isRight = name === "C4" || name === "C6";
          const isActive = (isLeft && pRight > 0.6) || (isRight && pLeft > 0.6);

          return (
            <button
              key={name}
              onClick={() => setSelectedElectrode(name)}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all",
                isSelected
                  ? "bg-white/20 text-white border border-white/30 shadow-sm"
                  : "bg-black/30 text-muted hover:text-text border border-white/5",
                isActive && isLeft && "text-[#4CC9F0] border-[#4CC9F0]/40 shadow-[0_0_8px_rgba(76,201,240,0.3)]",
                isActive && isRight && "text-[#FFB547] border-[#FFB547]/40 shadow-[0_0_8px_rgba(255,181,71,0.3)]"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
