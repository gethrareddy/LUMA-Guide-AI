// Centralized, safe vibration helper that strictly enforces zero vibration on home screen
window.lumaVibrate = function(pattern) {
  if (!navigator.vibrate) return;
  if (window.LumaSettings && !window.LumaSettings.get('haptics')) return;
  // Strictly prevent physical vibrations on welcome / home screen
  const welcomeScreen = document.getElementById('screen-welcome');
  if (welcomeScreen && welcomeScreen.classList.contains('screen-active')) return;
  if (window.LumaApp && window.LumaApp.currentScreen === 'screen-welcome') return;
  try {
    navigator.vibrate(pattern);
  } catch (e) {}
};

class LumaApp {
  constructor() {
    this.currentScreen = 'screen-welcome';
    this.emergencyInterval = null;
    this.emergencyCount = 5;

    document.addEventListener('DOMContentLoaded', () => {
      this.initElements();
      this.bindNavigation();
      this.bindHeaderActions();
      this.bindMenuBar();
      this.bindAuthModal();
      this.bindSecurityBanner();
      this.bindMobileGestures();
      this.bindCameraSnapshot();
      this.bindWelcomeScreen();
      this.bindPermissionScreen();
      this.bindLiveScreen();
      this.bindAskScreen();
      this.bindReadScreen();
      this.bindDescribeScreen();
      this.bindHistoryScreen();
      this.bindSettingsScreen();
      this.bindNavScreen();
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

    if (this.screens) {
      this.screens.forEach(s => {
        s.classList.remove('screen-active');
      });
    }

    const targetScreen = document.getElementById(targetScreenId);
    if (targetScreen) {
      targetScreen.classList.add('screen-active');
      this.currentScreen = targetScreenId;
    }

    // Update bottom nav active tab
    if (this.navTabs) {
      this.navTabs.forEach(tab => {
        if (tab.dataset && tab.dataset.target === targetScreenId) {
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
        } else {
          tab.classList.remove('active');
          tab.setAttribute('aria-selected', 'false');
        }
      });
    }

    // Mobile UX requirement: During Live Assistance, hide bottom nav to dedicate full screen to camera
    if (this.bottomNav) {
      if (targetScreenId === 'screen-live') {
        this.bottomNav.classList.add('nav-hidden');
      } else {
        this.bottomNav.classList.remove('nav-hidden');
      }
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

  /**
   * Menu Bar & Slide-Out Drawer Controls
   */
  bindMenuBar() {
    const menuBtn = document.getElementById('mainMenuBtn');
    const drawer = document.getElementById('sideMenuDrawer');
    const overlay = document.getElementById('sideMenuOverlay');
    const closeBtn = document.getElementById('closeMenuBtn');

    const openMenu = () => {
      if (drawer) drawer.classList.add('drawer-open');
      if (overlay) overlay.classList.remove('hidden');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      if (drawer) drawer.classList.remove('drawer-open');
      if (overlay) overlay.classList.add('hidden');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    };

    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (drawer && drawer.classList.contains('drawer-open')) {
          closeMenu();
        } else {
          openMenu();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    if (overlay) {
      overlay.addEventListener('click', closeMenu);
    }

    // Drawer item navigation links
    const drawerItems = document.querySelectorAll('.drawer-item');
    drawerItems.forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.target;
        closeMenu();
        if (target) {
          if (target === 'screen-live' && !window.LumaCamera.isAssistanceRunning) {
            window.LumaCamera.startSimulatedCamera();
          }
          this.switchScreen(target);
        }
      });
    });

    // Drawer user account card & nav item
    const drawerAccountCard = document.getElementById('drawerAccountCard');
    const drawerAuthBtn = document.getElementById('drawerAuthActionBtn');
    const drawerAccountNavItem = document.getElementById('drawerAccountNavItem');
    
    if (drawerAccountCard) {
      drawerAccountCard.addEventListener('click', () => {
        closeMenu();
        this.openAuthModal();
      });
    }
    if (drawerAuthBtn) {
      drawerAuthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        this.openAuthModal();
      });
    }
    if (drawerAccountNavItem) {
      drawerAccountNavItem.addEventListener('click', () => {
        closeMenu();
        this.openAuthModal();
      });
    }

