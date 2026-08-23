function StatsRow({ fps, frameCount, brightness, clientCount, active }) {
  const stats = [
    { label: 'FPS', value: active ? `${fps.toFixed(0)}` : '--', icon: '⚡', color: '#a78bfa' },
    { label: 'FRAMES', value: active ? frameCount.toLocaleString() : '--', icon: '🎞️', color: '#60a5fa' },
    { label: 'BRIGHTNESS', value: active ? `${brightness.toFixed(0)}%` : '--', icon: '☀️', color: '#fbbf24' },
    { label: 'CLIENTS', value: clientCount > 0 ? clientCount : '--', icon: '👥', color: '#34d399' },
  ];

  return (
    <div className={`stats-row ${!active ? 'dimmed' : ''}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="stat-chip">
          <span className="stat-icon">{stat.icon}</span>
          <div className="stat-content">
            <span className="stat-value" style={{ color: active ? stat.color : '#6b7280' }}>
              {stat.value}
            </span>
            <span className="stat-label">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsRow;
