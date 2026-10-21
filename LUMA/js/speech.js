/**
 * LUMA Guide AI — Speech Synthesis & Voice Recognition Engine
 * Handles prioritized natural speech guidance, voice recognition,
 * earcon audio cues, and instant stop/silence controls.
 */

class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.isSpeaking = false;
    this.isSilenced = false;
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.language = 'en-US';
    this.isVoiceGuidanceEnabled = true;

    // Web Audio Context for tactile earcon sound effects
    this.audioCtx = null;

    this.initVoices();

    // Subscribe to settings
    if (window.LumaSettings) {
      window.LumaSettings.subscribe(settings => {
        this.rate = settings.voiceSpeed || 1.0;
        this.pitch = settings.voicePitch || 1.0;
        this.language = settings.language || 'en-US';
        this.isVoiceGuidanceEnabled = settings.voiceGuidance !== false;
        this.pickBestVoice();
      });
    }
  }

  initVoices() {
    if (!this.synth) return;
    const populate = () => {
      this.voices = this.synth.getVoices();
      this.pickBestVoice();
    };

    populate();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populate;
    }
  }

  pickBestVoice() {
    if (!this.voices || !this.voices.length) return;
    const lang = this.language.slice(0, 2);
    const match = this.voices.find(v => v.lang.startsWith(lang) && (v.name.includes('Natural') || v.name.includes('Siri') || v.name.includes('Google') || v.name.includes('Premium')));
    this.voice = match || this.voices.find(v => v.lang.startsWith(lang)) || this.voices[0];
  }

  /**
   * Unlock Web Audio & SpeechSynthesis on mobile browsers upon user touch gesture
   */
  unlockAudio() {
    try {
      this.getAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.synth) {
        if (this.synth.paused) this.synth.resume();
        // Warm up speech synthesis on mobile Safari with silent utterance
        if (!this.unlocked) {
          const warmUp = new SpeechSynthesisUtterance(' ');
          warmUp.volume = 0.01;
          this.synth.speak(warmUp);
          this.unlocked = true;
        }
      }
    } catch (e) {}
  }

  /**
   * Bridge to VoiceCommander speech recognition
   */
  startListening(callback) {
    if (window.LumaVoiceCommander && typeof window.LumaVoiceCommander.captureQuery === 'function') {
      window.LumaVoiceCommander.captureQuery(callback);
    } else if (window.LumaVoiceCommander && typeof window.LumaVoiceCommander.startListening === 'function') {
      window.LumaVoiceCommander.startListening();
      if (callback) {
        window.LumaVoiceCommander.queryCallback = callback;
      }
    }
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Synthesize acoustic earcon tones (feedback for blind users)
   * @param {'ack' | 'stop' | 'listen' | 'error'} type
   */
  playEarcon(type = 'ack') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'ack') {
        // High rising double chirp (Command understood)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'stop') {
        // Falling low tone (Speech stopped / silenced)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.16);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'listen') {
        // Subtle bell ping (Listening)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now); // E5 note
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'danger') {
        // Urgent danger pulse (Critical Priority)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(440, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === 'warning') {
        // Dual caution tone (Warning Priority)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'prompt') {
        // Questioning double chime (Conversational Prompt)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(783.99, now + 0.09); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'mode_change') {
        // Harmonic mode toggle chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14); // G5
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Earcon audio error:', e);
    }
  }

  /**
   * Speak guidance with priority arbitration
   * @param {string} text Text to speak
   * @param {string} priority 'critical' | 'caution' | 'normal' | 'info'
   * @param {Function} onEnd Callback when speech finishes
   */
  speak(text, priority = 'normal', onEnd = null) {
    if (!this.synth || !this.isVoiceGuidanceEnabled) {
      this.announceAria(text);
      if (onEnd) onEnd();
      return;
    }

    // Absolute STOP: When user commanded STOP/SILENCE, NEVER speak no matter what!
    if (this.isSilenced) {
      return;
    }

    // Always announce to Screen Reader live region
    this.announceAria(text);

    // Cancel prior speech for clean delivery (prevents utterance queue freeze)
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    this.isSpeaking = false;

    // Prepare utterance
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = this.rate;
    utterance.pitch = priority === 'critical' ? 1.05 : this.pitch;
    utterance.lang = this.language;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.lastSpokenText = text;
      this.lastSpokenTime = Date.now();
      this.updateVoiceWaveUI(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.updateVoiceWaveUI(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      this.updateVoiceWaveUI(false);
      if (onEnd) onEnd();
    };

    try {
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis speak error:', e);
    }
  }

  /**
   * Immediately stop and silence any current speech playback
   */
  stop() {
    this.isSilenced = true;
    this.isSpeaking = false;
    if (this.synth) {
      try {
        if (this.synth.speaking || this.synth.pending) {
          this.synth.cancel();
        }
        if (this.synth.paused) {
          this.synth.resume();
          this.synth.cancel();
        }
        this.synth.cancel();
      } catch (e) {
        console.warn('Synth cancel error:', e);
      }
    }
    this.updateVoiceWaveUI(false);
    this.playEarcon('stop');
  }

  /**
   * Unsilence voice guidance
   */
  unsilence() {
    this.isSilenced = false;
  }

  /**
   * Resume voice output
   */
  resume() {
    this.isSilenced = false;
    this.playEarcon('ack');
  }

  /**
   * Repeat the last spoken sentence
   */
  repeatLast() {
    if (this.lastSpokenText) {
      this.isSilenced = false;
      this.speak(this.lastSpokenText, 'critical');
    }
  }

  /**
   * Announce message to assistive screen readers via ARIA live region
   */
  announceAria(text) {
    const announcer = document.getElementById('aria-announcer');
    if (announcer) {
      announcer.textContent = '';
      setTimeout(() => {
        announcer.textContent = text;
      }, 50);
    }
  }

  updateVoiceWaveUI(isActive) {
    const wave = document.getElementById('voiceSoundwave');
    if (wave) {
      if (isActive) wave.classList.add('active');
      else wave.classList.remove('active');
    }
  }
}

// Global singleton instance
window.LumaSpeech = new SpeechEngine();
