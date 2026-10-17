/**
 * LUMA Guide AI — Unified Context Engine
 * Implements the core architecture:
 *
 *                  LUMA
 *                    │
 *        ┌───────────┼───────────┐
 *        ↓           ↓           ↓
 *     Objects       Text       Scene
 *        │           │           │
 *        └───────────┼───────────┘
 *                    ↓
 *              Context Engine
 *                    ↓
 *              Priority Engine
 *                    ↓
 *              Voice Guidance
 *
 * Fuses Computer Vision Detections, OCR / Sign Text, and Spatial Scene Analysis
 * into a single adaptive situational intelligence layer.
 *
 * Supports:
 * - Dual Modes: Passive Mode (monitors & speaks only when important) vs Active Mode (conversational)
 * - 5 Adaptive Situations:
 *     1. Normal (Clear path — LUMA stays quiet)
 *     2. Obstacle (Obstacle ahead)
 *     3. Dangerous Obstacle (Stop! Vehicle approaching)
 *     4. Entering Building (Door detected ahead)
 *     5. Pointing at Sign (Text detected — "Would you like me to read it?")
 * - Conversational confirmations ("Yes" / "Read" to read detected text)
 */

class ContextEngine {
  constructor() {
    // Operational Modes: 'passive' | 'active'
    this.mode = 'passive'; // Default is passive: monitors silently, alerts only when important!

    // Situational States: 'normal' | 'obstacle' | 'danger' | 'doorway' | 'sign'
    this.currentSituation = 'normal';
    this.previousSituation = null;

    // Fused environmental context
    this.activeObjects = [];
    this.activeText = null;
    this.activeScene = null;

    // Interactive conversational prompt state
    this.awaitingTextConfirmation = false;
    this.pendingTextToRead = null;
    this.textConfirmationTimeout = null;
    this.lastSignPromptTime = 0;
    this.signPromptCooldown = 15000; // Do not nag about the same sign within 15s

    // Subscribe to settings
    if (window.LumaSettings) {
      window.LumaSettings.subscribe(settings => {
        if (settings.operationalMode) {
          this.mode = settings.operationalMode;
          this.updateModeUI();
        }
      });
    }
  }

  /**
   * Set Operational Mode (Passive vs Active)
   * @param {'passive' | 'active'} newMode
   * @param {boolean} announceVoice Whether to announce via TTS
   */
  setMode(newMode, announceVoice = true) {
    if (newMode !== 'passive' && newMode !== 'active') return;
    this.mode = newMode;

    if (window.LumaSettings) {
      window.LumaSettings.set('operationalMode', newMode);
    }

    this.updateModeUI();

    if (announceVoice && window.LumaSpeech) {
      window.LumaSpeech.playEarcon('mode_change');
      if (newMode === 'passive') {
        window.LumaSpeech.speak("Passive Mode active. Monitoring silently, alerting only for hazards.", "normal");
      } else {
        window.LumaSpeech.speak("Active Mode active. Ready for questions. Say 'What is ahead' or 'Is path clear'.", "normal");
      }
    }
  }

  /**
   * Toggle between Passive and Active mode
   */
  toggleMode() {
    const nextMode = (this.mode === 'passive') ? 'active' : 'passive';
    this.setMode(nextMode, true);
    return this.mode;
  }

  /**
   * Core Context Fusion Cycle
   * Ingests Objects, Text, and Scene, classifies the situation, and routes to Priority Engine
   * @param {Array<Object>} rawObjects Detected entities from camera / AI
   * @param {Object|null} detectedSign Text / sign information from OCR
   * @param {Object|null} sceneData Holistic scene narrative
   */
  fuseContext(rawObjects = [], detectedSign = null, sceneData = null) {
    this.activeObjects = rawObjects || [];
    this.activeText = detectedSign;
    this.activeScene = sceneData;

    // 1. Determine Adaptive Situation
    const situation = this.classifySituation(rawObjects, detectedSign);
    this.currentSituation = situation.key;
    this.updateSituationUI(situation);

    // 2. Handle Situation 5: Pointing toward a sign
    if (situation.key === 'sign' && situation.signText) {
      this.handleSignDetection(situation.signText);
    }

    // 3. Delegate to Priority Engine with fused context
    if (window.LumaPriorityEngine) {
      return window.LumaPriorityEngine.evaluateWithContext(rawObjects, situation, this.mode);
    }

    return null;
  }

