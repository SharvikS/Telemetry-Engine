import { useEffect, useRef, useCallback } from 'react';

const MAX_POINTS = 60;

function SparklineGraph({ data, color, label, unit, active }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = 80;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (!active || data.length < 2) {
      // Dashed center line for empty state
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Grid lines
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      return;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 6;

    const points = data.map((val, i) => ({
      x: (i / (MAX_POINTS - 1)) * width,
      y: padding + ((1 - (val - min) / range) * (height - padding * 2)),
    }));

    // Subtle grid lines
    ctx.setLineDash([]);
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '25');
    gradient.addColorStop(0.7, color + '08');
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Main line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot with pulse ring
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = color + '20';
    ctx.fill();

    // Min/Max markers
    let minIdx = 0, maxIdx = 0;
    data.forEach((v, i) => {
      if (v < data[minIdx]) minIdx = i;
      if (v > data[maxIdx]) maxIdx = i;
    });

    if (range > 0.5 && data.length > 5) {
      // Max marker
      const maxPt = points[maxIdx];
      if (maxPt) {
        ctx.beginPath();
        ctx.arc(maxPt.x, maxPt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
      }
      // Min marker
      const minPt = points[minIdx];
      if (minPt) {
        ctx.beginPath();
        ctx.arc(minPt.x, minPt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
      }
    }
  }, [data, color, active]);

  useEffect(() => {
    draw();

    const observer = new ResizeObserver(() => draw());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  const currentValue = data.length > 0 ? data[data.length - 1] : null;
  const minValue = data.length > 0 ? Math.min(...data) : null;
  const maxValue = data.length > 0 ? Math.max(...data) : null;

  return (
    <div className={`sparkline-card ${!active ? 'dimmed' : ''}`}>
      <div className="sparkline-header">
        <span className="sparkline-label">{label}</span>
        <div className="sparkline-meta">
          {active && minValue !== null && (
            <span className="sparkline-range">
              {minValue.toFixed(0)}–{maxValue.toFixed(0)}
            </span>
          )}
          <span className="sparkline-value" style={{ color: active ? color : '#6b7280' }}>
            {active && currentValue !== null ? `${currentValue.toFixed(1)}${unit}` : '--'}
          </span>
        </div>
      </div>
      <div className="sparkline-canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} className="sparkline-canvas" />
      </div>
    </div>
  );
}

export default SparklineGraph;
