import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const MAX_HISTORY = 60;
const MAX_EVENTS = 50;
const DATA_TIMEOUT_MS = 2000;

const socket = io('http://localhost:4000');

/**
 * Custom hook encapsulating all Socket.IO telemetry state management.
 * Returns a single object with all telemetry values, connection state,
 * history arrays, and event log.
 */
export default function useSocket() {
  // Telemetry values
  const [health, setHealth] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [mana, setMana] = useState(100);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [latency, setLatency] = useState(0);

  // History
  const [healthHistory, setHealthHistory] = useState([]);
  const [staminaHistory, setStaminaHistory] = useState([]);
  const [manaHistory, setManaHistory] = useState([]);
  const [fpsHistory, setFpsHistory] = useState([]);

  // Connection
  const [isConnected, setIsConnected] = useState(false);
  const [receivingData, setReceivingData] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [systemInfo, setSystemInfo] = useState(null);

  // Session stats
  const [peakFps, setPeakFps] = useState(0);
  const [minHealth, setMinHealth] = useState(100);
  const [totalFrames, setTotalFrames] = useState(0);

  // Event log
  const [events, setEvents] = useState([]);

  // Game State & Effects
  const [gameState, setGameState] = useState("PLAYING");
  const [damageEvent, setDamageEvent] = useState(null);

  // Uptime
  const [uptime, setUptime] = useState(0);
  const uptimeStart = useRef(null);
  const timeoutRef = useRef(null);
  const lastHealthRef = useRef(100);

  const addEvent = useCallback((type, icon, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setEvents(prev => [{ type, icon, message, time }, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const pushHistory = useCallback((setter, value) => {
    setter(prev => [...prev, value].slice(-MAX_HISTORY));
  }, []);

  // Uptime timer
  useEffect(() => {
    const id = setInterval(() => {
      if (uptimeStart.current) {
        setUptime(Math.floor((Date.now() - uptimeStart.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Socket event listeners
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

      if (data.server_timestamp) {
        setLatency(Date.now() - data.server_timestamp);
      }

      if (typeof data.health === 'number') {
        const h = Math.min(100, Math.max(0, data.health));
        setHealth(h);
        pushHistory(setHealthHistory, h);
        setMinHealth(prev => Math.min(prev, h));
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
      }, DATA_TIMEOUT_MS);
    });

    socket.on('health_update', (data) => {
      if (data && typeof data.health === 'number') {
        const h = Math.min(100, Math.max(0, data.health));
        setHealth(h);
        pushHistory(setHealthHistory, h);
        setReceivingData(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setReceivingData(false), DATA_TIMEOUT_MS);
      }
    });

    socket.on('system_info', (data) => {
      setSystemInfo(data);
      addEvent('info', '🖥️', `System: ${data.capture_resolution || 'unknown'} | OpenCV ${data.opencv_version || '?'}`);
    });

    socket.on('client_count', (data) => {
      if (data && typeof data.count === 'number') setClientCount(data.count);
    });

    socket.on('game_state_update', (data) => {
      if (data && data.state) {
        setGameState(data.state);
        if (data.state === "LOADING") {
          addEvent('info', '⏳', 'Entering loading screen');
        } else {
          addEvent('success', '🎮', 'Game active');
        }
      }
    });

    socket.on('damage_taken', (data) => {
      if (data && typeof data.amount === 'number') {
        addEvent('danger', '💥', `Took ${data.amount.toFixed(1)}% damage`);
        // Trigger visual effect
        setDamageEvent(Date.now());
        // Clear effect after 500ms
        setTimeout(() => setDamageEvent(null), 500);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('telemetry_update');
      socket.off('health_update');
      socket.off('system_info');
      socket.off('client_count');
      socket.off('game_state_update');
      socket.off('damage_taken');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [addEvent, pushHistory]);

  return {
    health, stamina, mana, fps, frameCount, brightness, latency,
    healthHistory, staminaHistory, manaHistory, fpsHistory,
    isConnected, receivingData, clientCount, systemInfo,
    peakFps, minHealth, totalFrames,
    events, uptime,
    gameState, damageEvent
  };
}
