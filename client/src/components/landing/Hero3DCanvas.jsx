import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hero3DCanvas — Architectural 3D Spatial Canvas for RicozAnalytics
 * Renders an enterprise spatial telemetry field with crisp data nodes,
 * connecting constellation vectors, and subtle cursor-responsive depth.
 * Minimal, sophisticated, and zero CPU waste (pauses via IntersectionObserver).
 */
export default function Hero3DCanvas() {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Accessibility: respects reduced-motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // 1. Scene, Camera, WebGL Renderer with graceful fallback
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 80;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.warn('WebGL context not available for 3D background', e);
      return;
    }

    const isMobile = window.innerWidth < 768;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Data Nodes (Precise Vector Points)
    const nodeCount = isMobile ? 80 : 160;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodeCount * 3);
    const colors = new Float32Array(nodeCount * 3);

    const neutralSlate = new THREE.Color('#94A3B8'); // Subtle slate
    const accentCrimson = new THREE.Color('#DC2626'); // Refined brand accent
    const faintSlate = new THREE.Color('#CBD5E1');

    for (let i = 0; i < nodeCount; i++) {
      const radius = 20 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.75;

      positions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(phi) * 0.65;
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi) * 0.7;

      // 85% quiet architectural slate, 15% focal crimson
      const c = Math.random() > 0.85 ? accentCrimson : (Math.random() > 0.5 ? neutralSlate : faintSlate);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Sharp circular node shader
    const pointMaterial = new THREE.PointsMaterial({
      size: isMobile ? 2.0 : 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    const nodeCloud = new THREE.Points(geometry, pointMaterial);
    scene.add(nodeCloud);

    // 3. Subtle Architectural Connection Lines (Constellation Network)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x94A3B8,
      transparent: true,
      opacity: 0.12,
    });

    const linePositions = [];
    const maxDistance = 18;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDistance) {
          linePositions.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          );
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // 4. Subtle Orbital Trajectory Ring
    const orbitGeo = new THREE.RingGeometry(38, 38.3, 80);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0xDC2626,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
    });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI / 2.3;
    scene.add(orbit);

    // 5. Cursor Parallax
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mouseRef.current.targetX = (e.clientX / innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 6. Resize & Visibility
    const handleResize = () => {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(container);

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Render Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisibleRef.current) return;

      const elapsedTime = clock.getElapsedTime();

      // Smooth coordinate interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      // Restrained architectural rotation
      nodeCloud.rotation.y = elapsedTime * 0.02 + mouseRef.current.x * 0.15;
      nodeCloud.rotation.x = Math.sin(elapsedTime * 0.02) * 0.05 + mouseRef.current.y * 0.1;

      lines.rotation.y = nodeCloud.rotation.y;
      lines.rotation.x = nodeCloud.rotation.x;

      orbit.rotation.z = elapsedTime * 0.03;

      camera.position.x = mouseRef.current.x * 4;
      camera.position.y = mouseRef.current.y * 3.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      cancelAnimationFrame(animId);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      pointMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
      if (renderer) renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none -z-10 overflow-hidden"
      style={{ opacity: 0.7 }}
      aria-hidden="true"
    />
  );
}
