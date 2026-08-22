import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './index.css';

const socket = io('http://localhost:4000');

function App() {
  const [health, setHealth] = useState(100);
  const [isConnected, setIsConnected] = useState(false);
  const [receivingData, setReceivingData] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setReceivingData(false);
    });
    
    socket.on('health_update', (data) => {
      if (data && typeof data.health === 'number') {
        setHealth(Math.min(100, Math.max(0, data.health)));
        setReceivingData(true);
        
        // Reset the timeout whenever we receive data
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setReceivingData(false);
        }, 1500); // 1.5 seconds without data = offline
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('health_update');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getHealthColor = () => {
    if (!receivingData) return '#9ca3af'; // Gray out if no data
    if (health > 60) return '#4ade80';
    if (health > 30) return '#facc15';
    return '#ef4444';
  };

  return (
    <div className="dashboard-container">
      <div className="glass-panel">
        <header className="header">
          <h1 className="title">Telemetry Engine</h1>
          <div className="status-indicator">
            <div className={`status-dot ${isConnected ? (receivingData ? 'connected' : 'idle') : 'disconnected'}`}></div>
            <span className="status-text">
              {!isConnected ? 'NODE OFFLINE' : (!receivingData ? 'AWAITING GAME DATA' : 'LIVE')}
            </span>
          </div>
        </header>

        <div className={`metric-container ${!receivingData ? 'dimmed' : ''}`}>
          <h2 className="metric-label">VITAL SIGNS</h2>
          
          <div className="health-value">
            <span className="value-number">{receivingData ? health.toFixed(1) : '--'}</span>
            <span className="value-percent">%</span>
          </div>

          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: receivingData ? `${health}%` : '0%',
                backgroundColor: getHealthColor(),
                boxShadow: receivingData ? `0 0 20px ${getHealthColor()}80` : 'none'
              }}
            >
              {receivingData && <div className="shimmer"></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
