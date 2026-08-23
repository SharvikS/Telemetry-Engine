import { useState, useEffect, useRef, useMemo } from 'react';

const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 80;
const MAX_POINTS = 60;

function SparklineGraph({ data, color, label, unit, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GRAPH_WIDTH * dpr;
    canvas.height = GRAPH_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);

    if (!active || data.length < 2) {
      // Draw empty state
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, GRAPH_HEIGHT / 2);
      ctx.lineTo(GRAPH_WIDTH, GRAPH_HEIGHT / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;

    const points = data.map((val, i) => ({
      x: (i / (MAX_POINTS - 1)) * GRAPH_WIDTH,
      y: padding + ((1 - (val - min) / range) * (GRAPH_HEIGHT - padding * 2)),
    }));

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, GRAPH_HEIGHT);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.moveTo(points[0].x, GRAPH_HEIGHT);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, GRAPH_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
      ctx.quadraticCurveTo(cpx + (curr.x - cpx) * 0.5, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw end dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color + '30';
    ctx.fill();

  }, [data, color, active]);

  const currentValue = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className={`sparkline-card ${!active ? 'dimmed' : ''}`}>
      <div className="sparkline-header">
        <span className="sparkline-label">{label}</span>
        <span className="sparkline-value" style={{ color: active ? color : '#6b7280' }}>
          {active && currentValue !== null ? `${currentValue.toFixed(1)}${unit}` : '--'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="sparkline-canvas"
        style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
      />
    </div>
  );
}

export default SparklineGraph;
