/**
 * LUMA Guide AI — Acoustic Sonar Radar & Multi-Sensory Audio Engine
 * Uses Web Audio API to provide real-time spatial proximity pings and haptics.
 */

class AudioSonarEngine {
  constructor() {
    this.audioCtx = null;
    this.isEnabled = true;
    this.lastPingTime = 0;
    this.pingInterval = 1800; // ms between pings
    this.minInterval = 400;   // rapid pings when obstacle is very close
    this.maxInterval = 2500;  // slow pings when obstacle is far
    this.isMuted = false;
    this.currentDistance = 4.0; // meters

    // Subscribe to settings
    if (window.LumaSettings) {
      window.LumaSettings.subscribe(settings => {
        this.isEnabled = settings.sonarRadar;
      });
    }
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Update current closest obstacle distance and trigger acoustic ping
   * @param {number} distanceMeters e.g. 1.2
   * @param {string} priority 'critical' | 'caution' | 'safe' | 'info'
   */
  updateDistance(distanceMeters, priority = 'safe') {
    this.currentDistance = Math.max(0.5, Math.min(10.0, distanceMeters));

    if (!this.isEnabled || this.isMuted) return;

    // Calculate dynamic ping frequency interval based on distance
    // Closer distance (0.5m) -> short interval (400ms); Far (5m+) -> long interval (2000ms)
    const normalized = Math.min(1.0, this.currentDistance / 5.0);
    this.pingInterval = this.minInterval + normalized * (this.maxInterval - this.minInterval);

    const now = performance.now();
    if (now - this.lastPingTime >= this.pingInterval) {
      this.lastPingTime = now;
      this.playProximityPing(this.currentDistance, priority);
    }
  }

  /**
   * Plays a synthesized frequency-modulated acoustic ping
   */
  playProximityPing(distance, priority) {
    this.initAudio();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Pitch: closer = higher frequency (e.g. 880Hz to 320Hz)
    let baseFreq = 440;
    if (priority === 'critical') {
      baseFreq = 880;
    } else if (priority === 'caution') {
      baseFreq = 660;
    } else if (distance < 2.0) {
      baseFreq = 740;
    } else if (distance < 3.5) {
      baseFreq = 520;
    } else {
      baseFreq = 380;
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = priority === 'critical' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);

      // Trigger UI visual ripple animation
      this.triggerVisualRipple();

      // Trigger tactile haptic pulse if critical or caution
      if (window.LumaSettings && window.LumaSettings.get('haptics')) {
        this.triggerHaptic(priority);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Plays an emergency beacon siren sound
   */
  playEmergencySiren() {
    this.initAudio();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(950, now + 0.25);
      osc.frequency.linearRampToValueAtTime(600, now + 0.5);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.52);

      if (typeof window.lumaVibrate === 'function') {
        window.lumaVibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Siren play error:', e);
    }
  }

  triggerVisualRipple() {
    const ripple = document.getElementById('sonarRipple');
    if (ripple) {
      ripple.classList.remove('pulsing');
      void ripple.offsetWidth; // trigger reflow
      ripple.classList.add('pulsing');
    }
  }

  triggerHaptic(priority) {
    if (typeof window.lumaVibrate !== 'function') return;
    if (priority === 'critical') {
      window.lumaVibrate([120, 40, 120]);
    } else if (priority === 'caution') {
      window.lumaVibrate(60);
    }
  }
}

// Global singleton instance
window.LumaSonar = new AudioSonarEngine();
