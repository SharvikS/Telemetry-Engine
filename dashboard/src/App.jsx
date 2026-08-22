import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './index.css';

// Connect to the Node relay
const socket = io('http://localhost:4000');

function App() {
  const [health, setHealth] = useState(100);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    // Listen for the health metric payload from Python -> Node
    socket.on('health', (data) => {
      if (data && typeof data.health === 'number') {
        // Ensure it's between 0 and 100
        setHealth(Math.min(100, Math.max(0, data.health)));
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('health');
    };
  }, []);

  // Calculate color based on health (green -> yellow -> red)
  const getHealthColor = () => {
    if (health > 60) return '#4ade80'; // Emerald green
    if (health > 30) return '#facc15'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div className="dashboard-container">
      <div className="glass-panel">
        <header className="header">
          <h1 className="title">Telemetry Engine</h1>
          <div className="status-indicator">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
            <span className="status-text">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </header>

        <div className="metric-container">
          <h2 className="metric-label">VITAL SIGNS</h2>
          
          <div className="health-value">
            <span className="value-number">{health.toFixed(1)}</span>
            <span className="value-percent">%</span>
          </div>

          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${health}%`,
                backgroundColor: getHealthColor(),
                boxShadow: `0 0 20px ${getHealthColor()}80`
              }}
            >
              <div className="shimmer"></div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default App;
