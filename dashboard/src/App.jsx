import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import HealthBar from './components/HealthBar';
import CircularGauge from './components/CircularGauge';
import SparklineGraph from './components/SparklineGraph';
import StatsRow from './components/StatsRow';
import SystemInfo from './components/SystemInfo';
import EventLog from './components/EventLog';
import PipelineStatus from './components/PipelineStatus';
import BrightnessGauge from './components/BrightnessGauge';
import './index.css';

const socket = io('http://localhost:4000');
const MAX_HISTORY = 60;
const MAX_EVENTS = 50;

function App() {
  // Telemetry state
  const [health, setHealth] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [mana, setMana] = useState(100);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [latency, setLatency] = useState(0);

  // History for sparklines
  const [healthHistory, setHealthHistory] = useState([]);
  const [staminaHistory, setStaminaHistory] = useState([]);
  const [manaHistory, setManaHistory] = useState([]);
  const [fpsHistory, setFpsHistory] = useState([]);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [receivingData, setReceivingData] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [systemInfo, setSystemInfo] = useState(null);

  // Session stats (peak values)
  const [peakFps, setPeakFps] = useState(0);
  const [minHealth, setMinHealth] = useState(100);
  const [totalFrames, setTotalFrames] = useState(0);

  // Event log
  const [events, setEvents] = useState([]);

  // Uptime tracker
  const [uptime, setUptime] = useState(0);
  const uptimeStart = useRef(null);
  const timeoutRef = useRef(null);
  const lastHealthRef = useRef(100);

  const addEvent = useCallback((type, icon, message) => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    setEvents(prev => [{ type, icon, message, time }, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const pushHistory = useCallback((setter, value) => {
    setter(prev => [...prev, value].slice(-MAX_HISTORY));
  }, []);

  // Uptime counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (uptimeStart.current) {
        setUptime(Math.floor((Date.now() - uptimeStart.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      uptimeStart.current = Date.now();
      addEvent('success', '🟢', 'Connected to Node Relay');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setReceivingData(false);
      uptimeStart.current = null;
      setUptime(0);
      addEvent('error', '🔴', 'Disconnected from Node Relay');
    });

    socket.on('telemetry_update', (data) => {
      if (!data) return;

      // Calculate latency from server timestamp
      if (data.server_timestamp) {
        setLatency(Date.now() - data.server_timestamp);
      }

      if (typeof data.health === 'number') {
        const h = Math.min(100, Math.max(0, data.health));
        setHealth(h);
        pushHistory(setHealthHistory, h);
        setMinHealth(prev => Math.min(prev, h));

        // Health warning events
        const prev = lastHealthRef.current;
        if (h < 15 && prev >= 15) {
          addEvent('danger', '💀', `CRITICAL HEALTH: ${h.toFixed(1)}%`);
        } else if (h < 30 && prev >= 30) {
          addEvent('warning', '⚠️', `Low health warning: ${h.toFixed(1)}%`);
        } else if (h > 80 && prev <= 80) {
          addEvent('success', '💚', `Health recovered: ${h.toFixed(1)}%`);
        }
        lastHealthRef.current = h;
      }
      if (typeof data.stamina === 'number') {
        const s = Math.min(100, Math.max(0, data.stamina));
        setStamina(s);
        pushHistory(setStaminaHistory, s);
      }
      if (typeof data.mana === 'number') {
        const m = Math.min(100, Math.max(0, data.mana));
        setMana(m);
        pushHistory(setManaHistory, m);
      }
      if (typeof data.fps === 'number') {
        setFps(data.fps);
        pushHistory(setFpsHistory, data.fps);
        setPeakFps(prev => Math.max(prev, data.fps));
      }
      if (typeof data.frame_count === 'number') {
        setFrameCount(data.frame_count);
        setTotalFrames(prev => Math.max(prev, data.frame_count));
      }
      if (typeof data.brightness === 'number') {
        setBrightness(data.brightness);
      }

      setReceivingData(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setReceivingData(false);
        addEvent('warning', '⚠️', 'Data stream interrupted');
      }, 2000);
    });

    // Backward compat
    socket.on('health_update', (data) => {
      if (data && typeof data.health === 'number') {
        const h = Math.min(100, Math.max(0, data.health));
        setHealth(h);
        pushHistory(setHealthHistory, h);
        setReceivingData(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setReceivingData(false), 2000);
      }
    });

    socket.on('system_info', (data) => {
      setSystemInfo(data);
      addEvent('info', '🖥️', `System: ${data.capture_resolution || 'unknown'} | OpenCV ${data.opencv_version || '?'}`);
    });

    socket.on('client_count', (data) => {
      if (data && typeof data.count === 'number') {
        setClientCount(data.count);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('telemetry_update');
      socket.off('health_update');
      socket.off('system_info');
      socket.off('client_count');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [addEvent, pushHistory]);

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
      {/* Animated background particles */}
      <div className="bg-particles">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
        <div className="particle p5"></div>
      </div>

      {/* Grid noise overlay */}
      <div className="grid-overlay"></div>

      {/* Main header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-mark">
            <span className="logo-diamond">◆</span>
          </div>
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

      {/* Stats Row */}
      <StatsRow
        fps={fps}
        frameCount={frameCount}
        brightness={brightness}
        clientCount={clientCount}
        active={receivingData}
      />

      {/* Circular Gauges Row */}
      <section className="gauges-section">
        <CircularGauge value={health} label="HEALTH" icon="❤️" color="#4ade80" active={receivingData} />
        <CircularGauge value={stamina} label="STAMINA" icon="⚡" color="#34d399" active={receivingData} />
        <CircularGauge value={mana} label="MANA" icon="💎" color="#60a5fa" active={receivingData} />
        <BrightnessGauge brightness={brightness} active={receivingData} />
      </section>

      {/* Health Bars Section */}
      <section className="bars-section">
        <HealthBar
          value={health}
          label="HEALTH"
          icon="❤️"
          active={receivingData}
          colorStops={[
            { threshold: 60, color: '#4ade80' },
            { threshold: 30, color: '#facc15' },
            { threshold: 0, color: '#ef4444' },
          ]}
        />
        <HealthBar
          value={stamina}
          label="STAMINA"
          icon="⚡"
          active={receivingData}
          colorStops={[
            { threshold: 50, color: '#34d399' },
            { threshold: 25, color: '#a3e635' },
            { threshold: 0, color: '#84cc16' },
          ]}
        />
        <HealthBar
          value={mana}
          label="MANA"
          icon="💎"
          active={receivingData}
          colorStops={[
            { threshold: 50, color: '#60a5fa' },
            { threshold: 25, color: '#818cf8' },
            { threshold: 0, color: '#a78bfa' },
          ]}
        />
      </section>

      {/* Sparkline Graphs */}
      <section className="graphs-section">
        <SparklineGraph data={healthHistory} color="#4ade80" label="HEALTH TREND" unit="%" active={receivingData} />
        <SparklineGraph data={fpsHistory} color="#a78bfa" label="FPS TREND" unit="" active={receivingData} />
        <SparklineGraph data={staminaHistory} color="#34d399" label="STAMINA TREND" unit="%" active={receivingData} />
        <SparklineGraph data={manaHistory} color="#60a5fa" label="MANA TREND" unit="%" active={receivingData} />
      </section>

      {/* Pipeline + Session Stats Row */}
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

      {/* Bottom Info Row */}
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
