import { useMemo } from 'react';

function HealthBar({ value, label, icon, colorStops, active }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const color = useMemo(() => {
    if (!active) return '#3f3f46';
    const stops = colorStops || [
      { threshold: 60, color: '#4ade80' },
      { threshold: 30, color: '#facc15' },
      { threshold: 0,  color: '#ef4444' },
    ];
    for (const stop of stops) {
      if (clampedValue > stop.threshold) return stop.color;
    }
    return stops[stops.length - 1].color;
  }, [clampedValue, active, colorStops]);

  return (
    <div className={`metric-card ${!active ? 'dimmed' : ''}`}>
      <div className="metric-card-header">
        <span className="metric-icon">{icon}</span>
        <span className="metric-card-label">{label}</span>
        <span className="metric-card-value" style={{ color: active ? color : '#6b7280' }}>
          {active ? `${clampedValue.toFixed(1)}%` : '--'}
        </span>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ 
            width: active ? `${clampedValue}%` : '0%',
            backgroundColor: color,
            boxShadow: active ? `0 0 20px ${color}60, 0 0 40px ${color}20` : 'none'
          }}
        >
          {active && <div className="shimmer"></div>}
        </div>
      </div>
    </div>
  );
}

export default HealthBar;
