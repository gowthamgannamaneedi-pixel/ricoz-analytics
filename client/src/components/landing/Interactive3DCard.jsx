import React, { useRef, useState, useEffect } from 'react';

/**
 * Interactive3DCard — Next-Gen Physics-Driven 3D Interactive Card
 * Features:
 * - Real-time mouse tilt with realistic perspective transform
 * - Dynamic specular glare/sheen overlay tracking cursor coordinates
 * - Multi-layer 3D depth (children with translateZ pop out into z-space)
 * - Dynamic opposing shadow casting (shadow moves relative to light source)
 * - Spring recovery when cursor leaves
 * - High performance: uses CSS variables & requestAnimationFrame
 */
export default function Interactive3DCard({
  children,
  className = '',
  maxTilt = 10,
  scale = 1.02,
  glare = true,
  elevation = true,
  overflowHidden = true,
  onClick,
  style = {},
  ...props
}) {
  const cardRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafId = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const handleMouseMove = (e) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = (x / rect.width) * 2 - 1; // -1 to 1
    const normY = (y / rect.height) * 2 - 1; // -1 to 1

    if (rafId.current) cancelAnimationFrame(rafId.current);

    rafId.current = requestAnimationFrame(() => {
      // Invert Y for standard natural rotateX
      const rotateX = -normY * maxTilt;
      const rotateY = normX * maxTilt;

      setTilt({ x: rotateX, y: rotateY });
      setGlarePos({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: 0.16,
      });
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    // Smooth return to resting state
    setTilt({ x: 0, y: 0 });
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const transformStyle = reducedMotion
    ? 'none'
    : isHovered
      ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

  // Opposing light shadow
  const shadowStyle = isHovered && elevation
    ? `${-tilt.y * 1.5}px ${tilt.x * 1.5 + 20}px 35px -10px rgba(0, 0, 0, 0.18)`
    : undefined;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: transformStyle,
        boxShadow: shadowStyle,
        transformStyle: 'preserve-3d',
        transition: isHovered
          ? 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease'
          : 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.55s ease',
        willChange: 'transform',
        ...style,
      }}
      className={`relative ${overflowHidden ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
      {...props}
    >
      {/* Specular Glare / Reflection Layer */}
      {glare && (
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 rounded-[inherit] overflow-hidden"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.35), transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Card Content (renders with 3D preservation) */}
      <div className="relative z-10 w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </div>
  );
}
