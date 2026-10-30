import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hero3DCanvas — High-Performance Three.js 3D Background Scene
 * Renders an ethereal, interactive 3D particle lattice and floating geometric data nodes
 * that gracefully respond to cursor movement and scroll position with subtle depth.
 * Automatically pauses when offscreen or tab hidden for zero CPU waste.
 */
export default function Hero3DCanvas() {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 85;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.warn('WebGL not supported for 3D background', e);
      return;
    }

    const isMobile = window.innerWidth < 768;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Interactive 3D Particle Cloud & Data Network
    const particleCount = isMobile ? 110 : 280;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    const brandRed = new THREE.Color('#D91542');
    const brandRose = new THREE.Color('#FB7185');
    const brandLight = new THREE.Color('#CBD5E1');

    for (let i = 0; i < particleCount; i++) {
      // Cylindrical / spherical cloud spread
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 65;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6; // Flatter disk
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.7;

      // Color distribution: 60% neutral light gray/slate, 40% vibrant crimson/rose
      const colorChoice = Math.random();
      let c;
      if (colorChoice > 0.6) {
        c = brandRed;
      } else if (colorChoice > 0.35) {
        c = brandRose;
      } else {
        c = brandLight;
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      scales[i] = Math.random() * 2.5 + 1.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    // Custom circular soft glow sprite material
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(217, 21, 66, 0.4)');
    gradient.addColorStop(1, 'rgba(217, 21, 66, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Floating Geometric Wireframe Ring (Represents Ingestion Loop)
    const ringGeo = new THREE.TorusGeometry(38, 0.3, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd91542,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    const ringGeo2 = new THREE.TorusGeometry(48, 0.2, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 3;
    scene.add(ring2);

    // 4. Mouse movement listener for smooth parallax tilt
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mouseRef.current.targetX = (e.clientX / innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 5. Visibility and resize handlers
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

    // 6. Animation loop with requestAnimationFrame
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isVisibleRef.current) return;

      const elapsedTime = clock.getElapsedTime();

      // Smooth lerp mouse coordinates
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Gentle continuous rotation
      particles.rotation.y = elapsedTime * 0.04 + mouseRef.current.x * 0.25;
      particles.rotation.x = Math.sin(elapsedTime * 0.03) * 0.1 + mouseRef.current.y * 0.2;

      ring.rotation.z = elapsedTime * 0.06;
      ring.rotation.y = elapsedTime * 0.03 + mouseRef.current.x * 0.15;

      ring2.rotation.z = -elapsedTime * 0.04;

      // Subtle camera tilt
      camera.position.x = mouseRef.current.x * 6;
      camera.position.y = mouseRef.current.y * 5;
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
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      texture.dispose();
      if (renderer) renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none -z-10 overflow-hidden"
      style={{ opacity: 0.85 }}
      aria-hidden="true"
    />
  );
}
