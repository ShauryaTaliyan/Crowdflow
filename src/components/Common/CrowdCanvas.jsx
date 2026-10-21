import React, { useEffect, useRef } from 'react';

/**
 * CrowdCanvas
 * 
 * Animated Crowd Flow Canvas (Inspiration 1).
 * Renders stylized animated pedestrians moving smoothly through a simulated
 * corridor / venue space with subtle directional vectors and walking cadence.
 * 
 * - Pure HTML5 Canvas implementation (zero external image or GSAP dependencies)
 * - Automatic pause on hidden tab / prefers-reduced-motion
 * - Non-blocking pointer interaction (pedestrians gently steer away from cursor)
 */
export default function CrowdCanvas({
  className = '',
  style = {},
  agentCount = 45,
  accentColor = '#1a73e8',
  secondaryColor = '#38bdf8',
  dimColor = 'rgba(148, 163, 184, 0.45)',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let animationFrameId = null;
    let isVisible = true;
    let lastTime = 0;

    let mouseX = -1000;
    let mouseY = -1000;
    let isHovering = false;

    // Pedestrian particle state
    class Agent {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = initial ? Math.random() * (width || 400) : (Math.random() < 0.5 ? -10 : width + 10);
        this.y = Math.random() * (height || 200);
        const angle = this.x <= 0 ? (Math.random() * 0.8 - 0.4) : (Math.PI + Math.random() * 0.8 - 0.4);
        this.baseSpeed = 0.6 + Math.random() * 0.9;
        this.vx = Math.cos(angle) * this.baseSpeed;
        this.vy = Math.sin(angle) * this.baseSpeed * 0.4;
        this.radius = 2.5 + Math.random() * 1.5;
        this.phase = Math.random() * Math.PI * 2;
        this.strideFreq = 0.12 + Math.random() * 0.06;
        this.colorType = Math.random() < 0.2 ? 'accent' : Math.random() < 0.4 ? 'secondary' : 'dim';
        this.alpha = 0.35 + Math.random() * 0.45;
      }

      update() {
        this.phase += this.strideFreq;

        // Pointer avoidance
        if (isHovering && mouseX >= 0) {
          const dx = this.x - mouseX;
          const dy = this.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist < 75 && dist > 0.1) {
            const force = (1 - dist / 75) * 0.8;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
          }
        }

        // Clamp speed
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 2.5) {
          this.vx = (this.vx / speed) * 2.5;
          this.vy = (this.vy / speed) * 2.5;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Wrap or reset boundaries
        if (this.x < -20 || this.x > width + 20 || this.y < -20 || this.y > height + 20) {
          this.reset(false);
        }
      }

      draw(c) {
        c.save();
        c.translate(this.x, this.y);

        const heading = Math.atan2(this.vy, this.vx);
        c.rotate(heading);

        let fill = dimColor;
        if (this.colorType === 'accent') fill = accentColor;
        else if (this.colorType === 'secondary') fill = secondaryColor;

        c.globalAlpha = this.alpha;
        c.fillStyle = fill;

        // Draw pedestrian body (torso & head)
        c.beginPath();
        c.arc(0, 0, this.radius, 0, Math.PI * 2);
        c.fill();

        // Directional pointer / stride indicator
        c.strokeStyle = fill;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(this.radius + 3, 0);
        c.stroke();

        // Subtle leg stride marks
        const strideOffset = Math.sin(this.phase) * (this.radius * 0.7);
        c.beginPath();
        c.arc(-1, strideOffset, 1, 0, Math.PI * 2);
        c.arc(-1, -strideOffset, 1, 0, Math.PI * 2);
        c.fill();

        c.restore();
      }
    }

    let agents = [];

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

      // Re-init agents
      agents = Array.from({ length: agentCount }, () => new Agent());

      if (prefersReducedMotion) {
        ctx.clearRect(0, 0, width, height);
        agents.forEach(a => a.draw(ctx));
      }
    };

    const draw = (currentTime) => {
      if (!isVisible) return;
      animationFrameId = requestAnimationFrame(draw);

      if (currentTime - lastTime < 1000 / 35) return;
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      // Subtle flow grid guidance lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      agents.forEach(agent => {
        agent.update();
        agent.draw(ctx);
      });
    };

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isHovering = true;
    };

    const onMouseLeave = () => {
      isHovering = false;
      mouseX = -1000;
      mouseY = -1000;
    };

    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('mouseleave', onMouseLeave);

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

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
      container.removeEventListener('mouseleave', onMouseLeave);
      resizeObserver.disconnect();
    };
  }, [agentCount, accentColor, secondaryColor, dimColor]);

  return (
    <div
      ref={containerRef}
      className={`cf-crowd-canvas-container ${className}`}
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
