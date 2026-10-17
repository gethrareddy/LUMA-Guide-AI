/**
 * LUMA Guide AI — Main Application Controller
 * Coordinates UI transitions, screen lifecycles, accessibility shortcuts,
 * and user interactions across all 9 application components.
 */

class LumaApp {
  constructor() {
    this.currentScreen = 'screen-welcome';
    this.emergencyInterval = null;
    this.emergencyCount = 5;

    document.addEventListener('DOMContentLoaded', () => {
      this.initElements();
      this.bindNavigation();
      this.bindHeaderActions();
      this.bindWelcomeScreen();
      this.bindPermissionScreen();
      this.bindLiveScreen();
      this.bindAskScreen();
      this.bindReadScreen();
      this.bindDescribeScreen();
      this.bindHistoryScreen();
      this.bindSettingsScreen();
      this.bindEmergencyModal();
      this.bindKeyboardShortcuts();
      this.applyInitialSettings();

      console.log('LUMA Guide AI initialized successfully.');
    });
  }

  initElements() {
    this.viewport = document.getElementById('appViewport');
    this.bottomNav = document.getElementById('bottomNav');
    this.screens = document.querySelectorAll('.screen');
    this.navTabs = document.querySelectorAll('.nav-tab');
  }

  /**
   * Switch between app screens with smooth transition
   */
  switchScreen(targetScreenId) {
    if (this.currentScreen === targetScreenId) return;

    this.screens.forEach(s => {
      s.classList.remove('screen-active');
    });

    const targetScreen = document.getElementById(targetScreenId);
    if (targetScreen) {
      targetScreen.classList.add('screen-active');
      this.currentScreen = targetScreenId;
    }

    // Update bottom nav active tab
    this.navTabs.forEach(tab => {
      if (tab.dataset.target === targetScreenId) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    // Mobile UX requirement: During Live Assistance, hide bottom nav to dedicate full screen to camera
    if (targetScreenId === 'screen-live') {
      this.bottomNav.classList.add('nav-hidden');
    } else {
      this.bottomNav.classList.remove('nav-hidden');
    }

    // Scroll to top of newly opened screen
    if (targetScreen) targetScreen.scrollTop = 0;
  }

  bindNavigation() {
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        if (target) {
          if (target === 'screen-live' && !window.LumaCamera.isAssistanceRunning) {
            // If navigating to live assist and camera isn't running, start it
            window.LumaCamera.startSimulatedCamera();
          }
          this.switchScreen(target);
        }
      });
    });
  }

  bindHeaderActions() {
    // Brand title returns home
    const brandBtn = document.getElementById('brandHeaderBtn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        this.switchScreen('screen-welcome');
      });
    }

    // High Contrast Toggle
    const contrastBtn = document.getElementById('contrastToggleBtn');
    if (contrastBtn) {
      contrastBtn.addEventListener('click', () => {
        const isHigh = document.body.classList.toggle('high-contrast');
        window.LumaSettings.set('highContrast', isHigh);
        if (window.LumaSpeech) {
          window.LumaSpeech.speak(`High contrast mode ${isHigh ? 'enabled' : 'disabled'}`, 'normal');
        }
      });
    }

    // Sound / Sonar Mute Toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    const soundOn = document.getElementById('soundIconOn');
    const soundOff = document.getElementById('soundIconOff');

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = window.LumaSonar.toggleMute();
        if (soundOn && soundOff) {
          if (isMuted) {
            soundOn.classList.add('hidden');
            soundOff.classList.remove('hidden');
          } else {
            soundOn.classList.remove('hidden');
            soundOff.classList.add('hidden');
          }
        }
        if (window.LumaSpeech) {
          window.LumaSpeech.speak(`Sonar acoustic radar ${isMuted ? 'muted' : 'unmuted'}`, 'normal');
        }
      });
    }

    // Prominent Global STOP / SILENCE Button
    const globalStopBtn = document.getElementById('globalStopVoiceBtn');
    if (globalStopBtn) {
      globalStopBtn.addEventListener('click', () => {
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.executeStop();
        }
      });
    }

    // Voice Command Bar Silence / Resume Toggle
    const voiceBarMuteBtn = document.getElementById('voiceBarMuteToggleBtn');
    if (voiceBarMuteBtn) {
      voiceBarMuteBtn.addEventListener('click', () => {
        if (window.LumaSpeech && window.LumaSpeech.isSilenced) {
          if (window.LumaVoiceCommander) window.LumaVoiceCommander.executeResume();
          voiceBarMuteBtn.textContent = 'SILENCE';
        } else {
          if (window.LumaVoiceCommander) window.LumaVoiceCommander.executeStop();
          voiceBarMuteBtn.textContent = 'RESUME';
        }
      });
    }

    // Header SOS button
    const headerSosBtn = document.getElementById('headerSosBtn');
    if (headerSosBtn) {
      headerSosBtn.addEventListener('click', () => {
        this.openEmergencyModal();
      });
    }
  }

  bindWelcomeScreen() {
    const startBtn = document.getElementById('startAssistanceBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.switchScreen('screen-permission');
      });
    }

    const audioTourBtn = document.getElementById('welcomeAudioTourBtn');
    if (audioTourBtn) {
      audioTourBtn.addEventListener('click', () => {
        const tourMessage = "Welcome to LUMA Guide AI, your intelligent companion for the world around you. Powered by camera perception and voice guidance, LUMA prioritizes critical safety information such as stairs and approaching vehicles. Tap 'Start Assistance' to activate live guidance.";
        window.LumaSpeech.speak(tourMessage, 'critical');
      });
    }

    // Blind Voice Navigation Card (Tap to Activate & Speak Orientation)
    const blindCard = document.getElementById('blindVoiceCard');
    if (blindCard) {
      blindCard.addEventListener('click', () => {
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.startListening();
        }
        if (window.LumaSpeech) {
          window.LumaSpeech.speak("Voice Control is now active. You can speak commands hands-free. Say 'Start' to turn on the camera, say 'Stop' to silence, or say 'Help' for a list of commands.", "critical");
        }
      });
    }
  }

  bindPermissionScreen() {
    const allowBtn = document.getElementById('allowCameraBtn');
    if (allowBtn) {
      allowBtn.addEventListener('click', async () => {
        this.switchScreen('screen-live');
        const success = await window.LumaCamera.startRealCamera();
        if (success) {
          window.LumaSpeech.speak("Live assistance active. Rear camera monitoring environment.", "critical");
        }
      });
    }

    const simBtn = document.getElementById('useSimulationBtn');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        this.switchScreen('screen-live');
        window.LumaCamera.startSimulatedCamera();
        window.LumaSpeech.speak("Simulation demo active. Observing surroundings.", "critical");
      });
    }

    const backBtn = document.getElementById('permissionBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.switchScreen('screen-welcome');
      });
    }
  }

  bindLiveScreen() {
    // Toggle between Live Camera and Demo Simulation
    const sourceToggleBtn = document.getElementById('toggleCameraSourceBtn');
    if (sourceToggleBtn) {
      sourceToggleBtn.addEventListener('click', () => {
        window.LumaCamera.toggleSourceMode();
      });
    }

    // Camera Error Banner Action Buttons
    const retryCamBtn = document.getElementById('retryCameraBtn');
    if (retryCamBtn) {
      retryCamBtn.addEventListener('click', () => {
        window.LumaCamera.startRealCamera();
      });
    }

    const fallbackSimBtn = document.getElementById('fallbackSimBtn');
    if (fallbackSimBtn) {
      fallbackSimBtn.addEventListener('click', () => {
        window.LumaCamera.startSimulatedCamera();
      });
    }

    // Scenario picker dropdown
    const scenarioSelect = document.getElementById('scenarioSelect');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', (e) => {
        const scenario = e.target.value;
        window.LumaCamera.setScenario(scenario);
      });
    }

    // Flip Camera button
    const flipBtn = document.getElementById('flipCameraBtn');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        window.LumaCamera.flipCamera();
      });
    }

    // Pause / Resume assist button
    const toggleAssistBtn = document.getElementById('toggleAssistBtn');
    if (toggleAssistBtn) {
      toggleAssistBtn.addEventListener('click', () => {
        window.LumaCamera.toggleAssistance();
      });
    }

    // Operational Mode Toggle (Passive vs Active) in HUD
    const hudModeBtn = document.getElementById('hudModeToggleBtn');
    if (hudModeBtn) {
      hudModeBtn.addEventListener('click', () => {
        if (window.LumaContextEngine) {
          window.LumaContextEngine.toggleMode();
        }
      });
    }

    // Repeat guidance button
    const repeatBtn = document.getElementById('repeatGuidanceBtn');
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        window.LumaSpeech.repeatLast();
      });
    }

    // Big FAB: Ask LUMA
    const liveAskBtn = document.getElementById('liveAskLumaBtn');
    if (liveAskBtn) {
      liveAskBtn.addEventListener('click', () => {
        this.switchScreen('screen-ask');
        this.triggerVoiceAskFlow();
      });
    }

    // Live Mode Switchers
    const modeAssist = document.getElementById('modeBtnAssist');
    const modeRead = document.getElementById('modeBtnRead');
    const modeDescribe = document.getElementById('modeBtnDescribe');

    if (modeAssist) {
      modeAssist.addEventListener('click', () => {
        this.switchScreen('screen-live');
      });
    }

    if (modeRead) {
      modeRead.addEventListener('click', () => {
        this.switchScreen('screen-read');
      });
    }

    if (modeDescribe) {
      modeDescribe.addEventListener('click', () => {
        this.switchScreen('screen-describe');
        window.LumaSceneDescriptor.generateScene(window.LumaCamera.currentScenario);
      });
    }
  }

  bindAskScreen() {
    const closeBtn = document.getElementById('closeAskScreenBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.switchScreen('screen-live');
      });
    }

    const micBtn = document.getElementById('micToggleBtn');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        this.triggerVoiceAskFlow();
      });
    }

    // Preset question chips
    const presetChips = document.querySelectorAll('.preset-chip');
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const question = chip.dataset.question || chip.textContent.trim();
        this.processAskQuestion(question);
      });
    });

    // Replay answer button
    const replayBtn = document.getElementById('replayVoiceResponseBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        const answerText = document.getElementById('aiResponseText').textContent;
        window.LumaSpeech.speak(answerText.replace(/"/g, ''), 'critical');
      });
    }

    // Text form submission
    const form = document.getElementById('askTextForm');
    const input = document.getElementById('askTextInput');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          input.value = '';
          this.processAskQuestion(text);
        }
      });
    }
  }

  triggerVoiceAskFlow() {
    const transcriptEl = document.getElementById('userTranscriptText');
    if (transcriptEl) transcriptEl.textContent = "Listening...";

    window.LumaSpeech.startListening((transcript) => {
      if (transcriptEl) transcriptEl.textContent = `"${transcript}"`;
      this.processAskQuestion(transcript);
    });
  }

  processAskQuestion(questionText) {
    const transcriptEl = document.getElementById('userTranscriptText');
    const responseEl = document.getElementById('aiResponseText');

    if (transcriptEl) transcriptEl.textContent = `"${questionText}"`;

    // Process answer through Priority Decision Context
    const currentDecision = window.LumaCamera.latestDecision;
    const answer = window.LumaPriorityEngine.answerUserQuestion(questionText, currentDecision);

    if (responseEl) {
      responseEl.textContent = `"${answer}"`;
    }

    // Speak response
    window.LumaSpeech.speak(answer, 'critical');

    // Log in history
    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'voice',
        priority: 'info',
        title: `🎙️ Asked: "${questionText}"`,
        description: `"${answer}"`,
        distance: currentDecision ? currentDecision.distance : '',
        direction: currentDecision ? currentDecision.direction : ''
      });
    }
  }

  bindReadScreen() {
    const closeBtn = document.getElementById('closeReadScreenBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.switchScreen('screen-live');
      });
    }

    const scanBtn = document.getElementById('ocrScanNowBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        const spoken = await window.LumaOCR.scan();
        window.LumaSpeech.speak(spoken, 'critical');
      });
    }

    const readAloudBtn = document.getElementById('ocrReadAloudBtn');
    if (readAloudBtn) {
      readAloudBtn.addEventListener('click', () => {
        window.LumaOCR.readAloud();
      });
    }

    // Sample sign chips
    const sampleChips = document.querySelectorAll('.sample-sign-chip');
    sampleChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const title = chip.dataset.title;
        const sub = chip.dataset.sub;
        const speech = window.LumaOCR.setText(title, sub);
        window.LumaSpeech.speak(speech, 'critical');
      });
    });
  }

  bindDescribeScreen() {
    const closeBtn = document.getElementById('closeDescribeScreenBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.switchScreen('screen-live');
      });
    }

    const narrateBtn = document.getElementById('narrateSceneBtn');
    if (narrateBtn) {
      narrateBtn.addEventListener('click', () => {
        window.LumaSceneDescriptor.readAloud();
      });
    }

    const refreshBtn = document.getElementById('refreshSceneBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        window.LumaSceneDescriptor.generateScene(window.LumaCamera.currentScenario);
        window.LumaSceneDescriptor.readAloud();
      });
    }
  }

  bindHistoryScreen() {
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        window.LumaHistory.clear();
      });
    }

    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter || 'all';
        window.LumaHistory.setFilter(filter);
      });
    });
  }

  bindSettingsScreen() {
    const voiceGuidance = document.getElementById('settingVoiceGuidance');
    const voiceSpeed = document.getElementById('settingVoiceSpeed');
    const voiceSpeedVal = document.getElementById('voiceSpeedVal');
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    const sensitivity = document.getElementById('settingSensitivity');
    const detectionMode = document.getElementById('settingDetectionMode');
    const sonarRadar = document.getElementById('settingSonarRadar');
    const haptics = document.getElementById('settingHaptics');
    const highContrast = document.getElementById('settingHighContrast');
    const language = document.getElementById('settingLanguage');

    if (voiceGuidance) {
      voiceGuidance.addEventListener('change', (e) => {
        window.LumaSettings.set('voiceGuidance', e.target.checked);
      });
    }

    if (voiceSpeed) {
      voiceSpeed.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (voiceSpeedVal) voiceSpeedVal.textContent = `${val.toFixed(1)}×`;
        window.LumaSettings.set('voiceSpeed', val);
      });
    }

    if (testVoiceBtn) {
      testVoiceBtn.addEventListener('click', () => {
        window.LumaSpeech.speak("This is a voice preview for LUMA Guide AI.", "critical");
      });
    }

    if (sensitivity) {
      sensitivity.addEventListener('change', (e) => {
        window.LumaSettings.set('sensitivity', e.target.value);
      });
    }

    if (detectionMode) {
      detectionMode.addEventListener('change', (e) => {
        window.LumaSettings.set('detectionMode', e.target.value);
      });
    }

    const operationalMode = document.getElementById('settingOperationalMode');
    if (operationalMode) {
      operationalMode.addEventListener('change', (e) => {
        if (window.LumaContextEngine) {
          window.LumaContextEngine.setMode(e.target.value, true);
        }
      });
    }

    if (sonarRadar) {
      sonarRadar.addEventListener('change', (e) => {
        window.LumaSettings.set('sonarRadar', e.target.checked);
      });
    }

    if (haptics) {
      haptics.addEventListener('change', (e) => {
        window.LumaSettings.set('haptics', e.target.checked);
      });
    }

    if (highContrast) {
      highContrast.addEventListener('change', (e) => {
        document.body.classList.toggle('high-contrast', e.target.checked);
        window.LumaSettings.set('highContrast', e.target.checked);
      });
    }

    if (language) {
      language.addEventListener('change', (e) => {
        window.LumaSettings.set('language', e.target.value);
      });
    }
  }

  bindEmergencyModal() {
    const modal = document.getElementById('modal-emergency');
    const cancelBtn = document.getElementById('cancelEmergencyBtn');
    const callBtn = document.getElementById('confirmEmergencyBtn');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeEmergencyModal();
      });
    }

    if (callBtn) {
      callBtn.addEventListener('click', () => {
        this.closeEmergencyModal();
        alert("SIMULATED EMERGENCY CALL:\nDialing Emergency Contact...\nCoordinates: 37.7749° N, 122.4194° W dispatched.");
      });
    }
  }

  openEmergencyModal() {
    const modal = document.getElementById('modal-emergency');
    const countEl = document.getElementById('countdownNumber');
    if (!modal) return;

    modal.classList.remove('hidden');
    this.emergencyCount = 5;
    if (countEl) countEl.textContent = this.emergencyCount;

    // Siren alarm
    window.LumaSonar.playEmergencySiren();
    window.LumaSpeech.speak("Emergency assistance initiated. 5 seconds to cancel.", "critical");

    if (this.emergencyInterval) clearInterval(this.emergencyInterval);
    this.emergencyInterval = setInterval(() => {
      this.emergencyCount--;
      if (countEl) countEl.textContent = this.emergencyCount;
      window.LumaSonar.playEmergencySiren();

      if (this.emergencyCount <= 0) {
        clearInterval(this.emergencyInterval);
        this.closeEmergencyModal();
        alert("SIMULATED EMERGENCY CALL:\nEmergency contact contacted. Location dispatched.");
      }
    }, 1000);
  }

  closeEmergencyModal() {
    const modal = document.getElementById('modal-emergency');
    if (modal) modal.classList.add('hidden');
    if (this.emergencyInterval) {
      clearInterval(this.emergencyInterval);
      this.emergencyInterval = null;
    }
    window.LumaSpeech.speak("Emergency alert cancelled.", "normal");
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // 'S': STOP VOICE IMMEDIATELY
      if ((e.key === 's' || e.key === 'S') && e.target.tagName !== 'INPUT') {
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.executeStop();
        }
      }
      // 'H': Read help voice commands
      else if ((e.key === 'h' || e.key === 'H') && e.target.tagName !== 'INPUT') {
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.executeHelp();
        }
      }
      // Spacebar: Trigger Ask LUMA voice recognition
      else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.switchScreen('screen-ask');
        this.triggerVoiceAskFlow();
      }
      // 'R': Repeat last guidance
      else if ((e.key === 'r' || e.key === 'R') && e.target.tagName !== 'INPUT') {
        window.LumaSpeech.repeatLast();
      }
      // 'C': Toggle high contrast
      else if ((e.key === 'c' || e.key === 'C') && e.target.tagName !== 'INPUT') {
        const isHigh = document.body.classList.toggle('high-contrast');
        window.LumaSettings.set('highContrast', isHigh);
      }
      // 'M': Toggle audio sonar mute
      else if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') {
        window.LumaSonar.toggleMute();
      }
      // 'P': Toggle Passive vs Active mode
      else if ((e.key === 'p' || e.key === 'P') && e.target.tagName !== 'INPUT') {
        if (window.LumaContextEngine) {
          window.LumaContextEngine.toggleMode();
        }
      }
      // 'Escape': Return to live screen or close modal
      else if (e.key === 'Escape') {
        this.closeEmergencyModal();
        if (this.currentScreen !== 'screen-live') {
          this.switchScreen('screen-live');
        }
      }
    });

    // BLIND ACCESSIBILITY GESTURE:
    // 1. First tap anywhere initiates microphone listening!
    // 2. Single tap anywhere while LUMA is speaking instantly stops speech!
    document.addEventListener('click', (e) => {
      // Auto-start continuous voice listening on first user interaction
      if (window.LumaVoiceCommander && !window.LumaVoiceCommander.isListening && !window.LumaVoiceCommander.isManualMuted) {
        window.LumaVoiceCommander.startListening();
      }

      // If LUMA is currently speaking, tapping screen acts as physical STOP
      if (window.LumaSpeech && window.LumaSpeech.isSpeaking && e.target.tagName !== 'INPUT' && !e.target.closest('button')) {
        window.LumaVoiceCommander.executeStop();
      }
    });
  }

  applyInitialSettings() {
    const settings = window.LumaSettings.settings;
    if (settings.highContrast) {
      document.body.classList.add('high-contrast');
      const toggle = document.getElementById('settingHighContrast');
      if (toggle) toggle.checked = true;
    }

    const voiceSpeed = document.getElementById('settingVoiceSpeed');
    const voiceSpeedVal = document.getElementById('voiceSpeedVal');
    if (voiceSpeed && settings.voiceSpeed) {
      voiceSpeed.value = settings.voiceSpeed;
      if (voiceSpeedVal) voiceSpeedVal.textContent = `${settings.voiceSpeed}×`;
    }

    // Render initial history timeline
    if (window.LumaHistory) {
      window.LumaHistory.render();
    }
  }
}

// Instantiate App
window.LumaApp = new LumaApp();
