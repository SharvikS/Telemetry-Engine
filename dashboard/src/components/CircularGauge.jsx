import { useRef, useEffect, useMemo } from 'react';

const SIZE = 140;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularGauge({ value, label, icon, color, active }) {
  const canvasRef = useRef(null);
  const animValueRef = useRef(0);
  const rafRef = useRef(null);

  const clamped = Math.min(100, Math.max(0, value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const startAngle = -Math.PI / 2;

    const draw = () => {
      // Lerp toward target
      const target = active ? clamped : 0;
      animValueRef.current += (target - animValueRef.current) * 0.08;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Background track
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = STROKE;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Progress arc
      const progress = animValueRef.current / 100;
      const endAngle = startAngle + progress * Math.PI * 2;

      if (progress > 0.001) {
        const activeColor = active ? color : '#3f3f46';

        // Glow layer
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS, startAngle, endAngle);
        ctx.strokeStyle = activeColor + '40';
        ctx.lineWidth = STROKE + 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main arc
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS, startAngle, endAngle);
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = STROKE;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Tip dot
        const tipX = cx + RADIUS * Math.cos(endAngle);
        const tipY = cy + RADIUS * Math.sin(endAngle);
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
        ctx.fillStyle = activeColor + '50';
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [clamped, color, active]);

  return (
    <div className={`gauge-card ${!active ? 'dimmed' : ''}`}>
      <div className="gauge-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="gauge-canvas"
          style={{ width: SIZE, height: SIZE }}
        />
        <div className="gauge-center-text">
          <span className="gauge-icon">{icon}</span>
          <span className="gauge-value" style={{ color: active ? color : '#6b7280' }}>
            {active ? Math.round(clamped) : '--'}
          </span>
        </div>
      </div>
      <span className="gauge-label">{label}</span>
    </div>
  );
}

export default CircularGauge;
