"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useHaloStore } from "@/lib/store";

interface BrainData {
  lh: {
    vertices: number[];
    normals: number[];
    faces: number[];
  };
  rh: {
    vertices: number[];
    normals: number[];
    faces: number[];
  };
}

// Pseudo-random generator for deterministic crystalline facets
function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function FacetedBrainScene({
  className,
  scrollProgress = 0,
}: {
  className?: string;
  scrollProgress?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const latestFrame = useHaloStore((state) => state.latestFrame);

  // Prediction and label from latest real EEG frame
  const latestLabel = latestFrame?.pred?.label ?? null;
  const latestConfidence = latestFrame?.pred?.confidence ?? 0;

  // Track scroll progress with ref for smooth lerping inside requestAnimationFrame
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isDisposed = false;

    // --- 1. Scene, Camera, WebGL Renderer ---
    const scene = new THREE.Scene();

    const width = window.innerWidth;
    const height = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // Root groups
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const brainGroup = new THREE.Group();
    // Start positioned on the right side (Hero)
    brainGroup.position.set(1.15, 0.05, 0);
    brainGroup.scale.set(0.72, 0.72, 0.72);
    mainGroup.add(brainGroup);

    // Ambient floating shards group (attached to brainGroup so they stay with the brain)
    const shardsGroup = new THREE.Group();
    brainGroup.add(shardsGroup);

    // Initial Sagittal lateral orientation:
    // Left hemisphere facing camera, Frontal pole on Left, Occipital on Right
    const BASE_ROT_X = 0.08;
    const BASE_ROT_Y = -Math.PI / 2 + 0.12; // ~ -1.45 rad
    const BASE_ROT_Z = -0.04;
    brainGroup.rotation.set(BASE_ROT_X, BASE_ROT_Y, BASE_ROT_Z);

    // Mouse parallax tracking
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.targetX = Math.max(-1, Math.min(1, nx));
      mouse.targetY = Math.max(-1, Math.min(1, ny));
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let smoothScroll = scrollRef.current;
    let currentExplosion = 0.0;
    let currentEmblem = 0.0;
    let emblemSpinAngle = 0.0;
    let wasMorphed = false;

    // Buffer attribute references
    let facetPositionsAttr: THREE.BufferAttribute | null = null;
    let linePositionsAttr: THREE.BufferAttribute | null = null;
    let pointPositionsAttr: THREE.BufferAttribute | null = null;

    let facetColorsAttr: THREE.BufferAttribute | null = null;
    let baseFacetColors: Float32Array | null = null;

    let basePositionsArr: Float32Array | null = null;
    let disperseVectorsArr: Float32Array | null = null;
    let emblemPositionsArr: Float32Array | null = null;
    let emblemColorsArr: Float32Array | null = null;
    let centroidsArr: Float32Array | null = null;
    let totalFacetCount = 0;

    // --- 2. Ambient Floating Shards (Pinterest Reference) ---
    interface Shard {
      mesh: THREE.Object3D;
      rotSpeed: { x: number; y: number; z: number };
      basePos: THREE.Vector3;
      phase: number;
      depthFactor: number;
    }
    const ambientShards: Shard[] = [];

    // Prominent orbital shards surrounding the faceted cortex
    const shardConfigs = [
      // Top-left amber triangle
      { pos: [-1.45, 1.25, -0.1], size: 0.36, color: 0xffb703, wire: true, rot: [0.1, 0.2, 0.6] },
      // Top-right cyan triangle
      { pos: [1.35, 1.35, 0.15], size: 0.26, color: 0x00f0ff, wire: true, rot: [0.3, -0.4, 0.2] },
      // Left-middle emerald triangle
      { pos: [-1.65, -0.1, 0.2], size: 0.22, color: 0x10b981, wire: true, rot: [-0.2, 0.5, 0.1] },
      // Bottom-left violet triangle
      { pos: [-1.35, -1.15, 0.1], size: 0.24, color: 0xa855f7, wire: true, rot: [0.4, 0.2, -0.3] },
      // Bottom-right golden amber triangle
      { pos: [1.35, -1.05, -0.15], size: 0.25, color: 0xf59e0b, wire: true, rot: [-0.1, -0.3, 0.4] },
      // Deep background & foreground micro shards
      { pos: [-0.95, 1.5, -0.35], size: 0.14, color: 0xffd166, wire: true, rot: [0.2, 0.1, 0] },
      { pos: [0.85, 1.55, -0.3], size: 0.16, color: 0xec4899, wire: true, rot: [0, 0.3, 0.2] },
      { pos: [-1.75, 0.55, -0.2], size: 0.15, color: 0x38bdf8, wire: true, rot: [0.1, -0.2, 0.3] },
      { pos: [1.55, 0.35, -0.25], size: 0.18, color: 0xffb703, wire: true, rot: [-0.2, 0.2, 0.1] },
      { pos: [-0.65, -1.45, 0.2], size: 0.13, color: 0x6ee7b7, wire: true, rot: [0.3, 0.1, -0.1] },
      { pos: [0.95, -1.35, -0.2], size: 0.15, color: 0xc084fc, wire: true, rot: [-0.2, -0.2, 0.3] },
      { pos: [0.0, 1.65, 0.1], size: 0.12, color: 0xffffff, wire: true, rot: [0.1, 0.4, 0.2] },
    ];

    // 20 perimeter micro shards
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 1.45 + pseudoRandom(i + 15) * 0.55;
      const z = (pseudoRandom(i + 35) - 0.5) * 0.8; // Clamped strictly in depth [-0.4, +0.4]
      const colors = [0xffb703, 0x00f0ff, 0xec4899, 0xa855f7, 0xffffff, 0x10b981];
      shardConfigs.push({
        pos: [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.85, z],
        size: 0.05 + pseudoRandom(i + 55) * 0.06,
        color: colors[i % colors.length],
        wire: pseudoRandom(i + 75) > 0.35,
        rot: [
          (pseudoRandom(i + 85) - 0.5) * 0.8,
          (pseudoRandom(i + 95) - 0.5) * 0.8,
          (pseudoRandom(i + 105) - 0.5) * 0.8,
        ],
      });
    }

    shardConfigs.forEach((cfg, idx) => {
      const geom = new THREE.BufferGeometry();
      const s = cfg.size;
      const h = s * (Math.sqrt(3) / 2);
      const verts = new Float32Array([
        -s / 2, -h / 3, 0,
        s / 2, -h / 3, 0,
        0, (2 * h) / 3, 0,
      ]);
      geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));

      let obj: THREE.Object3D;
      if (cfg.wire) {
        const lineIndices = new Uint16Array([0, 1, 1, 2, 2, 0]);
        geom.setIndex(new THREE.BufferAttribute(lineIndices, 1));
        const lineMat = new THREE.LineBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        obj = new THREE.LineSegments(geom, lineMat);
      } else {
        const fillMat = new THREE.MeshBasicMaterial({
          color: cfg.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
        });
        obj = new THREE.Mesh(geom, fillMat);
      }

      obj.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      obj.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
      shardsGroup.add(obj);

      ambientShards.push({
        mesh: obj,
        rotSpeed: {
          x: (pseudoRandom(idx * 7) - 0.5) * 0.008,
          y: (pseudoRandom(idx * 11) - 0.5) * 0.01,
          z: (pseudoRandom(idx * 13) - 0.5) * 0.006,
        },
        basePos: new THREE.Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2]),
        phase: pseudoRandom(idx * 17) * Math.PI * 2,
        depthFactor: 0.25 + (cfg.pos[2] + 0.8) * 0.25,
      });
    });

    // --- 3. Build Anatomical Faceted Mesh from fsaverage_brain.json ---
    fetch("/models/fsaverage_brain.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load brain model");
        return res.json() as Promise<BrainData>;
      })
      .then((brainData) => {
        if (isDisposed) return;

        const { lh, rh } = brainData;

        interface RawFace {
          p0: [number, number, number];
          p1: [number, number, number];
          p2: [number, number, number];
          hemi: "lh" | "rh";
        }

        const rawFaces: RawFace[] = [];

        function extractFaces(hemiData: typeof lh, hemi: "lh" | "rh") {
          const v = hemiData.vertices;
          const faces = hemiData.faces;
          const faceCount = faces.length / 3;

          for (let f = 0; f < faceCount; f++) {
            const i0 = faces[f * 3];
            const i1 = faces[f * 3 + 1];
            const i2 = faces[f * 3 + 2];

            // FreeSurfer RAS to Three.js mapping matching the working hero orientation:
            // Three X = FS Axis 0 (lateral Left - to Right +)
            // Three Y = FS Axis 2 (inferior/posterior - to superior/anterior +)
            // Three Z = FS Axis 1 (inferior - to superior +)
            const p0: [number, number, number] = [v[i0 * 3], v[i0 * 3 + 2], v[i0 * 3 + 1]];
            const p1: [number, number, number] = [v[i1 * 3], v[i1 * 3 + 2], v[i1 * 3 + 1]];
            const p2: [number, number, number] = [v[i2 * 3], v[i2 * 3 + 2], v[i2 * 3 + 1]];

            rawFaces.push({ p0, p1, p2, hemi });
          }
        }

        extractFaces(lh, "lh");
        extractFaces(rh, "rh");

        // Brainstem stalk descending vertically
        const stemTiers = 14;
        for (let t = 0; t < stemTiers; t++) {
          const progress = t / (stemTiers - 1);
          const y = -0.7 - progress * 1.05;
          const radius = 0.22 * (1.0 - progress * 0.55);
          const segments = 12;

          for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const zCenter = -0.2;

            const p0: [number, number, number] = [
              Math.cos(a0) * radius,
              y,
              zCenter + Math.sin(a0) * radius * 0.8,
            ];
            const p1: [number, number, number] = [
              Math.cos(a1) * radius,
              y,
              zCenter + Math.sin(a1) * radius * 0.8,
            ];
            const p2: [number, number, number] = [
              (p0[0] + p1[0]) * 0.5 + (pseudoRandom(t * 10 + s) - 0.5) * 0.05,
              y - 0.08,
              (p0[2] + p1[2]) * 0.5 + (pseudoRandom(t * 20 + s) - 0.5) * 0.05,
            ];

            rawFaces.push({ p0, p1, p2, hemi: "lh" });
          }
        }

        // Cerebellum cluster under occipital lobe
        const cbTiers = 8;
        for (let c = 0; c < cbTiers; c++) {
          const cy = -0.65 - c * 0.05;
          const count = 18;
          for (let k = 0; k < count; k++) {
            const angle = (k / count) * Math.PI * 2;
            const rx = 0.45 * (1 - c * 0.08);
            const rz = 0.3 * (1 - c * 0.08);
            const cx = Math.cos(angle) * rx;
            const cz = -0.6 + Math.sin(angle) * rz;

            const d = 0.06;
            const p0: [number, number, number] = [cx - d, cy, cz - d];
            const p1: [number, number, number] = [cx + d, cy, cz - d];
            const p2: [number, number, number] = [cx, cy - d * 0.8, cz + d];

            rawFaces.push({ p0, p1, p2, hemi: cx < 0 ? "lh" : "rh" });
          }
        }

        totalFacetCount = rawFaces.length;
        const positions = new Float32Array(totalFacetCount * 9);
        const colors = new Float32Array(totalFacetCount * 9);
        const linePositions = new Float32Array(totalFacetCount * 18);
        const lineColors = new Float32Array(totalFacetCount * 18);

        basePositionsArr = new Float32Array(totalFacetCount * 9);
        disperseVectorsArr = new Float32Array(totalFacetCount * 3);
        emblemPositionsArr = new Float32Array(totalFacetCount * 9);
        emblemColorsArr = new Float32Array(totalFacetCount * 9);
        centroidsArr = new Float32Array(totalFacetCount * 3);

        for (let i = 0; i < totalFacetCount; i++) {
          const { p0, p1, p2 } = rawFaces[i];

          // Triangle Centroid
          const cx = (p0[0] + p1[0] + p2[0]) / 3;
          const cy = (p0[1] + p1[1] + p2[1]) / 3;
          const cz = (p0[2] + p1[2] + p2[2]) / 3;

          centroidsArr[i * 3] = cx;
          centroidsArr[i * 3 + 1] = cy;
          centroidsArr[i * 3 + 2] = cz;

          // Compute radial disperse vector for smooth 3D explosion
          const len = Math.hypot(cx, cy, cz) || 1.0;
          disperseVectorsArr[i * 3] = (cx / len) * (1.5 + pseudoRandom(i * 3.7) * 2.2);
          disperseVectorsArr[i * 3 + 1] = (cy / len) * (1.5 + pseudoRandom(i * 4.9) * 2.2);
          disperseVectorsArr[i * 3 + 2] = (cz / len) * (1.5 + pseudoRandom(i * 6.1) * 2.5);

          // Crystalline shrinkage leaving dark interstitial borders
          const facetScale = 0.62 + pseudoRandom(i * 1.37) * 0.28;

          const v0x = cx + (p0[0] - cx) * facetScale;
          const v0y = cy + (p0[1] - cy) * facetScale;
          const v0z = cz + (p0[2] - cz) * facetScale;

          const v1x = cx + (p1[0] - cx) * facetScale;
          const v1y = cy + (p1[1] - cy) * facetScale;
          const v1z = cz + (p1[2] - cz) * facetScale;

          const v2x = cx + (p2[0] - cx) * facetScale;
          const v2y = cy + (p2[1] - cy) * facetScale;
          const v2z = cz + (p2[2] - cz) * facetScale;

          const pIdx = i * 9;
          positions[pIdx] = v0x;
          positions[pIdx + 1] = v0y;
          positions[pIdx + 2] = v0z;
          positions[pIdx + 3] = v1x;
          positions[pIdx + 4] = v1y;
          positions[pIdx + 5] = v1z;
          positions[pIdx + 6] = v2x;
          positions[pIdx + 7] = v2y;
          positions[pIdx + 8] = v2z;

          // Store base positions for clean reset
          for (let k = 0; k < 9; k++) {
            basePositionsArr[pIdx + k] = positions[pIdx + k];
          }

          // Precompute Halo 3D Diamond Emblem target positions for Phase 5
          // Octahedron double pyramid geometry
          const uNorm = (i / totalFacetCount);
          const yNorm = (uNorm * 2.0 - 1.0); // [-1, +1]
          const emblemY = yNorm * 0.75;
          const rRing = (1.0 - Math.abs(yNorm)) * 0.58;
          const emblemAngle = (i * 2.39996) % (Math.PI * 2); // Golden angle
          const emblemX = Math.cos(emblemAngle) * rRing;
          const emblemZ = Math.sin(emblemAngle) * rRing;

          const eSpread = 0.035 * (1.0 - Math.abs(yNorm) * 0.5);
          emblemPositionsArr[pIdx] = emblemX - eSpread;
          emblemPositionsArr[pIdx + 1] = emblemY - eSpread * 0.5;
          emblemPositionsArr[pIdx + 2] = emblemZ;
          emblemPositionsArr[pIdx + 3] = emblemX + eSpread;
          emblemPositionsArr[pIdx + 4] = emblemY - eSpread * 0.5;
          emblemPositionsArr[pIdx + 5] = emblemZ;
          emblemPositionsArr[pIdx + 6] = emblemX;
          emblemPositionsArr[pIdx + 7] = emblemY + eSpread;
          emblemPositionsArr[pIdx + 8] = emblemZ + eSpread * 0.3;

          // Precompute radiant jewel-tone colors for the Diamond Emblem (Pinterest Frame 10)
          // Top pyramid: Electric ice cyan (#00F0FF) to royal purple (#A855F7)
          // Bottom pyramid: Warm golden amber (#FBBF24) to ruby magenta (#EC4899)
          let embR = 1.0;
          let embG = 1.0;
          let embB = 1.0;
          const rndEmb = pseudoRandom(i * 4.41);
          if (yNorm > 0) {
            const mixCyanPurple = (Math.cos(emblemAngle) + 1.0) * 0.5;
            embR = 0.08 + mixCyanPurple * 0.65;
            embG = 0.90 - mixCyanPurple * 0.50;
            embB = 1.0;
          } else {
            const mixAmberRuby = (Math.sin(emblemAngle) + 1.0) * 0.5;
            embR = 1.0;
            embG = 0.72 - mixAmberRuby * 0.48;
            embB = 0.15 + mixAmberRuby * 0.50;
          }
          const sheen = 0.88 + rndEmb * 0.16;
          for (let v = 0; v < 3; v++) {
            const ecIdx = pIdx + v * 3;
            emblemColorsArr[ecIdx] = Math.min(1.0, embR * sheen);
            emblemColorsArr[ecIdx + 1] = Math.min(1.0, embG * sheen);
            emblemColorsArr[ecIdx + 2] = Math.min(1.0, embB * sheen);
          }

          // --- Exact Color Grading from Pinterest Reference ---
          // 1. Lower rim / Temporal base / Brainstem: Warm amber-gold (#FFB547, #FBBF24, #FF8F00)
          // 2. Posterior base / Cerebellar fringe: Radiant electric magenta/pink (#EC4899, #E040FB, #A855F7)
          // 3. Middle gyri & superior cortex: Crisp starlight white (#FFFFFF) + ice cyan (#38BDF8)
          // 4. Scattered emerald/teal sparks
          let r = 1.0;
          let g = 1.0;
          let b = 1.0;

          const rnd = pseudoRandom(i * 3.19);

          if (cy < -0.35) {
            // Inferior base
            if (cz > -0.15) {
              // Anterior base & temporal pole: rich warm golden amber / yellow
              r = 1.0;
              g = 0.72 + rnd * 0.22;
              b = 0.12 + rnd * 0.12;
            } else {
              // Posterior base & occipital fringe: magenta / violet
              r = 0.92 + rnd * 0.08;
              g = 0.18 + rnd * 0.18;
              b = 0.92 + rnd * 0.08;
            }
          } else if (cy < 0.45) {
            // Middle gyri
            if (cz < -0.45) {
              // Occipital rim: soft purple & magenta tint
              r = 0.75 + rnd * 0.2;
              g = 0.35 + rnd * 0.2;
              b = 0.95;
            } else if (cz > 0.45) {
              // Frontal curve: warm gold-amber rim
              r = 1.0;
              g = 0.75 + rnd * 0.2;
              b = 0.2 + rnd * 0.1;
            } else {
              // Lateral gyri surface: diamond starlight white + electric ice cyan
              if (rnd < 0.28) {
                // Vibrant ice cyan
                r = 0.22;
                g = 0.82 + rnd * 0.15;
                b = 0.98;
              } else if (rnd < 0.35) {
                // Emerald spark
                r = 0.1;
                g = 0.92;
                b = 0.6;
              } else {
                // Crisp white / silver
                const lum = 0.85 + rnd * 0.15;
                r = lum;
                g = lum;
                b = lum;
              }
            }
          } else {
            // Superior cortex / motor strip
            if (rnd < 0.35) {
              // Cyan
              r = 0.28;
              g = 0.82;
              b = 1.0;
            } else {
              // Diamond white
              r = 0.98;
              g = 0.98;
              b = 1.0;
            }
          }

          // Assign color to each vertex of the triangle
          for (let v = 0; v < 3; v++) {
            const cIdx = pIdx + v * 3;
            colors[cIdx] = r;
            colors[cIdx + 1] = g;
            colors[cIdx + 2] = b;
          }

          // Wireframe line segments (v0->v1, v1->v2, v2->v0)
          const lIdx = i * 18;
          linePositions[lIdx] = v0x;
          linePositions[lIdx + 1] = v0y;
          linePositions[lIdx + 2] = v0z;
          linePositions[lIdx + 3] = v1x;
          linePositions[lIdx + 4] = v1y;
          linePositions[lIdx + 5] = v1z;

          linePositions[lIdx + 6] = v1x;
          linePositions[lIdx + 7] = v1y;
          linePositions[lIdx + 8] = v1z;
          linePositions[lIdx + 9] = v2x;
          linePositions[lIdx + 10] = v2y;
          linePositions[lIdx + 11] = v2z;

          linePositions[lIdx + 12] = v2x;
          linePositions[lIdx + 13] = v2y;
          linePositions[lIdx + 14] = v2z;
          linePositions[lIdx + 15] = v0x;
          linePositions[lIdx + 16] = v0y;
          linePositions[lIdx + 17] = v0z;

          const lr = Math.min(1.0, r * 1.15);
          const lg = Math.min(1.0, g * 1.15);
          const lb = Math.min(1.0, b * 1.15);
          for (let lv = 0; lv < 6; lv++) {
            const lcIdx = lIdx + lv * 3;
            lineColors[lcIdx] = lr;
            lineColors[lcIdx + 1] = lg;
            lineColors[lcIdx + 2] = lb;
          }
        }

        baseFacetColors = new Float32Array(colors);

        // 1. Solid Facet Mesh
        const facetGeometry = new THREE.BufferGeometry();
        facetPositionsAttr = new THREE.BufferAttribute(positions, 3);
        facetGeometry.setAttribute("position", facetPositionsAttr);
        facetColorsAttr = new THREE.BufferAttribute(colors, 3);
        facetGeometry.setAttribute("color", facetColorsAttr);

        const facetMaterial = new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          blending: THREE.NormalBlending,
        });
        const facetMesh = new THREE.Mesh(facetGeometry, facetMaterial);
        brainGroup.add(facetMesh);

        // 2. Razor-sharp Wireframe Facet Outlines
        const lineGeometry = new THREE.BufferGeometry();
        linePositionsAttr = new THREE.BufferAttribute(linePositions, 3);
        lineGeometry.setAttribute("position", linePositionsAttr);
        lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));

        const lineMaterial = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
        });
        const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        brainGroup.add(lineMesh);

        // 3. Sparkling Synaptic Points
        const pointPositions = new Float32Array(totalFacetCount * 3);
        const pointColors = new Float32Array(totalFacetCount * 3);
        for (let i = 0; i < totalFacetCount; i++) {
          pointPositions[i * 3] = centroidsArr[i * 3];
          pointPositions[i * 3 + 1] = centroidsArr[i * 3 + 1];
          pointPositions[i * 3 + 2] = centroidsArr[i * 3 + 2];

          pointColors[i * 3] = colors[i * 9];
          pointColors[i * 3 + 1] = colors[i * 9 + 1];
          pointColors[i * 3 + 2] = colors[i * 9 + 2];
        }
        const pointGeom = new THREE.BufferGeometry();
        pointPositionsAttr = new THREE.BufferAttribute(pointPositions, 3);
        pointGeom.setAttribute("position", pointPositionsAttr);
        pointGeom.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));

        const pointMat = new THREE.PointsMaterial({
          size: 0.022,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const pointsMesh = new THREE.Points(pointGeom, pointMat);
        brainGroup.add(pointsMesh);

        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Error creating 3D faceted brain:", err);
      });

    // --- 4. Responsive Resize ---
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // --- 5. Render Loop with Scroll-Driven Morphing & Parallax ---
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      // Smooth scroll lerp (responsive and fluid)
      smoothScroll += (scrollRef.current - smoothScroll) * 0.16;
      const s = Math.min(1, Math.max(0, smoothScroll));

      // Responsive viewport layout factors
      const vpWidth = window.innerWidth;
      const isMobile = vpWidth < 768;
      const isTablet = vpWidth >= 768 && vpWidth < 1024;
      const xFactor = isMobile ? 0.0 : isTablet ? 0.65 : 1.0;
      const scaleFactor = isMobile ? 0.58 : isTablet ? 0.82 : 1.0;

      // Accumulate continuous axial spin for Diamond Emblem in Phase 5
      if (currentEmblem > 0.08) {
        emblemSpinAngle += 0.011 * currentEmblem;
      }

      // --- CHOREOGRAPHY (Strictly mapped to the Pinterest Reference Video phases) ---
      let targetX = 1.15 * xFactor;
      let targetY = isMobile ? 0.14 : 0.05;
      let targetScale = 0.72;
      let targetRotY = BASE_ROT_Y;
      let targetRotX = BASE_ROT_X;
      let targetExplosion = 0.0;
      let targetEmblem = 0.0;

      if (s <= 0.06) {
        // Phase 1 (Hero Landing): Brain on Right side, Lateral sagittal view
        targetX = 1.15 * xFactor;
        targetY = isMobile ? 0.14 : 0.05;
        targetScale = 0.72;
        targetRotY = BASE_ROT_Y;
        targetRotX = BASE_ROT_X;
        targetExplosion = 0.0;
        targetEmblem = 0.0;
      } else if (s <= 0.16) {
        // Transition: Smooth sweep from Right to Left as Section 2 enters
        const u = (s - 0.06) / 0.10;
        const t = u * u * (3 - 2 * u);
        targetX = THREE.MathUtils.lerp(1.15 * xFactor, -1.60 * xFactor, t);
        targetY = THREE.MathUtils.lerp(isMobile ? 0.14 : 0.05, isMobile ? 0.16 : 0.0, t);
        targetScale = THREE.MathUtils.lerp(0.72, 0.75, t);
        targetRotY = THREE.MathUtils.lerp(BASE_ROT_Y, BASE_ROT_Y - 0.35, t);
        targetRotX = THREE.MathUtils.lerp(BASE_ROT_X, 0.12, t);
        targetExplosion = 0.0;
        targetEmblem = 0.0;
      } else if (s <= 0.26) {
        // Phase 2 (Contralateral Certainty): Brain firmly on Left, Section 2 text & cards on Right
        targetX = -1.60 * xFactor;
        targetY = isMobile ? 0.16 : 0.0;
        targetScale = 0.75;
        targetRotY = BASE_ROT_Y - 0.35;
        targetRotX = 0.12;
        targetExplosion = 0.0;
        targetEmblem = 0.0;
      } else if (s <= 0.44) {
        // Phase 3 (Neural Noise Storm): Brain glides to center & radially explodes into cosmic shard constellation
        const u = (s - 0.26) / 0.18;
        const bell = Math.sin(u * Math.PI);
        targetX = THREE.MathUtils.lerp(-1.60 * xFactor, 0.0, bell);
        targetY = 0.0;
        targetScale = THREE.MathUtils.lerp(0.75, 0.78, bell);
        targetRotY = (BASE_ROT_Y - 0.35) + u * 0.45;
        targetRotX = 0.12;
        targetExplosion = bell * 1.45;
        targetEmblem = 0.0;
      } else if (s <= 0.60) {
        // Phase 4 (Re-convergence & CSP): Shards re-converge on Left; C3/C4 motor strip pulses; CSP calibration on Right
        const u = (s - 0.44) / 0.16;
        targetX = -1.60 * xFactor;
        targetY = isMobile ? 0.16 : 0.0;
        targetScale = 0.72;
        targetRotY = (BASE_ROT_Y - 0.35) + 0.45 - u * 0.15;
        targetRotX = 0.08;
        targetExplosion = 0.0;
        targetEmblem = 0.0;
      } else if (s <= 0.85) {
        // Sections 5 & 6 (Clinical Impact & Pipeline): Brain glides gracefully toward center-left
        const u = (s - 0.60) / 0.25;
        const t = u * u * (3 - 2 * u);
        targetX = THREE.MathUtils.lerp(-1.60 * xFactor, -0.3 * xFactor, t);
        targetY = THREE.MathUtils.lerp(0.0, 0.06, t);
        targetScale = THREE.MathUtils.lerp(0.72, 0.76, t);
        targetRotY = THREE.MathUtils.lerp(BASE_ROT_Y + 0.15, BASE_ROT_Y - 0.1, t);
        targetRotX = THREE.MathUtils.lerp(0.08, 0.04, t);
        targetExplosion = 0.0;
        targetEmblem = 0.0;
      } else {
        // Phase 5 (Closing Convergence): Facets morph into central radiant 3D Diamond Emblem with axial spin
        const u = Math.min(1.0, (s - 0.85) / 0.13);
        const t = u * u * (3 - 2 * u);
        targetX = THREE.MathUtils.lerp(-0.3 * xFactor, 0.0, t);
        targetY = THREE.MathUtils.lerp(0.06, 0.0, t);
        targetScale = THREE.MathUtils.lerp(0.76, 0.95, t);
        targetRotY = THREE.MathUtils.lerp(BASE_ROT_Y - 0.1, 0.0, t) + emblemSpinAngle;
        targetRotX = THREE.MathUtils.lerp(0.04, 0.0, t);
        targetExplosion = 0.0;
        targetEmblem = t;
      }

      // Smooth position & scale
      brainGroup.position.x += (targetX - brainGroup.position.x) * 0.14;
      brainGroup.position.y += (targetY - brainGroup.position.y) * 0.14;

      // Breathing pulse & responsive scale
      const finalScale = targetScale * scaleFactor;
      const breathe = finalScale * (1.0 + Math.sin(elapsedTime * 1.6) * 0.012);
      brainGroup.scale.set(breathe, breathe, breathe);

      // Smooth rotation with mouse parallax
      const pRotY = targetRotY + mouse.x * 0.25;
      const pRotX = targetRotX - mouse.y * 0.18;
      brainGroup.rotation.y += (pRotY - brainGroup.rotation.y) * 0.12;
      brainGroup.rotation.x += (pRotX - brainGroup.rotation.x) * 0.12;

      // Smooth morph factors (responsive and snappy)
      currentExplosion += (targetExplosion - currentExplosion) * 0.18;
      currentEmblem += (targetEmblem - currentEmblem) * 0.18;

      // Morph facet vertex positions when explosion or emblem is active
      if (
        facetPositionsAttr &&
        linePositionsAttr &&
        pointPositionsAttr &&
        basePositionsArr &&
        disperseVectorsArr &&
        emblemPositionsArr &&
        centroidsArr
      ) {
        const isMorphing = currentExplosion > 0.001 || targetExplosion > 0.001 || currentEmblem > 0.001 || targetEmblem > 0.001;

        if (isMorphing) {
          wasMorphed = true;
          const pos = facetPositionsAttr.array as Float32Array;
          const linePos = linePositionsAttr.array as Float32Array;
          const ptPos = pointPositionsAttr.array as Float32Array;

          for (let i = 0; i < totalFacetCount; i++) {
            const pIdx = i * 9;
            const lIdx = i * 18;

            const dx = disperseVectorsArr[i * 3] * currentExplosion;
            const dy = disperseVectorsArr[i * 3 + 1] * currentExplosion;
            const dz = disperseVectorsArr[i * 3 + 2] * currentExplosion;

            const embFactor = currentEmblem;
            const baseFactor = 1.0 - embFactor;

            for (let v = 0; v < 3; v++) {
              const vIdx = pIdx + v * 3;
              const morphedX = basePositionsArr[vIdx] * baseFactor + emblemPositionsArr[vIdx] * embFactor + dx;
              const morphedY = basePositionsArr[vIdx + 1] * baseFactor + emblemPositionsArr[vIdx + 1] * embFactor + dy;
              const morphedZ = basePositionsArr[vIdx + 2] * baseFactor + emblemPositionsArr[vIdx + 2] * embFactor + dz;

              pos[vIdx] = morphedX;
              pos[vIdx + 1] = morphedY;
              pos[vIdx + 2] = morphedZ;
            }

            linePos[lIdx] = pos[pIdx];
            linePos[lIdx + 1] = pos[pIdx + 1];
            linePos[lIdx + 2] = pos[pIdx + 2];
            linePos[lIdx + 3] = pos[pIdx + 3];
            linePos[lIdx + 4] = pos[pIdx + 4];
            linePos[lIdx + 5] = pos[pIdx + 5];

            linePos[lIdx + 6] = pos[pIdx + 3];
            linePos[lIdx + 7] = pos[pIdx + 4];
            linePos[lIdx + 8] = pos[pIdx + 5];
            linePos[lIdx + 9] = pos[pIdx + 6];
            linePos[lIdx + 10] = pos[pIdx + 7];
            linePos[lIdx + 11] = pos[pIdx + 8];

            linePos[lIdx + 12] = pos[pIdx + 6];
            linePos[lIdx + 13] = pos[pIdx + 7];
            linePos[lIdx + 14] = pos[pIdx + 8];
            linePos[lIdx + 15] = pos[pIdx];
            linePos[lIdx + 16] = pos[pIdx + 1];
            linePos[lIdx + 17] = pos[pIdx + 2];

            ptPos[i * 3] = centroidsArr[i * 3] * baseFactor + dx;
            ptPos[i * 3 + 1] = centroidsArr[i * 3 + 1] * baseFactor + dy;
            ptPos[i * 3 + 2] = centroidsArr[i * 3 + 2] * baseFactor + dz;
          }

          facetPositionsAttr.needsUpdate = true;
          linePositionsAttr.needsUpdate = true;
          pointPositionsAttr.needsUpdate = true;
        } else if (wasMorphed) {
          // Cleanly restore exact pristine base positions once
          const pos = facetPositionsAttr.array as Float32Array;
          pos.set(basePositionsArr);

          const linePos = linePositionsAttr.array as Float32Array;
          for (let i = 0; i < totalFacetCount; i++) {
            const pIdx = i * 9;
            const lIdx = i * 18;
            linePos[lIdx] = pos[pIdx];
            linePos[lIdx + 1] = pos[pIdx + 1];
            linePos[lIdx + 2] = pos[pIdx + 2];
            linePos[lIdx + 3] = pos[pIdx + 3];
            linePos[lIdx + 4] = pos[pIdx + 4];
            linePos[lIdx + 5] = pos[pIdx + 5];

            linePos[lIdx + 6] = pos[pIdx + 3];
            linePos[lIdx + 7] = pos[pIdx + 4];
            linePos[lIdx + 8] = pos[pIdx + 5];
            linePos[lIdx + 9] = pos[pIdx + 6];
            linePos[lIdx + 10] = pos[pIdx + 7];
            linePos[lIdx + 11] = pos[pIdx + 8];

            linePos[lIdx + 12] = pos[pIdx + 6];
            linePos[lIdx + 13] = pos[pIdx + 7];
            linePos[lIdx + 14] = pos[pIdx + 8];
            linePos[lIdx + 15] = pos[pIdx];
            linePos[lIdx + 16] = pos[pIdx + 1];
            linePos[lIdx + 17] = pos[pIdx + 2];
          }

          const ptPos = pointPositionsAttr.array as Float32Array;
          for (let i = 0; i < totalFacetCount; i++) {
            ptPos[i * 3] = centroidsArr[i * 3];
            ptPos[i * 3 + 1] = centroidsArr[i * 3 + 1];
            ptPos[i * 3 + 2] = centroidsArr[i * 3 + 2];
          }

          facetPositionsAttr.needsUpdate = true;
          linePositionsAttr.needsUpdate = true;
          pointPositionsAttr.needsUpdate = true;
          wasMorphed = false;
        }
      }

      // Ambient shards orbital animation
      ambientShards.forEach((sh) => {
        sh.mesh.rotation.x += sh.rotSpeed.x;
        sh.mesh.rotation.y += sh.rotSpeed.y;
        sh.mesh.rotation.z += sh.rotSpeed.z;

        const yOffset = Math.sin(elapsedTime * 1.2 + sh.phase) * 0.05;
        const xOffset = Math.cos(elapsedTime * 0.8 + sh.phase) * 0.03;

        const parallaxX = mouse.x * sh.depthFactor * 0.15;
        const parallaxY = -mouse.y * sh.depthFactor * 0.12;

        sh.mesh.position.x = sh.basePos.x + xOffset + parallaxX;
        sh.mesh.position.y = sh.basePos.y + yOffset + parallaxY;
        sh.mesh.position.z = sh.basePos.z;
      });

      // Neural wave twinkle & live EEG pulse
      if (facetColorsAttr && baseFacetColors && centroidsArr) {
        const colors = facetColorsAttr.array as Float32Array;
        const wavePhase = (elapsedTime * 1.6) % (Math.PI * 4);

        for (let i = 0; i < totalFacetCount; i++) {
          const cx = centroidsArr[i * 3];
          const cy = centroidsArr[i * 3 + 1];
          const cz = centroidsArr[i * 3 + 2];

          let baseR = baseFacetColors[i * 9];
          let baseG = baseFacetColors[i * 9 + 1];
          let baseB = baseFacetColors[i * 9 + 2];

          // Blend with radiant jewel colors when morphing into Diamond Emblem
          if (currentEmblem > 0.001 && emblemColorsArr) {
            const ef = currentEmblem;
            const bf = 1.0 - ef;
            baseR = baseR * bf + emblemColorsArr[i * 9] * ef;
            baseG = baseG * bf + emblemColorsArr[i * 9 + 1] * ef;
            baseB = baseB * bf + emblemColorsArr[i * 9 + 2] * ef;
          }

          // Three.js coordinates for C3 (left motor) and C4 (right motor)
          const distC3 = Math.hypot(cx - -0.45, cy - 0.0, cz - 0.55);
          const distC4 = Math.hypot(cx - 0.45, cy - 0.0, cz - 0.55);

          let boostR = 0;
          let boostG = 0;
          let boostB = 0;

          if (latestLabel === "left" && distC3 < 0.65) {
            const intensity = Math.max(0, 1 - distC3 / 0.65) * (1.2 + latestConfidence);
            boostR = -0.2 * intensity;
            boostG = 0.5 * intensity;
            boostB = 1.0 * intensity;
          } else if (latestLabel === "right" && distC4 < 0.65) {
            const intensity = Math.max(0, 1 - distC4 / 0.65) * (1.2 + latestConfidence);
            boostR = 1.0 * intensity;
            boostG = 0.6 * intensity;
            boostB = -0.3 * intensity;
          } else {
            const ripple = Math.sin(cz * 2.5 + cy * 1.8 - wavePhase);
            if (ripple > 0.88) {
              const sparkle = (ripple - 0.88) * 2.5;
              boostR = sparkle * 0.3;
              boostG = sparkle * 0.35;
              boostB = sparkle * 0.45;
            }
          }

          const finalR = Math.max(0, Math.min(1, baseR + boostR));
          const finalG = Math.max(0, Math.min(1, baseG + boostG));
          const finalB = Math.max(0, Math.min(1, baseB + boostB));

          for (let v = 0; v < 3; v++) {
            const idx = i * 9 + v * 3;
            colors[idx] = finalR;
            colors[idx + 1] = finalG;
            colors[idx + 2] = finalB;
          }
        }
        facetColorsAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.LineSegments ||
          obj instanceof THREE.Points
        ) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [latestLabel, latestConfidence]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center select-none overflow-hidden ${
        className ?? ""
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 60% 50%, rgba(245, 158, 11, 0.12) 0%, rgba(168, 85, 247, 0.08) 35%, rgba(6, 182, 212, 0.04) 55%, transparent 75%)",
        }}
      />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
            <span className="font-mono text-xs text-amber-400 tracking-widest uppercase">
              Generating Cortical Lattice...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
