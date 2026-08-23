import useSocket from './hooks/useSocket';
import HealthBar from './components/HealthBar';
import CircularGauge from './components/CircularGauge';
import SparklineGraph from './components/SparklineGraph';
import StatsRow from './components/StatsRow';
import SystemInfo from './components/SystemInfo';
import EventLog from './components/EventLog';
import PipelineStatus from './components/PipelineStatus';
import BrightnessGauge from './components/BrightnessGauge';
import './index.css';

function App() {
  const {
    health, stamina, mana, fps, frameCount, brightness, latency,
    healthHistory, staminaHistory, manaHistory, fpsHistory,
    isConnected, receivingData, clientCount, systemInfo,
    peakFps, minHealth, totalFrames,
    events, uptime,
  } = useSocket();

  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  return (
    <div className="dashboard-container">
      {/* Animated background */}
      <div className="bg-particles">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
        <div className="particle p5"></div>
      </div>
      <div className="grid-overlay"></div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-mark"><span className="logo-diamond">◆</span></div>
          <div className="header-title-group">
            <h1 className="title">TELEMETRY ENGINE</h1>
            <span className="subtitle">Real-Time Gaming Analytics</span>
          </div>
          <span className="version-badge">v1.1</span>
        </div>
        <div className="header-right">
          {isConnected && latency > 0 && (
            <div className="latency-badge">
              <span className="latency-dot"></span>
              <span>{latency}ms</span>
            </div>
          )}
          {isConnected && (
            <div className="uptime-badge">
              <span className="uptime-icon">⏱</span>
              <span>{formatUptime(uptime)}</span>
            </div>
          )}
          <div className="status-indicator">
            <div className={`status-dot ${isConnected ? (receivingData ? 'connected' : 'idle') : 'disconnected'}`}></div>
            <span className="status-text">
              {!isConnected ? 'OFFLINE' : (!receivingData ? 'AWAITING DATA' : 'LIVE')}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <StatsRow fps={fps} frameCount={frameCount} brightness={brightness} clientCount={clientCount} active={receivingData} />

      {/* Circular Gauges */}
      <section className="gauges-section">
        <CircularGauge value={health} label="HEALTH" icon="❤️" color="#4ade80" active={receivingData} />
        <CircularGauge value={stamina} label="STAMINA" icon="⚡" color="#34d399" active={receivingData} />
        <CircularGauge value={mana} label="MANA" icon="💎" color="#60a5fa" active={receivingData} />
        <BrightnessGauge brightness={brightness} active={receivingData} />
      </section>

      {/* Health Bars */}
      <section className="bars-section">
        <HealthBar value={health} label="HEALTH" icon="❤️" active={receivingData}
          colorStops={[{ threshold: 60, color: '#4ade80' }, { threshold: 30, color: '#facc15' }, { threshold: 0, color: '#ef4444' }]} />
        <HealthBar value={stamina} label="STAMINA" icon="⚡" active={receivingData}
          colorStops={[{ threshold: 50, color: '#34d399' }, { threshold: 25, color: '#a3e635' }, { threshold: 0, color: '#84cc16' }]} />
        <HealthBar value={mana} label="MANA" icon="💎" active={receivingData}
          colorStops={[{ threshold: 50, color: '#60a5fa' }, { threshold: 25, color: '#818cf8' }, { threshold: 0, color: '#a78bfa' }]} />
      </section>

      {/* Sparkline Graphs */}
      <section className="graphs-section">
        <SparklineGraph data={healthHistory} color="#4ade80" label="HEALTH TREND" unit="%" active={receivingData} />
        <SparklineGraph data={fpsHistory} color="#a78bfa" label="FPS TREND" unit="" active={receivingData} />
        <SparklineGraph data={staminaHistory} color="#34d399" label="STAMINA TREND" unit="%" active={receivingData} />
        <SparklineGraph data={manaHistory} color="#60a5fa" label="MANA TREND" unit="%" active={receivingData} />
      </section>

      {/* Pipeline + Session */}
      <section className="pipeline-section">
        <PipelineStatus isConnected={isConnected} receivingData={receivingData} systemInfo={systemInfo} />
        <div className="session-stats-card">
          <div className="session-header">
            <span className="metric-icon">📈</span>
            <span className="metric-card-label">SESSION STATS</span>
          </div>
          <div className="session-grid">
            <div className="session-item">
              <span className="session-key">Peak FPS</span>
              <span className="session-val" style={{ color: '#a78bfa' }}>{receivingData ? peakFps.toFixed(0) : '--'}</span>
            </div>
            <div className="session-item">
              <span className="session-key">Min Health</span>
              <span className="session-val" style={{ color: '#ef4444' }}>{receivingData ? `${minHealth.toFixed(1)}%` : '--'}</span>
            </div>
            <div className="session-item">
              <span className="session-key">Total Frames</span>
              <span className="session-val" style={{ color: '#60a5fa' }}>{receivingData ? totalFrames.toLocaleString() : '--'}</span>
            </div>
            <div className="session-item">
              <span className="session-key">Latency</span>
              <span className="session-val" style={{ color: latency < 50 ? '#4ade80' : latency < 100 ? '#facc15' : '#ef4444' }}>
                {isConnected && latency > 0 ? `${latency}ms` : '--'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* System Info + Event Log */}
      <section className="info-section">
        <SystemInfo info={systemInfo} active={isConnected} />
        <EventLog events={events} active={isConnected} />
      </section>

      {/* Footer */}
      <footer className="dashboard-footer">
        <span className="footer-logo">◆</span>
        <span>Telemetry Engine © {new Date().getFullYear()}</span>
        <span className="footer-dot">·</span>
        <span>Rust + Python + Node + React</span>
      </footer>
    </div>
  );
}

export default App;
