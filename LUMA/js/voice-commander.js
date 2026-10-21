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
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = window.LumaSettings ? window.LumaSettings.get('language') : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.restartAttempts = 0;
        this.updateVoiceStatusUI('🎙️ Listening for commands... (Say "Help")', true);
      };

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const rawTranscript = res[0].transcript.trim().toLowerCase();

          // INSTANT STOP DETECTION ON INTERIM RESULTS:
          // Immediately halt speech within ~50ms of hearing "stop", "quiet", "silence", "shut up", "halt"
          const cleanText = rawTranscript.replace(/^(hey\s+luma|ok\s+luma|luma|hello\s+luma)[,\s]*/i, '').trim();
          if (
            cleanText === 'stop' ||
            cleanText.startsWith('stop') ||
            cleanText.endsWith('stop') ||
            cleanText.includes('stop') ||
            cleanText.includes('shut up') ||
            cleanText.includes('be quiet') ||
            cleanText.includes('silence') ||
            cleanText.includes('halt')
          ) {
            if (
              cleanText.includes('stop navigation') ||
              cleanText.includes('cancel navigation') ||
              cleanText.includes('stop route') ||
              cleanText.includes('end route') ||
              cleanText.includes('cancel route')
            ) {
              if (window.LumaNavEngine) {
                window.LumaNavEngine.stopNavigation();
              }
            }
            this.executeStop();
            return;
          }

          if (res.isFinal) {
            console.log('Voice Command heard:', rawTranscript);
            if (this.queryCallback) {
              const cb = this.queryCallback;
              this.queryCallback = null;
              cb(rawTranscript);
              return;
            }
            this.handleCommand(rawTranscript);
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Voice command recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.updateVoiceStatusUI('Mic permission blocked. Tap voice bar to enable', false);
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
          }, 450);
        } else {
          this.updateVoiceStatusUI('Voice control muted', false);
        }
      };
    } catch (e) {
      console.warn('Failed to initialize continuous voice recognition:', e);
    }
  }

  /**
   * One-shot question capture callback
   */
  captureQuery(callback) {
    this.queryCallback = callback;
    this.startListening();
    if (window.LumaSpeech) window.LumaSpeech.playEarcon('listen');
  }

  /**
   * Toggle listening state
   */
  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
      if (window.LumaSpeech) window.LumaSpeech.playEarcon('listen');
    }
  }

  /**
   * Start hands-free voice command listening
   */
  startListening() {
    if (!this.recognition) {
      this.initContinuousRecognition();
      if (!this.recognition) return;
    }
    if (this.isListening) return;
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
    // 0. STOP NAVIGATION (HIGHEST PRIORITY ROUTE CANCELLATION)
    // ============================================================
    if (
      text.includes('stop navigation') ||
      text.includes('cancel navigation') ||
      text.includes('stop route') ||
      text.includes('end route') ||
      text.includes('cancel route') ||
      text.includes('exit navigation')
    ) {
      if (window.LumaNavEngine) {
        window.LumaNavEngine.stopNavigation();
      }
      this.executeStop();
      return;
    }

    // ============================================================
    // 0. ABSOLUTE STOP & SILENCE (HIGHEST PRIORITY - STOPS NO MATTER WHAT)
    // ============================================================
    if (
      text === 'stop' ||
      text === 'stop voice' ||
      text.startsWith('stop') ||
      text.endsWith('stop') ||
      text.includes('shut up') ||
      text.includes('be quiet') ||
      text.includes('quiet') ||
      text.includes('silence') ||
      text.includes('mute voice') ||
      text.includes('halt')
    ) {
      this.executeStop();
      return;
    }

    // New active user command: ensure voice output is unsilenced
    if (window.LumaSpeech) window.LumaSpeech.unsilence();
    if (window.LumaPriorityEngine) window.LumaPriorityEngine.unsilence();
    if (window.LumaNavEngine) window.LumaNavEngine.unsilence();

    // ============================================================
    // 1. NAVIGATION DESTINATION SELECTION ("ONE", "TWO", "THREE")
    // ============================================================
    if (window.LumaNavEngine && window.LumaNavEngine.awaitingPlaceChoice) {
      if (
        text.includes('one') || text.includes('first') || text === '1' ||
        text.includes('two') || text.includes('second') || text === '2' ||
        text.includes('three') || text.includes('third') || text === '3' ||
        (window.LumaNavEngine.matchesPlaceName && window.LumaNavEngine.matchesPlaceName(text))
      ) {
        if (window.LumaNavEngine.handleUserChoice(text)) return;
      }
    }

    // ============================================================
    // 1.5 NAVIGATION DIRECTIONS CONFIRMATION ("YES" / "SURE")
    // ============================================================
    if (window.LumaNavEngine && window.LumaNavEngine.awaitingDirectionsConfirmation) {
      if (
        text === 'yes' ||
        text.includes('yes') ||
        text.includes('sure') ||
        text.includes('okay') ||
        text.includes('yeah') ||
        text.includes('start') ||
        text.includes('go') ||
        text.includes('directions') ||
        text.includes('navigate') ||
        text.includes('please')
      ) {
        window.LumaNavEngine.confirmDirections();
        return;
      }
      if (
        text === 'no' ||
        text.includes('no') ||
        text.includes('cancel') ||
        text.includes("don't") ||
        text.includes('dont') ||
        text.includes('dismiss')
      ) {
        window.LumaNavEngine.cancelDirectionsPrompt();
        return;
      }
    }

    // ============================================================
    // 2. CONVERSATIONAL PROMPT CONFIRMATION (SITUATION 5 - READ SIGN)
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
        text.includes('dismiss')
      ) {
        window.LumaContextEngine.cancelSignPrompt();
        if (window.LumaSpeech) window.LumaSpeech.speak("Cancelled text reading.", "normal");
        return;
      }
    }

    // ============================================================
    // 3. VOICE NAVIGATION ("LUMA, find the nearest pharmacy" / "Take me to...")
    // ============================================================
    if (
      text.includes('take me to') ||
      text.includes('navigate to') ||
      text.includes('directions to') ||
      text.includes('route to') ||
      text.includes('how do i get to')
    ) {
      const cleanDest = text
        .replace(/.*?(take me to|navigate to|directions to|route to|how do i get to)\s+/i, '')
        .trim();
      if (window.LumaNavEngine) {
        window.LumaNavEngine.directNavigateTo(cleanDest);
      }
      return;
    }

    if (
      text.includes('find') ||
      text.includes('nearest') ||
      text.includes('nearby') ||
      text.includes('where is the nearest') ||
      text.includes('pharmacy') ||
      text.includes('hospital') ||
      text.includes('coffee shop') ||
      text.includes('supermarket') ||
      text.includes('restaurant') ||
      text.includes('atm') ||
      text.includes('bank') ||
      text.includes('station')
    ) {
      if (window.LumaNavEngine) {
        window.LumaNavEngine.findNearby(text);
        if (window.LumaApp) window.LumaApp.switchScreen('screen-nav');
      }
      return;
    }

    if (text.includes('where am i') || text.includes('current location') || text.includes('my location') || text.includes('what street')) {
      if (window.LumaNavEngine && window.LumaSpeech) {
        window.LumaSpeech.playEarcon('ack');
        const locMsg = `Your current position is: ${window.LumaNavEngine.locationName}.`;
        window.LumaSpeech.speak(locMsg, 'normal');
      }
      return;
    }

    if (text.includes('next step') || text.includes('where do i turn') || text.includes('repeat direction') || text.includes('repeat step') || text.includes('which way')) {
      if (window.LumaNavEngine) {
        window.LumaNavEngine.repeatCurrentStep();
      }
      return;
    }

    if (text.includes('simulate step') || text.includes('simulate walk') || text.includes('step forward') || text.includes('walk forward')) {
      if (window.LumaNavEngine) {
        window.LumaNavEngine.simulateStepForward(25);
      }
      return;
    }

    // ============================================================
    // 4. RESUME VOICE COMMANDS
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
      window.LumaPriorityEngine.silence(0); // 0 = indefinite silence until resume
    }
    if (window.LumaNavEngine) {
      window.LumaNavEngine.silence();
    }
    this.updateVoiceStatusUI('Silenced. Say "Resume" or "Start" to continue', false);
  }

  /**
   * Action: Resume guidance
   */
  executeResume() {
    if (window.LumaPriorityEngine) {
      window.LumaPriorityEngine.unsilence();
    }
    if (window.LumaNavEngine) {
      window.LumaNavEngine.unsilence();
    }
    if (window.LumaSpeech) {
      window.LumaSpeech.resume();
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak('Voice guidance resumed.', 'critical');
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
    const helpText = "Voice commands: Say 'Find a pharmacy' or 'Take me to a place' for navigation. Say 'What is ahead' or 'Is path clear' for obstacles. Say 'Stop' to silence immediately. Say 'Passive mode' or 'Active mode' to change mode. Say 'What is around me' to describe surroundings. Say 'Read this' to scan text. Say 'Emergency' for SOS.";
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