    // Drawer quick accessibility toggles
    const drawerContrast = document.getElementById('drawerContrastToggle');
    if (drawerContrast) {
      drawerContrast.addEventListener('click', () => {
        const isHigh = document.body.classList.toggle('high-contrast');
        window.LumaSettings.set('highContrast', isHigh);
        if (window.LumaSpeech) {
          window.LumaSpeech.speak(`High contrast mode ${isHigh ? 'enabled' : 'disabled'}`, 'normal');
        }
      });
    }

    const drawerVoice = document.getElementById('drawerVoiceToggle');
    if (drawerVoice) {
      drawerVoice.addEventListener('click', () => {
        const current = window.LumaSettings.get('voiceGuidance') !== false;
        window.LumaSettings.set('voiceGuidance', !current);
        if (window.LumaSpeech) {
          window.LumaSpeech.speak(`Voice guidance ${!current ? 'enabled' : 'disabled'}`, 'normal');
        }
      });
    }
  }

  /**
   * User Authentication Modal & Profile Manager
   */
  bindAuthModal() {
    const modal = document.getElementById('modal-auth');
    const closeBtn = document.getElementById('closeAuthModalBtn');
    const headerAuthBtn = document.getElementById('headerAuthBtn');
    const tabLogin = document.getElementById('tabBtnLogin');
    const tabSignup = document.getElementById('tabBtnSignup');
    const formLogin = document.getElementById('authFormLogin');
    const formSignup = document.getElementById('authFormSignup');
    const alertBanner = document.getElementById('authAlertBanner');

    const showAlert = (message, isError = true) => {
      if (alertBanner) {
        alertBanner.textContent = message;
        alertBanner.className = `auth-alert-banner ${isError ? 'error' : 'success'}`;
        alertBanner.classList.remove('hidden');
      }
    };

    const hideAlert = () => {
      if (alertBanner) {
        alertBanner.classList.add('hidden');
        alertBanner.textContent = '';
      }
    };

    const setTab = (isLogin) => {
      hideAlert();
      if (isLogin) {
        if (tabLogin) { tabLogin.classList.add('active'); tabLogin.setAttribute('aria-selected', 'true'); }
        if (tabSignup) { tabSignup.classList.remove('active'); tabSignup.setAttribute('aria-selected', 'false'); }
        if (formLogin) formLogin.classList.remove('hidden');
        if (formSignup) formSignup.classList.add('hidden');
      } else {
        if (tabSignup) { tabSignup.classList.add('active'); tabSignup.setAttribute('aria-selected', 'true'); }
        if (tabLogin) { tabLogin.classList.remove('active'); tabLogin.setAttribute('aria-selected', 'false'); }
        if (formSignup) formSignup.classList.remove('hidden');
        if (formLogin) formLogin.classList.add('hidden');
      }
    };

    if (tabLogin) tabLogin.addEventListener('click', () => setTab(true));
    if (tabSignup) tabSignup.addEventListener('click', () => setTab(false));

    if (headerAuthBtn) {
      headerAuthBtn.addEventListener('click', () => {
        this.openAuthModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeAuthModal();
      });
    }

    // Close when clicking modal backdrop
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAuthModal();
      });
    }

    // Password visibility toggles
    document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const input = btn.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
          } else {
            input.type = 'password';
            btn.textContent = '👁️';
          }
        }
      });
    });

    // Login Form Submit
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        const remCheck = document.getElementById('loginRememberMe');
        if (!emailInput || !passInput) return;

        const res = window.LumaAuth.login(emailInput.value, passInput.value, remCheck ? remCheck.checked : true);
        if (res.success) {
          showAlert(`Welcome back, ${res.user.name}!`, false);
          setTimeout(() => {
            this.updateAuthUI(res.user);
            this.closeAuthModal();
          }, 600);
        } else {
          showAlert(res.message, true);
        }
      });
    }

    // Signup Form Submit
    if (formSignup) {
      formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('signupName');
        const emailInput = document.getElementById('signupEmail');
        const passInput = document.getElementById('signupPassword');
        const prefInput = document.getElementById('signupPref');
        if (!nameInput || !emailInput || !passInput) return;

        const res = window.LumaAuth.signup(
          nameInput.value,
          emailInput.value,
          passInput.value,
          prefInput ? prefInput.value : 'voice'
        );

        if (res.success) {
          showAlert(`Account created! Welcome, ${res.user.name}.`, false);
          setTimeout(() => {
            this.updateAuthUI(res.user);
            this.closeAuthModal();
          }, 600);
        } else {
          showAlert(res.message, true);
        }
      });
    }

    // Quick Demo Login Button
    const quickDemoBtn = document.getElementById('quickDemoLoginBtn');
    if (quickDemoBtn) {
      quickDemoBtn.addEventListener('click', () => {
        const res = window.LumaAuth.quickDemoLogin();
        if (res.success) {
          showAlert(`Logged in as Demo Traveler!`, false);
          setTimeout(() => {
            this.updateAuthUI(res.user);
            this.closeAuthModal();
          }, 500);
        }
      });
    }

    // Profile Logout Button
    const logoutBtn = document.getElementById('profileLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.LumaAuth.logout();
        this.updateAuthUI(null);
        setTab(true);
      });
    }

    const profileDoneBtn = document.getElementById('profileCloseBtn');
    if (profileDoneBtn) {
      profileDoneBtn.addEventListener('click', () => {
        this.closeAuthModal();
      });
    }

    // Forgot password info
    const forgotBtn = document.getElementById('forgotPwdBtn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        showAlert('Demo accounts do not require reset. Try demo login or sign up with any password.', false);
      });
    }

    // Subscribe to auth state changes
    if (window.LumaAuth) {
      window.LumaAuth.subscribe((user) => {
        this.updateAuthUI(user);
      });
    }
  }

  openAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.classList.remove('hidden');

    const user = window.LumaAuth ? window.LumaAuth.getUser() : null;
    const profileView = document.getElementById('authProfileView');
    const formLogin = document.getElementById('authFormLogin');
    const formSignup = document.getElementById('authFormSignup');
    const tabs = document.querySelector('.auth-tabs');
    const alertBanner = document.getElementById('authAlertBanner');
    if (alertBanner) alertBanner.classList.add('hidden');

    if (user) {
      if (profileView) profileView.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
      if (formSignup) formSignup.classList.add('hidden');
      if (tabs) tabs.classList.add('hidden');
      this.populateProfile(user);
    } else {
      if (profileView) profileView.classList.add('hidden');
      if (tabs) tabs.classList.remove('hidden');
      if (formLogin) formLogin.classList.remove('hidden');
      if (formSignup) formSignup.classList.add('hidden');
    }
  }

  closeAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
  }

  updateAuthUI(user) {
    const headerAuthLabel = document.getElementById('headerAuthLabel');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserStatus = document.getElementById('drawerUserStatus');
    const drawerAuthActionBtn = document.getElementById('drawerAuthActionBtn');
    const drawerAccountNavLabel = document.getElementById('drawerAccountNavLabel');

    if (user) {
      if (headerAuthLabel) headerAuthLabel.textContent = user.name.split(' ')[0];
      if (drawerUserName) drawerUserName.textContent = user.name;
      if (drawerUserStatus) drawerUserStatus.textContent = user.role || 'Active Traveler';
      if (drawerAuthActionBtn) drawerAuthActionBtn.textContent = 'Account';
      if (drawerAccountNavLabel) drawerAccountNavLabel.textContent = user.name;
      this.populateProfile(user);
    } else {
      if (headerAuthLabel) headerAuthLabel.textContent = 'Login';
      if (drawerUserName) drawerUserName.textContent = 'Guest Traveler';
      if (drawerUserStatus) drawerUserStatus.textContent = 'Tap to Log In / Sign Up';
      if (drawerAuthActionBtn) drawerAuthActionBtn.textContent = 'Log In';
      if (drawerAccountNavLabel) drawerAccountNavLabel.textContent = 'Login / Sign Up';
    }
  }

  populateProfile(user) {
    if (!user) return;
    const nameEl = document.getElementById('profileFullName');
    const emailEl = document.getElementById('profileEmail');
    const badgeEl = document.getElementById('profilePrefBadge');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (badgeEl) {
      const modeNames = {
        voice: '🎙️ Voice-First Navigation',
        contrast: '🎨 High Contrast (WCAG AAA)',
        screenreader: '🗣️ Screen Reader Mode',
        standard: 'Standard OLED'
      };
      badgeEl.textContent = modeNames[user.preference] || 'Voice-First Mode';
    }
  }

  /**
   * Mobile Security Notice Banner (HTTPS guidance for camera/mic/GPS)
   */
  bindSecurityBanner() {
    const banner = document.getElementById('mobileSecurityBanner');
    const switchBtn = document.getElementById('mobileSecuritySwitchBtn');
    const closeBtn = document.getElementById('closeSecurityBannerBtn');

    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isHttps = location.protocol === 'https:';
    const isFile = location.protocol === 'file:';
    const isSecure = window.isSecureContext || isHttps || isLocalhost || isFile;

    if (!isSecure && banner && !sessionStorage.getItem('dismiss_sec_banner')) {
      banner.classList.remove('hidden');
    }

    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        window.location.href = `https://${location.hostname}:8443${location.pathname}${location.search}`;
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (banner) banner.classList.add('hidden');
        sessionStorage.setItem('dismiss_sec_banner', '1');
      });
    }
  }

  /**
   * Mobile Touch Gestures & Voice Interaction
   */
  bindMobileGestures() {
    // Unlock audio and voice on first user touch anywhere
    const unlockOnFirstTouch = () => {
      if (window.LumaSpeech) window.LumaSpeech.unlockAudio();
      if (window.LumaSonar) window.LumaSonar.initAudio();
      if (window.LumaVoiceCommander && !window.LumaVoiceCommander.isListening && !window.LumaVoiceCommander.isManualMuted) {
        window.LumaVoiceCommander.startListening();
      }
      document.removeEventListener('touchstart', unlockOnFirstTouch);
      document.removeEventListener('pointerdown', unlockOnFirstTouch);
    };

    document.addEventListener('touchstart', unlockOnFirstTouch, { passive: true });
    document.addEventListener('pointerdown', unlockOnFirstTouch, { passive: true });

    // Floating voice bar click toggles voice command listening
    const voiceBar = document.getElementById('floatingVoiceBar');
    if (voiceBar) {
      voiceBar.addEventListener('click', (e) => {
        if (e.target.closest('#voiceBarMuteToggleBtn')) return;
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.toggleListening();
        }
      });
    }

    // Double-tap screen on live camera assistance to repeat last voice announcement
    let lastTap = 0;
    const cameraViewport = document.getElementById('cameraViewport');
    if (cameraViewport) {
      cameraViewport.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 350 && tapLength > 50) {
          e.preventDefault();
          if (window.LumaSpeech) window.LumaSpeech.repeatLast();
        }
        lastTap = currentTime;
      });
    }
  }

  /**
   * Smartphone Camera Snapshot Photo Fallback
   */
  bindCameraSnapshot() {
    let fileInput = document.getElementById('cameraPhotoFallbackInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'cameraPhotoFallbackInput';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file && window.LumaCamera) {
        window.LumaCamera.handleSnapshotPhoto(file);
      }
    });
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

    // Photo Snapshot Trigger (for smartphones)
    const triggerSnapshot = () => {
      const fileInput = document.getElementById('cameraPhotoFallbackInput');
      if (fileInput) fileInput.click();
    };

    const hudSnapshotBtn = document.getElementById('hudSnapshotBtn');
    if (hudSnapshotBtn) {
      hudSnapshotBtn.addEventListener('click', triggerSnapshot);
    }

    const cameraSnapshotBtn = document.getElementById('cameraSnapshotBtn');
    if (cameraSnapshotBtn) {
      cameraSnapshotBtn.addEventListener('click', triggerSnapshot);
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

  bindNavScreen() {
    // 1. Home Screen Welcome Cards
    const cardNearby = document.getElementById('cardNearbyPlaces');
    if (cardNearby) {
      cardNearby.addEventListener('click', () => {
        this.switchScreen('screen-nav');
        if (window.LumaNavEngine) {
          window.LumaNavEngine.findNearby('pharmacy');
        }
      });
      cardNearby.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.switchScreen('screen-nav');
          if (window.LumaNavEngine) window.LumaNavEngine.findNearby('pharmacy');
        }
      });
    }

    const cardNav = document.getElementById('cardNavigate');
    if (cardNav) {
      cardNav.addEventListener('click', () => {
        this.switchScreen('screen-nav');
        const input = document.getElementById('navSearchInput');
        if (input) {
          input.focus();
        }
        if (window.LumaSpeech) {
          window.LumaSpeech.speak("LUMA Navigation active. Where would you like to go? Say 'Take me to' followed by a destination, or select a category below.", "normal");
        }
      });
      cardNav.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.switchScreen('screen-nav');
          const input = document.getElementById('navSearchInput');
          if (input) input.focus();
        }
      });
    }

    // 2. GPS Badge (Location Permission / Status Refresh)
    const gpsBadge = document.getElementById('navGpsBadge');
    if (gpsBadge) {
      gpsBadge.addEventListener('click', () => {
        if (window.LumaNavEngine) {
          window.LumaNavEngine.requestCurrentPosition();
          if (window.LumaSpeech) {
            window.LumaSpeech.speak(`Acquiring GPS position. Current location: ${window.LumaNavEngine.locationName}`, "normal");
          }
        }
      });
    }

    // 3. Category Chips
    const catChips = document.querySelectorAll('.nearby-cat-chip');
    catChips.forEach(chip => {
      chip.addEventListener('click', () => {
        catChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cat = chip.dataset.category || 'pharmacy';
        if (window.LumaNavEngine) {
          window.LumaNavEngine.findNearby(cat);
        }
      });
    });

    // 4. Voice Search Button in Search Bar
    const navVoiceSearchBtn = document.getElementById('navVoiceSearchBtn');
    if (navVoiceSearchBtn) {
      navVoiceSearchBtn.addEventListener('click', () => {
        if (window.LumaVoiceCommander) {
          window.LumaVoiceCommander.startListening();
        }
        if (window.LumaSpeech) {
          window.LumaSpeech.speak("Say your destination. For example, 'Take me to Apollo Pharmacy' or 'Find the nearest hospital'.", "normal");
        }
      });
    }

    // 5. Search Form
    const navForm = document.getElementById('navSearchForm');
    const navInput = document.getElementById('navSearchInput');
    if (navForm && navInput) {
      navForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = navInput.value.trim();
        if (val) {
          if (val.toLowerCase().startsWith('take me to') || val.toLowerCase().startsWith('navigate to')) {
            const clean = val.replace(/^(take me to|navigate to)\s+/i, '');
            if (window.LumaNavEngine) window.LumaNavEngine.directNavigateTo(clean);
          } else {
            if (window.LumaNavEngine) window.LumaNavEngine.findNearby(val);
          }
          navInput.blur();
        }
      });
    }

    // 6. Active Route Controls
    const simStepBtn = document.getElementById('simStepBtn');
    if (simStepBtn) {
      simStepBtn.addEventListener('click', () => {
        if (window.LumaNavEngine) {
          window.LumaNavEngine.simulateStepForward(25);
        }
      });
    }

    const repeatStepBtn = document.getElementById('repeatStepBtn');
    if (repeatStepBtn) {
      repeatStepBtn.addEventListener('click', () => {
        if (window.LumaNavEngine) {
          window.LumaNavEngine.repeatCurrentStep();
        }
      });
    }

    const stopRouteBtn = document.getElementById('stopRouteBtn');
    if (stopRouteBtn) {
      stopRouteBtn.addEventListener('click', () => {
        if (window.LumaNavEngine) {
          window.LumaNavEngine.stopNavigation();
        }
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
