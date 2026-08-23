import { useRef, useEffect } from 'react';

const SIZE = 120;

function BrightnessGauge({ brightness, active }) {
  const normalizedBrightness = Math.min(100, Math.max(0, (brightness / 255) * 100));
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const rafRef = useRef(null);

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

    const draw = () => {
      const target = active ? normalizedBrightness : 0;
      animRef.current += (target - animRef.current) * 0.06;

      ctx.clearRect(0, 0, SIZE, SIZE);

      const pct = animRef.current / 100;
      const warm = Math.round(40 + pct * 20); // 40-60 hue range (warm amber)
      const lum = Math.round(15 + pct * 55); // 15-70% lightness

      // Outer ring background
      ctx.beginPath();
      ctx.arc(cx, cy, 48, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Center fill glow
      if (active && pct > 0.01) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42);
        grd.addColorStop(0, `hsla(${warm}, 90%, ${lum}%, 0.15)`);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Sun rays
      if (active && pct > 0.05) {
        const rayCount = 12;
        const innerR = 24;
        const outerR = 32 + pct * 8;
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
          ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          ctx.strokeStyle = `hsla(${warm}, 80%, ${lum + 10}%, ${0.15 + pct * 0.25})`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = active ? `hsla(${warm}, 85%, ${lum}%, ${0.3 + pct * 0.5})` : 'rgba(255,255,255,0.04)';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [normalizedBrightness, active]);

  return (
    <div className={`brightness-card ${!active ? 'dimmed' : ''}`}>
      <div className="brightness-header">
        <span className="metric-icon">☀️</span>
        <span className="metric-card-label">SCENE BRIGHTNESS</span>
      </div>
      <div className="brightness-body">
        <canvas
          ref={canvasRef}
          className="brightness-canvas"
          style={{ width: SIZE, height: SIZE }}
        />
        <div className="brightness-value-wrap">
          <span className="brightness-value" style={{ color: active ? '#fbbf24' : '#6b7280' }}>
            {active ? `${normalizedBrightness.toFixed(0)}%` : '--'}
          </span>
          <span className="brightness-desc">
            {active
              ? normalizedBrightness > 70 ? 'Bright Scene' : normalizedBrightness > 30 ? 'Normal' : 'Dark Scene'
              : 'No Data'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default BrightnessGauge;