  /**
   * Classify environmental situation according to the 7 Pillars
   */
  classifySituation(objects = [], detectedSign = null) {
    // Situation 5: Pointing towards a sign or text detected
    const signObj = objects.find(o => (o.label === 'signboard' || o.label === 'sign' || o.text));
    if (detectedSign || (signObj && signObj.text)) {
      const text = detectedSign ? (detectedSign.title || detectedSign.text) : (signObj.text || 'Room 204 Computer Lab');
      return {
        key: 'sign',
        title: 'Sign / Text Detected',
        badge: '📖 SIGNAGE',
        description: 'User pointing toward text. Conversational read prompt active.',
        signText: text,
        primaryItem: signObj || { label: 'sign', text }
      };
    }

    // Situation 3: Dangerous Obstacle (vehicle approaching, imminent drop-off, stairs close)
    const dangerousObj = objects.find(o => {
      const label = (o.label || '').toLowerCase();
      const isApproachingVehicle = (label.includes('car') || label.includes('truck') || label.includes('vehicle') || label.includes('bus')) && (o.motion === 'approaching' || (o.distance && o.distance < 4.5));
      const isUrgentDropoff = (label.includes('drop') || label.includes('hole')) && o.distance < 3.0;
      return isApproachingVehicle || isUrgentDropoff;
    });

    if (dangerousObj) {
      return {
        key: 'danger',
        title: 'Dangerous Obstacle',
        badge: '🔴 DANGER HAZARD',
        description: 'High-risk hazard approaching. Immediate stop guidance required.',
        primaryItem: dangerousObj
      };
    }

    // Situation 4: User approaches or enters a building (doorway)
    const doorObj = objects.find(o => (o.label || '').toLowerCase().includes('door'));
    if (doorObj) {
      return {
        key: 'doorway',
        title: 'Building Entrance / Doorway',
        badge: '🚪 DOORWAY',
        description: 'Doorway detected. Transitioning to architectural navigation.',
        primaryItem: doorObj
      };
    }

    // Situation 2: Obstacle ahead (stairs, pedestrian, chair in path)
    const obstacleObj = objects.find(o => {
      const label = (o.label || '').toLowerCase();
      const isStairs = label.includes('stair') || label.includes('step');
      const isInDirectPath = (o.direction === 'FRONT' || o.direction === 'CENTER') && (o.distance && o.distance < 3.5);
      const isNearbyEntity = o.distance && o.distance < 2.5;
      return isStairs || isInDirectPath || isNearbyEntity;
    });

    if (obstacleObj) {
      return {
        key: 'obstacle',
        title: 'Obstacle Ahead',
        badge: '🟠 OBSTACLE',
        description: 'Obstacle detected in immediate forward path.',
        primaryItem: obstacleObj
      };
    }

    // Situation 1: Normal — Clear path
    return {
      key: 'normal',
      title: 'Normal / Path Clear',
      badge: '🟢 PATH CLEAR',
      description: 'Path is clear. LUMA stays quiet in Passive Mode.',
      primaryItem: null
    };
  }

  /**
   * Handle Situation 5: Proactive Sign Reading Prompt
   * Prompt: "Text detected: [Title]. Would you like me to read it?"
   */
  handleSignDetection(signText) {
    const now = Date.now();
    if (now - this.lastSignPromptTime < this.signPromptCooldown) {
      return; // prevent repetitive asking
    }

    this.lastSignPromptTime = now;
    this.awaitingTextConfirmation = true;
    this.pendingTextToRead = signText;

    // Speak proactive prompt
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('prompt');
      const promptSpeech = `Text detected: "${signText}". Would you like me to read it? Say "Yes" or "Read".`;
      window.LumaSpeech.speak(promptSpeech, 'normal');
    }

    // Provide visual prompt banner
    this.showSignPromptUI(signText);

