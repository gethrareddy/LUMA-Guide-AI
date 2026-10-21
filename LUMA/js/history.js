/**
 * LUMA Guide AI — Assistance History Logger
 * Records and presents an accessible audit timeline of events, detections, and alerts.
 */

class HistoryManager {
  constructor() {
    this.STORAGE_KEY = 'luma_history_events_v1';
    this.maxEvents = 60;
    this.events = this.loadEvents();
    this.currentFilter = 'all';

    // Seed with realistic demo events if empty
    if (this.events.length === 0) {
      this.seedDefaultEvents();
    }
  }

  loadEvents() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
    return [];
  }

  saveEvents() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  }

  seedDefaultEvents() {
    const now = Date.now();
    this.events = [
      {
        id: 'evt-1',
        timestamp: new Date(now - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'hazard',
        priority: 'critical',
        title: '⚠️ Stairs detected ahead',
        description: '"Stairs ahead. 2.4 meters. Slow down."',
        distance: '2.4m',
        direction: 'FRONT'
      },
      {
        id: 'evt-2',
        timestamp: new Date(now - 360000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'ocr',
        priority: 'info',
        title: '📖 Text recognized',
        description: '"Room 204 Computer Lab, Dept of CS"',
        distance: '1.8m',
        direction: 'RIGHT'
      },
      {
        id: 'evt-3',
        timestamp: new Date(now - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'voice',
        priority: 'caution',
        title: '🎙️ Voice Query: "Is my path clear?"',
        description: '"Pedestrian approaching on your left. Center path clear."',
        distance: '3.2m',
        direction: 'LEFT'
      },
      {
        id: 'evt-4',
        timestamp: new Date(now - 840000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'hazard',
        priority: 'safe',
        title: '✓ Path clear',
        description: '"Direct path unobstructed for 5 meters."',
        distance: '5.0m',
        direction: 'FRONT'
      }
    ];
    this.saveEvents();
  }

  /**
   * Log an event
   * @param {Object} event { type, priority, title, description, distance, direction }
   */
  log(event) {
    const newEvent = {
      id: 'evt-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: event.type || 'hazard', // 'hazard' | 'ocr' | 'voice' | 'system'
      priority: event.priority || 'info', // 'critical' | 'caution' | 'safe' | 'info'
      title: event.title,
      description: event.description,
      distance: event.distance || '',
      direction: event.direction || ''
    };

    // Avoid duplicate rapid logging
    if (this.events.length > 0 && this.events[0].title === newEvent.title && Date.now() - (this.events[0]._rawTime || 0) < 5000) {
      return;
    }
    newEvent._rawTime = Date.now();

    this.events.unshift(newEvent);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
    this.saveEvents();
    this.render();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  }

  clear() {
    this.events = [];
    this.saveEvents();
    this.render();
  }

  render() {
    const container = document.getElementById('historyTimeline');
    if (!container) return;

    let filtered = this.events;
    if (this.currentFilter === 'critical') {
      filtered = this.events.filter(e => e.priority === 'critical' || e.priority === 'caution');
    } else if (this.currentFilter === 'ocr') {
      filtered = this.events.filter(e => e.type === 'ocr');
    } else if (this.currentFilter === 'voice') {
      filtered = this.events.filter(e => e.type === 'voice');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 1.5rem; margin-bottom: 8px;">📋</p>
          <p style="font-weight: 600;">No history events found</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Assistance alerts and scans will appear here in real time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <article class="history-item ${item.priority}" role="article" aria-label="${item.title} at ${item.timestamp}">
        <span class="history-time">${item.timestamp}</span>
        <div class="history-content">
          <div class="history-title">${item.title}</div>
          <div class="history-desc">${item.description}</div>
          ${item.distance ? `<span class="priority-metric-tag" style="margin-top: 6px; display: inline-block;">${item.distance} • ${item.direction}</span>` : ''}
        </div>
      </article>
    `).join('');
  }
}

// Global singleton instance
window.LumaHistory = new HistoryManager();
