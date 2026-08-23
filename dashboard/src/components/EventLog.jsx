import { useState, useEffect } from 'react';

function EventLog({ events, active }) {
  return (
    <div className={`event-log-card ${!active ? 'dimmed' : ''}`}>
      <div className="event-log-header">
        <span className="metric-icon">📋</span>
        <span className="metric-card-label">EVENT LOG</span>
        <span className="event-count">{events.length}</span>
      </div>
      <div className="event-log-body">
        {events.length === 0 ? (
          <div className="event-empty">No events yet...</div>
        ) : (
          events.map((event, i) => (
            <div key={i} className={`event-item ${event.type}`}>
              <span className="event-time">{event.time}</span>
              <span className="event-icon">{event.icon}</span>
              <span className="event-message">{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventLog;