    // Auto-dismiss confirmation window after 9 seconds if user doesn't respond
    clearTimeout(this.textConfirmationTimeout);
    this.textConfirmationTimeout = setTimeout(() => {
      this.cancelSignPrompt();
    }, 9000);
  }

  /**
   * User confirms they want text read ("Yes", "Read", "Sure", "Okay")
   */
  confirmReadSign() {
    if (!this.awaitingTextConfirmation && !this.pendingTextToRead) {
      // If user directly asks "Read this" at any time, execute OCR
      if (window.LumaVoiceCommander) {
        window.LumaVoiceCommander.executeReadMode();
      }
      return;
    }

    clearTimeout(this.textConfirmationTimeout);
    this.awaitingTextConfirmation = false;
    const textToRead = this.pendingTextToRead;
    this.pendingTextToRead = null;
    this.hideSignPromptUI();

    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(`Reading text: ${textToRead}`, 'critical');
    }

    // Trigger full OCR read if available
    if (window.LumaOCR) {
      window.LumaOCR.readAloud();
    }
  }

  /**
   * User declines or timeout occurs ("No", "Cancel", "Quiet")
   */
  cancelSignPrompt() {
    this.awaitingTextConfirmation = false;
    this.pendingTextToRead = null;
    clearTimeout(this.textConfirmationTimeout);
    this.hideSignPromptUI();
  }

  showSignPromptUI(signText) {
    let promptEl = document.getElementById('contextSignPrompt');
    if (!promptEl) {
      promptEl = document.createElement('div');
      promptEl.id = 'contextSignPrompt';
      promptEl.className = 'context-sign-prompt';
      const viewport = document.getElementById('cameraViewport');
      if (viewport) viewport.appendChild(promptEl);
    }

    promptEl.innerHTML = `
      <div class="sign-prompt-card">
        <div class="sign-prompt-icon">📖</div>
        <div class="sign-prompt-body">
          <span class="sign-prompt-tag">TEXT DETECTED</span>
          <p class="sign-prompt-text">"${signText}"</p>
          <span class="sign-prompt-hint">Say <strong>"Yes"</strong> or <strong>"Read"</strong> to hear full sign</span>
        </div>
        <button id="signPromptReadBtn" class="sign-prompt-btn read" aria-label="Read text aloud">Read</button>
        <button id="signPromptDismissBtn" class="sign-prompt-btn dismiss" aria-label="Dismiss sign prompt">✕</button>
      </div>
    `;
    promptEl.classList.remove('hidden');

    const readBtn = document.getElementById('signPromptReadBtn');
    const dismissBtn = document.getElementById('signPromptDismissBtn');
    if (readBtn) readBtn.onclick = () => this.confirmReadSign();
    if (dismissBtn) dismissBtn.onclick = () => this.cancelSignPrompt();
  }

  hideSignPromptUI() {
    const promptEl = document.getElementById('contextSignPrompt');
    if (promptEl) promptEl.classList.add('hidden');
  }

  updateModeUI() {
    // Top bar / HUD mode indicator
    const modeBtn = document.getElementById('hudModeToggleBtn');
    const modeText = document.getElementById('hudModeText');
    const modeIcon = document.getElementById('hudModeIcon');

    if (modeText) {
      modeText.textContent = this.mode === 'passive' ? 'PASSIVE' : 'ACTIVE';
    }
    if (modeIcon) {
      modeIcon.textContent = this.mode === 'passive' ? '👁️' : '🎙️';
    }
    if (modeBtn) {
      modeBtn.className = `hud-pill-btn mode-pill-btn ${this.mode}`;
      modeBtn.title = this.mode === 'passive' 
        ? "Passive Mode: Quiet monitoring, speaks only when hazards occur"
        : "Active Mode: Interactive conversational assistant";
    }

    // Settings dropdown if present
    const settingSelect = document.getElementById('settingOperationalMode');
    if (settingSelect) {
      settingSelect.value = this.mode;
    }
  }

  updateSituationUI(situation) {
    const badge = document.getElementById('hudSituationBadge');
    const badgeText = document.getElementById('hudSituationText');

    if (badge && badgeText) {
      badgeText.textContent = situation.badge;
      badge.className = `hud-chip situation-chip situation-${situation.key}`;
    }
  }
}

// Global singleton instance
window.LumaContextEngine = new ContextEngine();
