function PipelineStatus({ isConnected, receivingData, systemInfo }) {
  const stages = [
    {
      id: 'capture',
      label: 'CAPTURE',
      tech: 'Rust',
      icon: '🦀',
      status: receivingData ? 'active' : 'waiting',
      detail: systemInfo?.capture_resolution || '--',
    },
    {
      id: 'inference',
      label: 'INFERENCE',
      tech: 'Python',
      icon: '🐍',
      status: receivingData ? 'active' : 'waiting',
      detail: systemInfo ? `OpenCV ${systemInfo.opencv_version}` : '--',
    },
    {
      id: 'relay',
      label: 'RELAY',
      tech: 'Node.js',
      icon: '🟢',
      status: isConnected ? 'active' : 'offline',
      detail: isConnected ? 'Port 4000' : 'Offline',
    },
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      tech: 'React',
      icon: '⚛️',
      status: 'active',
      detail: 'Vite + React',
    },
  ];

  return (
    <div className="pipeline-card">
      <div className="pipeline-header">
        <span className="metric-icon">🔗</span>
        <span className="metric-card-label">PIPELINE STATUS</span>
      </div>
      <div className="pipeline-stages">
        {stages.map((stage, i) => (
          <div key={stage.id} className="pipeline-stage-wrap">
            <div className={`pipeline-stage ${stage.status}`}>
              <div className="pipeline-stage-icon">{stage.icon}</div>
              <div className="pipeline-stage-info">
                <span className="pipeline-stage-label">{stage.label}</span>
                <span className="pipeline-stage-tech">{stage.tech}</span>
              </div>
              <div className={`pipeline-stage-dot ${stage.status}`}></div>
            </div>
            {i < stages.length - 1 && (
              <div className={`pipeline-connector ${stage.status === 'active' && stages[i + 1].status === 'active' ? 'active' : ''}`}>
                <div className="pipeline-arrow">→</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PipelineStatus;
