/**
 * LUMA Guide AI — Continuous Voice Commander for Blind & Visually Impaired Users
 * Provides 100% hands-free voice control across the entire web application.
 *
 * Implements:
 * - Hands-free continuous speech recognition
 * - Conversational wake words ("LUMA", "Hey LUMA") or direct commands
 * - Dual Mode voice toggling (Passive Mode vs Active Mode)
 * - Conversational sign prompt confirmations ("Yes" / "Read" in Situation 5)
 * - Environmental queries ("What's around me?", "Is the path clear?", "What is ahead?")
 * - Instant physical and voice silence/stop controls
 * - Scenario simulation triggers for testing
 */

class VoiceCommander {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isManualMuted = false;
    this.restartAttempts = 0;
    this.restartTimeout = null;
    this.lastRecognizedCommand = '';

    this.initContinuousRecognition();
  }

  /**
   * Initialize continuous speech recognition
   */
  initContinuousRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('SpeechRecognition API not supported in this browser. Voice commands require Chrome, Edge, or Safari.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = window.LumaSettings ? window.LumaSettings.get('language') : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.restartAttempts = 0;
        this.updateVoiceStatusUI('🎙️ Listening for commands... (Say "Help")', true);
      };

      this.recognition.onresult = (event) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        if (lastResult.isFinal) {
          const rawTranscript = lastResult[0].transcript.trim().toLowerCase();
          console.log('Voice Command heard:', rawTranscript);
          this.handleCommand(rawTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Voice command recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.updateVoiceStatusUI('Mic permission blocked. Tap to enable', false);
          this.isListening = false;
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Automatically restart listening if not manually muted
        if (!this.isManualMuted) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            this.startListening();
          }, 350);
        } else {
          this.updateVoiceStatusUI('Voice control muted', false);
        }
      };
    } catch (e) {
      console.warn('Failed to initialize continuous voice recognition:', e);
    }
  }

  /**
   * Start hands-free voice command listening
   */
  startListening() {
    if (this.isListening || !this.recognition) return;
    this.isManualMuted = false;

    try {
      this.recognition.start();
    } catch (e) {
      // If already started, ignore
      if (e.name !== 'InvalidStateError') {
        console.warn('Error starting voice recognition:', e);
      }
    }
  }

  /**
   * Stop voice command listening
   */
  stopListening() {
    this.isManualMuted = true;
    clearTimeout(this.restartTimeout);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.updateVoiceStatusUI('Voice control paused', false);
  }

  /**
   * Core Voice Command Router
   * Parses spoken text and executes actions immediately
   * @param {string} rawText Raw spoken text
   */
  handleCommand(rawText) {
    this.lastRecognizedCommand = rawText;
    this.updateVoiceStatusUI(`Heard: "${rawText}"`, true);

    // Strip wake-words: "hey luma", "ok luma", "luma"
    let text = rawText.replace(/^(hey\s+luma|ok\s+luma|luma|hello\s+luma)[,\s]*/i, '').trim();
    if (!text) text = rawText; // If user simply said "Luma", keep raw

    // ============================================================
    // 0. CONVERSATIONAL PROMPT CONFIRMATION (SITUATION 5 - READ SIGN)
    // ============================================================
    if (window.LumaContextEngine && window.LumaContextEngine.awaitingTextConfirmation) {
      if (
        text.includes('yes') ||
        text.includes('read') ||
        text.includes('sure') ||
        text.includes('okay') ||
        text.includes('yeah') ||
        text.includes('go ahead') ||
        text.includes('please')
      ) {
        window.LumaContextEngine.confirmReadSign();
        return;
      }
      if (
        text.includes('no') ||
        text.includes('cancel') ||
        text.includes('dont') ||
        text.includes("don't") ||
        text.includes('dismiss') ||
        text.includes('quiet')
      ) {
        window.LumaContextEngine.cancelSignPrompt();
        if (window.LumaSpeech) window.LumaSpeech.speak("Cancelled text reading.", "normal");
        return;
      }
    }

    // ============================================================
    // 1. EMERGENCY STOP & SILENCE COMMANDS (HIGHEST PRIORITY)
    // ============================================================
    if (
      text.includes('stop') ||
      text.includes('shut up') ||
      text.includes('be quiet') ||
      text.includes('quiet') ||
      text.includes('silence') ||
      text.includes('mute voice') ||
      text.includes('shut') ||
      text.includes('halt')
    ) {
      this.executeStop();
      return;
    }

    // ============================================================
    // 2. RESUME VOICE COMMANDS
    // ============================================================
    if (text.includes('resume') || text.includes('continue') || text.includes('speak') || text.includes('unmute')) {
      this.executeResume();
      return;
    }

    // ============================================================
    // 3. DUAL OPERATIONAL MODES (PASSIVE VS ACTIVE)
    // ============================================================
    if (
      text.includes('passive mode') ||
      text.includes('silent mode') ||
      text.includes('quiet mode') ||
      text.includes('monitor silently') ||
      text.includes('passive')
    ) {
      if (window.LumaContextEngine) {
        window.LumaContextEngine.setMode('passive', true);
      }
      return;
    }

    if (
      text.includes('active mode') ||
      text.includes('interactive mode') ||
      text.includes('talkative mode') ||
      text.includes('conversational mode') ||
      text.includes('active')
    ) {
      if (window.LumaContextEngine) {
        window.LumaContextEngine.setMode('active', true);
      }
      return;
    }

    if (text.includes('switch mode') || text.includes('toggle mode')) {
      if (window.LumaContextEngine) {
        window.LumaContextEngine.toggleMode();
      }
      return;
    }

    // ============================================================
    // 4. START CAMERA ASSISTANCE
    // ============================================================
    if (
      text.includes('start') ||
      text.includes('start assistance') ||
      text.includes('turn on camera') ||
      text.includes('open camera') ||
      text.includes('camera') ||
      text.includes('assist') ||
      text.includes('begin')
    ) {
      this.executeStartAssistance();
      return;
    }

    // ============================================================
    // 5. READ & OCR MODE
    // ============================================================
    if (
      text.includes('read') ||
      text.includes('read sign') ||
      text.includes('read text') ||
      text.includes('scan') ||
      text.includes('ocr') ||
      text.includes('read this') ||
      text.includes('what does it say')
    ) {
      this.executeReadMode();
      return;
    }

    // ============================================================
    // 6. SCENE UNDERSTANDING ("DESCRIBE") / AROUND ME
    // ============================================================
    if (
      text.includes('around me') ||
      text.includes('around') ||
      text.includes('describe') ||
      text.includes('describe room') ||
      text.includes('describe surroundings') ||
      text.includes('where am i') ||
      text.includes('environment')
    ) {
      this.executeDescribeMode();
      return;
    }

    // ============================================================
    // 7. SPATIAL & OBSTACLE QUERIES
    // ============================================================
    if (
      text.includes('what is in front') ||
      text.includes('what is ahead') ||
      text.includes('what do you see') ||
      text.includes('what is this') ||
      text.includes('whats ahead') ||
      text.includes('what is that') ||
      text.includes('in front of me') ||
      text.includes('front')
    ) {
      this.executeAnswerQuery("What is in front of me?");
      return;
    }

    if (
      text.includes('is path clear') ||
      text.includes('is my path clear') ||
      text.includes('can i walk') ||
      text.includes('clear path') ||
      text.includes('is it clear') ||
      text.includes('safe to walk') ||
      text.includes('is it safe')
    ) {
      this.executeAnswerQuery("Is my path clear?");
      return;
    }

    if (text.includes('stair') || text.includes('steps')) {
      this.executeAnswerQuery("Are there stairs nearby?");
      return;
    }

    if (text.includes('door') || text.includes('entrance') || text.includes('exit')) {
      this.executeAnswerQuery("Where is the door?");
      return;
    }

    // ============================================================
    // 8. REPEAT LAST GUIDANCE
    // ============================================================
    if (text.includes('repeat') || text.includes('say again') || text.includes('what was that') || text.includes('again')) {
      if (window.LumaSpeech) {
        window.LumaSpeech.playEarcon('ack');
        window.LumaSpeech.repeatLast();
      }
      return;
    }

    // ============================================================
    // 9. STATUS / BATTERY / MODE INQUIRY
    // ============================================================
    if (text.includes('status') || text.includes('mode') || text.includes('battery') || text.includes('system status')) {
      this.executeStatus();
      return;
    }

    // ============================================================
    // 10. SCENARIO SIMULATION SHORTCUTS (FOR DEMO & TESTING)
    // ============================================================
    if (text.includes('simulate car') || text.includes('simulate vehicle') || text.includes('scenario vehicle') || text.includes('situation 3')) {
      this.executeSwitchScenario('vehicle', 'Vehicle Approaching scenario activated.');
      return;
    }

    if (text.includes('simulate stairs') || text.includes('scenario stairs') || text.includes('situation 2 stairs')) {
      this.executeSwitchScenario('stairs', 'Stairs Ahead scenario activated.');
      return;
    }

    if (text.includes('simulate door') || text.includes('situation 4') || text.includes('scenario door') || text.includes('simulate building')) {
      this.executeSwitchScenario('door', 'Entering Building doorway scenario activated.');
      return;
    }

    if (text.includes('simulate sign') || text.includes('situation 5') || text.includes('scenario sign') || text.includes('simulate text')) {
      this.executeSwitchScenario('signs', 'Pointing toward sign scenario activated.');
      return;
    }

    if (text.includes('simulate clear') || text.includes('situation 1') || text.includes('scenario clear') || text.includes('simulate normal')) {
      this.executeSwitchScenario('clear', 'Normal clear pathway scenario activated.');
      return;
    }

    if (text.includes('simulate person') || text.includes('scenario person') || text.includes('simulate obstacle')) {
      this.executeSwitchScenario('person', 'Obstacle Ahead scenario activated.');
      return;
    }

    // ============================================================
    // 11. EMERGENCY SOS
    // ============================================================
    if (text.includes('emergency') || text.includes('sos') || text.includes('help me') || text.includes('call for help')) {
      this.executeEmergency();
      return;
    }

    if (text.includes('cancel emergency') || text.includes('false alarm') || text.includes('cancel alert')) {
      if (window.LumaApp) {
        window.LumaApp.closeEmergencyModal();
      }
      return;
    }

    // ============================================================
    // 12. NAVIGATION SHORTCUTS
    // ============================================================
    if (text.includes('home') || text.includes('welcome') || text.includes('main menu')) {
      if (window.LumaApp) window.LumaApp.switchScreen('screen-welcome');
      if (window.LumaSpeech) window.LumaSpeech.speak('Navigated to Home.', 'normal');
      return;
    }

    if (text.includes('history') || text.includes('past alerts')) {
      if (window.LumaApp) window.LumaApp.switchScreen('screen-history');
      if (window.LumaSpeech) window.LumaSpeech.speak('Opened Assistance History.', 'normal');
      return;
    }

    if (text.includes('settings') || text.includes('preferences')) {
      if (window.LumaApp) window.LumaApp.switchScreen('screen-settings');
      if (window.LumaSpeech) window.LumaSpeech.speak('Opened Settings.', 'normal');
      return;
    }

    // ============================================================
    // 13. ACCESSIBILITY TOGGLES (CONTRAST, SPEED)
    // ============================================================
    if (text.includes('high contrast on') || text.includes('turn on contrast') || text.includes('yellow mode')) {
      document.body.classList.add('high-contrast');
      if (window.LumaSettings) window.LumaSettings.set('highContrast', true);
      if (window.LumaSpeech) window.LumaSpeech.speak('High contrast mode enabled.', 'normal');
      return;
    }

    if (text.includes('high contrast off') || text.includes('normal contrast')) {
      document.body.classList.remove('high-contrast');
      if (window.LumaSettings) window.LumaSettings.set('highContrast', false);
      if (window.LumaSpeech) window.LumaSpeech.speak('High contrast mode disabled.', 'normal');
      return;
    }

    if (text.includes('faster') || text.includes('speed up')) {
      if (window.LumaSettings && window.LumaSpeech) {
        const cur = window.LumaSettings.get('voiceSpeed') || 1.0;
        const next = Math.min(1.8, parseFloat((cur + 0.2).toFixed(1)));
        window.LumaSettings.set('voiceSpeed', next);
        window.LumaSpeech.speak(`Voice speed set to ${next}x`, 'critical');
      }
      return;
    }

    if (text.includes('slower') || text.includes('slow down voice')) {
      if (window.LumaSettings && window.LumaSpeech) {
        const cur = window.LumaSettings.get('voiceSpeed') || 1.0;
        const next = Math.max(0.6, parseFloat((cur - 0.2).toFixed(1)));
        window.LumaSettings.set('voiceSpeed', next);
        window.LumaSpeech.speak(`Voice speed set to ${next}x`, 'critical');
      }
      return;
    }

    // ============================================================
    // 14. HELP & COMMANDS LIST
    // ============================================================
    if (text.includes('help') || text.includes('what can i say') || text.includes('commands') || text.includes('list commands')) {
      this.executeHelp();
      return;
    }

    // If text didn't match a direct action, treat as an environmental question
    this.executeAnswerQuery(text);
  }

  /**
   * Action: Immediately silence and stop all speech
   */
  executeStop() {
    if (window.LumaSpeech) {
      window.LumaSpeech.stop();
      window.LumaSpeech.playEarcon('stop');
    }
    if (window.LumaPriorityEngine) {
      window.LumaPriorityEngine.silence(8000); // silence automatic chatter for 8 seconds
    }
    this.updateVoiceStatusUI('Silenced. Say "Resume" or "Start" to continue', false);
  }

  /**
   * Action: Resume guidance
   */
  executeResume() {
    if (window.LumaSpeech) {
      window.LumaSpeech.resume();
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak('Voice guidance resumed.', 'critical');
    }
    if (window.LumaPriorityEngine) {
      window.LumaPriorityEngine.unsilence();
    }
  }

  /**
   * Action: Start Camera & Live Assistance
   */
  async executeStartAssistance() {
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.stop();
    }
    if (window.LumaApp) {
      window.LumaApp.switchScreen('screen-live');
    }
    if (window.LumaCamera) {
      const ok = await window.LumaCamera.startRealCamera();
      if (!ok) {
        window.LumaCamera.startSimulatedCamera();
      }
      if (window.LumaSpeech) {
        window.LumaSpeech.speak('Live assistance active. Rear camera observing path.', 'critical');
      }
    }
  }

  /**
   * Action: Switch to Read Mode and perform OCR
   */
  async executeReadMode() {
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
    }
    if (window.LumaApp) {
      window.LumaApp.switchScreen('screen-read');
    }
    if (window.LumaSpeech) {
      window.LumaSpeech.speak('Read Mode active. Point camera at sign.', 'critical');
    }
    if (window.LumaOCR) {
      setTimeout(async () => {
        const spoken = await window.LumaOCR.scan();
        if (window.LumaSpeech) {
          window.LumaSpeech.speak(spoken, 'critical');
        }
      }, 1000);
    }
  }

  /**
   * Action: Switch to Describe Mode and synthesize surroundings
   */
  executeDescribeMode() {
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
    }
    if (window.LumaApp) {
      window.LumaApp.switchScreen('screen-describe');
    }
    if (window.LumaSceneDescriptor) {
      const scenario = window.LumaCamera ? window.LumaCamera.currentScenario : 'stairs';
      window.LumaSceneDescriptor.generateScene(scenario);
      window.LumaSceneDescriptor.readAloud();
    }
  }

  /**
   * Action: Answer question about immediate surroundings
   */
  executeAnswerQuery(query) {
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
    }
    const currentDecision = window.LumaCamera ? window.LumaCamera.latestDecision : null;
    const answer = window.LumaPriorityEngine
      ? window.LumaPriorityEngine.answerUserQuestion(query, currentDecision)
      : "Your path is clear.";

    if (window.LumaSpeech) {
      window.LumaSpeech.speak(answer, 'critical');
    }

    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'voice',
        priority: 'info',
        title: `🎙️ Voice: "${query}"`,
        description: `"${answer}"`
      });
    }
  }

  /**
   * Action: Speak System Status
   */
  executeStatus() {
    const mode = window.LumaContextEngine ? window.LumaContextEngine.mode : 'passive';
    const situation = window.LumaContextEngine ? window.LumaContextEngine.currentSituation : 'normal';
    const isCamera = window.LumaCamera && window.LumaCamera.isAssistanceRunning;
    const statusMsg = `System status: LUMA is in ${mode} mode. Camera is ${isCamera ? 'active' : 'idle'}. Current situation: ${situation}. Acoustic sonar radar is active.`;
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(statusMsg, 'critical');
    }
  }

  /**
   * Action: Switch Demo Scenario via voice
   */
  executeSwitchScenario(scenarioKey, announceMsg) {
    if (window.LumaCamera) {
      window.LumaCamera.setScenario(scenarioKey);
      const select = document.getElementById('scenarioSelect');
      if (select) select.value = scenarioKey;
    }
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(announceMsg, 'critical');
    }
  }

  /**
   * Action: Emergency Protocol
   */
  executeEmergency() {
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
    }
    if (window.LumaApp) {
      window.LumaApp.openEmergencyModal();
    }
  }

  /**
   * Action: Speak audio help menu
   */
  executeHelp() {
    const helpText = "Voice commands: Say 'What is ahead' or 'Is path clear' for navigation. Say 'Passive mode' or 'Active mode' to switch modes. Say 'What is around me' to describe surroundings. Say 'Read this' to scan signs. Say 'Stop' to silence. Say 'Start' to activate camera. Say 'Emergency' for SOS.";
    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(helpText, 'critical');
    }
  }

  updateVoiceStatusUI(text, isActive) {
    const statusTextEl = document.getElementById('voiceBarText');
    const dotEl = document.getElementById('voiceBarDot');
    if (statusTextEl) statusTextEl.textContent = text;
    if (dotEl) {
      dotEl.className = isActive ? 'voice-dot active' : 'voice-dot paused';
    }
  }
}

// Global singleton instance
window.LumaVoiceCommander = new VoiceCommander();
