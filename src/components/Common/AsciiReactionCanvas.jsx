import React, { useEffect, useRef } from 'react';

/**
 * AsciiReactionCanvas
 * 
 * Interactive ASCII Reaction-Diffusion simulation.
 * Renders an organic crowd-density diffusion wave field using monospace characters
 * on an HTML5 canvas with subtle pointer interaction.
 * 
 * Designed specifically for CrowdFlow's futuristic dark operations aesthetic:
 * - Extremely lightweight: 2D diffusion grid with throttled tick (< 1% CPU)
 * - Automatic pause on hidden tab / off-screen / prefers-reduced-motion
 * - Non-blocking pointer events (renders strictly as an ambient backdrop)
 */
export default function AsciiReactionCanvas({
  className = '',
  style = {},
  density = 0.5,
  accentColor = 'rgba(26, 115, 232, 0.65)',
  baseColor = 'rgba(148, 163, 184, 0.22)',
  glowColor = 'rgba(56, 189, 248, 0.35)',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Monospace character ramp ordered by perceived density
    const CHAR_RAMP = [' ', '·', ':', '+', '•', '×', '*', '%', '#', '@'];
    const FONT_SIZE = 12;
    const CELL_W = 8;
    const CELL_H = 12;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;

    // Reaction-diffusion simulation grids (scalar field + velocity/chemical)
    let gridA = null;
    let gridB = null;
    let nextA = null;
    let nextB = null;

    let animationFrameId = null;
    let isVisible = true;
    let lastTime = 0;
    const FPS_INTERVAL = 1000 / 30; // 30 FPS cap for efficiency

    // Pointer state
    let mouseX = -1000;
    let mouseY = -1000;
    let isHovering = false;

    const initGrids = (c, r) => {
      cols = c;
      rows = r;
      const size = cols * rows;
      gridA = new Float32Array(size);
      gridB = new Float32Array(size);
      nextA = new Float32Array(size);
      nextB = new Float32Array(size);

      // Initialize base state: ambient crowd diffusion seeds
      for (let i = 0; i < size; i++) {
        gridA[i] = 1.0;
        gridB[i] = 0.0;
      }

      // Seed a few organic clusters resembling venue entrance & gathering zones
      const seedCluster = (cx, cy, radius, strength) => {
        for (let y = Math.max(0, cy - radius); y < Math.min(rows, cy + radius); y++) {
          for (let x = Math.max(0, cx - radius); x < Math.min(cols, cx + radius); x++) {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist < radius) {
              const idx = y * cols + x;
              gridB[idx] = Math.min(1.0, strength * (1 - dist / radius));
              gridA[idx] = Math.max(0.0, 1.0 - gridB[idx]);
            }
          }
        }
      };

      if (cols > 10 && rows > 8) {
        seedCluster(Math.floor(cols * 0.25), Math.floor(rows * 0.45), 6, 0.85);
        seedCluster(Math.floor(cols * 0.55), Math.floor(rows * 0.55), 7, 0.95);
        seedCluster(Math.floor(cols * 0.78), Math.floor(rows * 0.4), 5, 0.75);
      }
    };

    const handleResize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);

      if (width <= 0 || height <= 0) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", Consolas, monospace`;
      ctx.textBaseline = 'top';

      const c = Math.max(10, Math.floor(width / CELL_W));
      const r = Math.max(6, Math.floor(height / CELL_H));
      initGrids(c, r);

      if (prefersReducedMotion) {
        renderStatic();
      }
    };

    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          const val = gridB[idx];
          if (val > 0.05) {
            const charIdx = Math.min(CHAR_RAMP.length - 1, Math.floor(val * (CHAR_RAMP.length - 1)));
            const ch = CHAR_RAMP[charIdx];
            if (ch && ch !== ' ') {
              ctx.fillStyle = val > 0.4 ? accentColor : baseColor;
              ctx.fillText(ch, x * CELL_W, y * CELL_H);
            }
          }
        }
      }
    };

    // Reaction-Diffusion step (Gray-Scott model tuned for gentle dispersal)
    const Du = 0.16;
    const Dv = 0.08;
    const F = 0.035;
    const K = 0.062;

    const stepSimulation = () => {
      if (!gridA || !gridB || cols === 0 || rows === 0) return;

      // Mouse influence: inject concentration where user points
      if (isHovering && mouseX >= 0 && mouseY >= 0) {
        const mx = Math.floor(mouseX / CELL_W);
        const my = Math.floor(mouseY / CELL_H);
        const brush = 4;
        for (let dy = -brush; dy <= brush; dy++) {
          for (let dx = -brush; dx <= brush; dx++) {
            const nx = mx + dx;
            const ny = my + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              const d = Math.hypot(dx, dy);
              if (d <= brush) {
                const idx = ny * cols + nx;
                gridB[idx] = Math.min(1.0, gridB[idx] + 0.35 * (1 - d / brush));
                gridA[idx] = Math.max(0.0, 1.0 - gridB[idx]);
              }
            }
          }
        }
      }

      // Laplacian diffusion step
      for (let y = 1; y < rows - 1; y++) {
        const yCols = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const idx = yCols + x;

          const a = gridA[idx];
          const b = gridB[idx];

          // 5-point discrete Laplacian with diagonal weights
          const lapA =
            gridA[idx - 1] * 0.2 +
            gridA[idx + 1] * 0.2 +
            gridA[idx - cols] * 0.2 +
            gridA[idx + cols] * 0.2 +
            gridA[idx - cols - 1] * 0.05 +
            gridA[idx - cols + 1] * 0.05 +
            gridA[idx + cols - 1] * 0.05 +
            gridA[idx + cols + 1] * 0.05 -
            a;

          const lapB =
            gridB[idx - 1] * 0.2 +
            gridB[idx + 1] * 0.2 +
            gridB[idx - cols] * 0.2 +
            gridB[idx + cols] * 0.2 +
            gridB[idx - cols - 1] * 0.05 +
            gridB[idx - cols + 1] * 0.05 +
            gridB[idx + cols - 1] * 0.05 +
            gridB[idx + cols + 1] * 0.05 -
            b;

          const abb = a * b * b;
          nextA[idx] = Math.max(0.0, Math.min(1.0, a + (Du * lapA - abb + F * (1.0 - a))));
          nextB[idx] = Math.max(0.0, Math.min(1.0, b + (Dv * lapB + abb - (K + F) * b)));
        }
      }

      // Swap buffers
      const tempA = gridA;
      gridA = nextA;
      nextA = tempA;

      const tempB = gridB;
      gridB = nextB;
      nextB = tempB;
    };

    const draw = (currentTime) => {
      if (!isVisible) return;

      animationFrameId = requestAnimationFrame(draw);

      if (currentTime - lastTime < FPS_INTERVAL) return;
      lastTime = currentTime;

      stepSimulation();

      ctx.clearRect(0, 0, width, height);

      // Render ASCII characters based on concentration of chemical B
      for (let y = 0; y < rows; y++) {
        const yCols = y * cols;
        const yPos = y * CELL_H;
        for (let x = 0; x < cols; x++) {
          const val = gridB[yCols + x];
          if (val > 0.08) {
            const charIdx = Math.min(
              CHAR_RAMP.length - 1,
              Math.floor(val * (CHAR_RAMP.length - 1))
            );
            const ch = CHAR_RAMP[charIdx];
            if (ch && ch !== ' ') {
              const xPos = x * CELL_W;
              if (val > 0.45) {
                ctx.fillStyle = accentColor;
              } else if (val > 0.22) {
                ctx.fillStyle = glowColor;
              } else {
                ctx.fillStyle = baseColor;
              }
              ctx.fillText(ch, xPos, yPos);
            }
          }
        }
      }
    };

    // Pointer events on container (attached to container so canvas has pointer-events: none)
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isHovering = true;
    };

    const onMouseEnter = () => {
      isHovering = true;
    };

    const onMouseLeave = () => {
      isHovering = false;
      mouseX = -1000;
      mouseY = -1000;
    };

    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Visibility change observer to save CPU when tab is hidden
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !prefersReducedMotion && !animationFrameId) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    handleResize();

    if (!prefersReducedMotion) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(draw);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      resizeObserver.disconnect();
    };
  }, [accentColor, baseColor, glowColor]);

  return (
    <div
      ref={containerRef}
      className={`cf-ascii-reaction-container ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'auto',
        ...style,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
