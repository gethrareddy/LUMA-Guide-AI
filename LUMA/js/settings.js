/**
 * LUMA Guide AI — Settings & Preferences Manager
 * Persists user accessibility settings in localStorage and notifies subscribers.
 */

class SettingsManager {
  constructor() {
    this.STORAGE_KEY = 'luma_settings_v1';
    this.defaults = {
      voiceGuidance: true,
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      sensitivity: 'high', // 'high', 'medium', 'low'
      detectionMode: 'smart', // 'smart' (priority filtered) vs 'verbose' (all objects)
      sonarRadar: true,
      haptics: true,
      highContrast: false,
      language: 'en-US',
      activeScenario: 'stairs'
    };

    this.settings = this.loadSettings();
    this.listeners = [];
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.defaults, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Could not load settings from localStorage:', e);
    }
    return { ...this.defaults };
  }

  saveSettings() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (e) {
      console.warn('Could not save settings to localStorage:', e);
    }
  }

  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : this.defaults[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.settings);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.settings);
      } catch (err) {
        console.error('Settings listener error:', err);
      }
    });
  }

  reset() {
    this.settings = { ...this.defaults };
    this.saveSettings();
  }
}

// Global singleton instance
window.LumaSettings = new SettingsManager();
