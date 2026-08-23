function SystemInfo({ info, active }) {
  if (!info || !active) {
    return (
      <div className="system-info-card dimmed">
        <div className="system-info-header">
          <span className="metric-icon">🖥️</span>
          <span className="metric-card-label">SYSTEM</span>
        </div>
        <div className="system-info-grid">
          <div className="system-info-item">
            <span className="system-info-key">Status</span>
            <span className="system-info-value">Waiting for connection...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="system-info-card">
      <div className="system-info-header">
        <span className="metric-icon">🖥️</span>
        <span className="metric-card-label">SYSTEM</span>
      </div>
      <div className="system-info-grid">
        {info.capture_resolution && (
          <div className="system-info-item">
            <span className="system-info-key">Capture</span>
            <span className="system-info-value">{info.capture_resolution}</span>
          </div>
        )}
        {info.opencv_version && (
          <div className="system-info-item">
            <span className="system-info-key">OpenCV</span>
            <span className="system-info-value">v{info.opencv_version}</span>
          </div>
        )}
        {info.python_version && (
          <div className="system-info-item">
            <span className="system-info-key">Python</span>
            <span className="system-info-value">{info.python_version}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemInfo;
