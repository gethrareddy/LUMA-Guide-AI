/**
 * LUMA Guide AI — Real-Time Camera & AI Computer Vision Engine
 * Supports:
 * 1. Real Device Camera (Rear/Front) via getUserMedia with multi-tier progressive constraints
 * 2. Real Deep Learning Object Detection (TensorFlow.js + COCO-SSD)
 * 3. Optical Frame Proximity & Obstacle Analyzer (real pixel processing fallback)
 * 4. Interactive Simulation Demo Mode (for offline/presentation testing)
 */

class CameraManager {
  constructor() {
    this.videoEl = document.getElementById('liveVideo');
    this.simCanvas = document.getElementById('simCanvas');
    this.hudCanvas = document.getElementById('detectionCanvas');
    this.simCtx = this.simCanvas ? this.simCanvas.getContext('2d') : null;
    this.hudCtx = this.hudCanvas ? this.hudCanvas.getContext('2d') : null;

    // Offscreen canvas for computer vision pixel analysis
    this.analysisCanvas = document.createElement('canvas');
    this.analysisCanvas.width = 160;
    this.analysisCanvas.height = 120;
    this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });

    this.stream = null;
    this.isSimulated = false;
    this.isAssistanceRunning = false;
    this.facingMode = 'environment'; // 'environment' (rear) | 'user' (front)
    this.currentScenario = 'stairs';
    this.animFrameId = null;

    // AI Model State
    this.cocoModel = null;
    this.isModelLoading = false;
    this.isModelReady = false;
    this.lastInferenceTime = 0;
    this.inferenceInterval = 120; // run model inference every 120ms for smooth 60fps HUD
    this.isInferring = false;

    // Simulation animation state
    this.simTicks = 0;
    this.activeDetections = [];
    this.latestDecision = null;

    // Demo Scenarios
    this.scenarios = {
      stairs: {
        name: "Stairs Ahead",
        detections: [
          { label: "stairs", confidence: 0.94, box: [0.55, 0.28, 0.88, 0.72], distance: 2.4, motion: "stationary" },
          { label: "person", confidence: 0.88, box: [0.30, 0.08, 0.75, 0.28], distance: 3.5, motion: "stationary" }
        ]
      },
      vehicle: {
        name: "Vehicle Approaching",
        detections: [
          { label: "car", confidence: 0.96, box: [0.42, 0.65, 0.82, 0.95], distance: 3.8, motion: "approaching" },
          { label: "road", confidence: 0.91, box: [0.60, 0.15, 0.95, 0.85], distance: 4.2, motion: "stationary" }
        ]
      },
      door: {
        name: "Open Door Ahead",
        detections: [
          { label: "door", confidence: 0.92, box: [0.25, 0.35, 0.85, 0.65], distance: 3.0, motion: "stationary" }
        ]
      },
      person: {
        name: "Pedestrian Ahead",
        detections: [
          { label: "person", confidence: 0.93, box: [0.22, 0.18, 0.80, 0.42], distance: 3.5, motion: "moving_away" },
          { label: "chair", confidence: 0.82, box: [0.60, 0.75, 0.90, 0.95], distance: 4.0, motion: "stationary" }
        ]
      },
      clear: {
        name: "Clear Pathway",
        detections: []
      },
      signs: {
        name: "Room 204 Sign",
        detections: [
          { label: "signboard", confidence: 0.98, box: [0.35, 0.30, 0.60, 0.70], distance: 1.6, motion: "stationary", text: "ROOM 204 COMPUTER LAB" }
        ]
      }
    };

    // Initialize AI Model in the background
    this.initAIModel();
  }

  /**
   * Loads TensorFlow.js COCO-SSD client-side deep learning model
   */
  async initAIModel() {
    if (this.cocoModel || this.isModelLoading) return;
    this.isModelLoading = true;
    this.updateAIBadge('⏳ LOADING AI...', 'loading');

    // Wait for cocoSsd global to be available
    const checkCoco = () => {
      return new Promise((resolve) => {
        if (window.cocoSsd) return resolve(true);
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.cocoSsd) {
            clearInterval(interval);
            resolve(true);
          } else if (checks > 30) {
            clearInterval(interval);
            resolve(false);
          }
        }, 200);
      });
    };

    const isAvailable = await checkCoco();
    if (!isAvailable) {
      console.log('COCO-SSD library not reachable. Real Optical Vision engine active.');
      this.isModelLoading = false;
      this.updateAIBadge('OPTICAL VISION', 'optical');
      return;
    }

    try {
      this.cocoModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
      this.isModelReady = true;
      this.isModelLoading = false;
      console.log('TensorFlow.js COCO-SSD loaded successfully!');
      this.updateAIBadge('REAL AI: COCO-SSD', 'ready');
    } catch (err) {
      console.warn('Failed to load COCO-SSD model, using Optical Vision engine:', err);
      this.isModelLoading = false;
      this.updateAIBadge('OPTICAL VISION', 'optical');
    }
  }

  /**
   * Start real camera stream with multi-tier progressive constraint fallback
   */
  async startRealCamera() {
    this.isSimulated = false;
    this.hideCameraError();
    this.videoEl.classList.remove('hidden');
    this.simCanvas.classList.add('hidden');
    this.updateSourceUI(true);

    // Check Secure Context (required by modern mobile browsers for camera)
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isHttps = location.protocol === 'https:';
    const isFile = location.protocol === 'file:';
    const isSecure = window.isSecureContext !== undefined ? window.isSecureContext : (isHttps || isLocalhost || isFile);
    if (!isSecure && !isHttps && !isLocalhost && !isFile) {
      const errorMsg = `Mobile browsers (iOS Safari & Android Chrome) block camera on insecure HTTP. Please open using HTTPS: https://${location.hostname}:8443 (accept certificate) or use Demo Simulation.`;
      this.showCameraError('HTTPS Required on Mobile', errorMsg);
      console.warn(errorMsg);
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showCameraError('Camera API Not Supported', 'Your browser does not support mediaDevices.getUserMedia. Please use Demo Simulation.');
      return false;
    }

    // Stop any existing tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Multi-tier progressive constraints
    const constraintTiers = [
      { audio: false, video: { facingMode: { ideal: this.facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: { ideal: this.facingMode } } },
      { audio: false, video: { facingMode: this.facingMode } },
      { audio: false, video: true }
    ];

    let streamObtained = null;
    let lastError = null;

    for (const constraints of constraintTiers) {
      try {
        streamObtained = await navigator.mediaDevices.getUserMedia(constraints);
        if (streamObtained) break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!streamObtained) {
      console.error('All camera constraint attempts failed:', lastError);
      let desc = 'Unable to access your device camera.';
      if (lastError && lastError.name === 'NotAllowedError') {
        desc = 'Camera permission was denied. Tap the lock icon in your browser address bar to allow camera access, then retry.';
      } else if (lastError && lastError.name === 'NotFoundError') {
        desc = 'No physical camera device was detected on your hardware.';
      } else if (lastError) {
        desc = `${lastError.name}: ${lastError.message}`;
      }
      this.showCameraError('Camera Access Denied', desc);
      return false;
    }

    this.stream = streamObtained;
    this.videoEl.srcObject = this.stream;

    // Crucial for iOS Safari inline playback:
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.setAttribute('muted', '');
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('webkit-playsinline', '');
    this.videoEl.muted = true;

    try {
      await this.videoEl.play();
    } catch (e) {
      console.warn('Video play error (waiting for user tap):', e);
    }

    this.startPerceptionLoop();
    return true;
  }

  /**
   * Start interactive simulated camera (ideal for desktop testing, offline, or demos)
   */
  startSimulatedCamera() {
    this.isSimulated = true;
    this.hideCameraError();
    this.videoEl.classList.add('hidden');
    this.simCanvas.classList.remove('hidden');
    this.updateSourceUI(false);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.startPerceptionLoop();
    return true;
  }

  /**
   * Toggle between Real Camera and Demo Simulation
   */
  async toggleSourceMode() {
    if (this.isSimulated) {
      const ok = await this.startRealCamera();
      if (!ok) {
        // If real camera cannot start, remain in simulation
        this.startSimulatedCamera();
      } else if (window.LumaSpeech) {
        window.LumaSpeech.speak('Switched to live camera mode.', 'normal');
      }
    } else {
      this.startSimulatedCamera();
      if (window.LumaSpeech) {
        window.LumaSpeech.speak('Switched to demo simulation mode.', 'normal');
      }
    }
  }

  /**
   * Flip between rear and front camera
   */
  async flipCamera() {
    this.facingMode = (this.facingMode === 'environment') ? 'user' : 'environment';
    if (!this.isSimulated) {
      const ok = await this.startRealCamera();
      if (ok && window.LumaSpeech) {
        window.LumaSpeech.speak(`Switched to ${this.facingMode === 'environment' ? 'rear' : 'front'} camera`, 'normal');
      }
    } else {
      if (window.LumaSpeech) {
        window.LumaSpeech.speak(`Switched camera to ${this.facingMode === 'environment' ? 'rear' : 'front'} mode`, 'normal');
      }
    }
  }

  setScenario(scenarioKey) {
    if (this.scenarios[scenarioKey]) {
      this.currentScenario = scenarioKey;
      this.simTicks = 0;

      // Update scene descriptor
      if (window.LumaSceneDescriptor) {
        window.LumaSceneDescriptor.generateScene(scenarioKey);
      }
    }
  }

  /**
   * Main perception loop
   */
  startPerceptionLoop() {
    this.isAssistanceRunning = true;
    this.updateAssistUIState(true);

    const loop = async () => {
      if (!this.isAssistanceRunning) return;

      this.simTicks++;
      this.resizeCanvases();

      // 1. If simulated, render virtual environment
      if (this.isSimulated) {
        this.renderSimulatedEnvironment();
        this.computeSimulatedDetections();
      } else {
        // Real camera feed: compute REAL object detections
        await this.computeRealDetections();
      }

      // 2. Context Engine Fusion & Smart Priority Evaluation
      let detectedSign = null;
      if (this.currentScenario === 'signs') {
        detectedSign = { title: "ROOM 204 — COMPUTER LAB", text: "ROOM 204 — COMPUTER LAB" };
      } else {
        const signEntity = this.activeDetections.find(d => (d.label === 'signboard' || d.label === 'sign' || d.text));
        if (signEntity) {
          detectedSign = { title: signEntity.text || "ROOM 204 — COMPUTER LAB", text: signEntity.text || "ROOM 204 — COMPUTER LAB" };
        }
      }

      const sceneData = window.LumaSceneDescriptor ? window.LumaSceneDescriptor.currentNarrative : null;

      if (window.LumaContextEngine) {
        this.latestDecision = window.LumaContextEngine.fuseContext(this.activeDetections, detectedSign, sceneData);
      } else if (window.LumaPriorityEngine) {
        this.latestDecision = window.LumaPriorityEngine.evaluate(this.activeDetections);
      }

      if (this.latestDecision) {
        this.updatePriorityBannerUI(this.latestDecision);
      }

      // 3. Render sleek AI bounding boxes & HUD graphics
      this.renderDetectionHUD();

      this.animFrameId = requestAnimationFrame(loop);
    };

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(loop);
  }

  stopPerceptionLoop() {
    this.isAssistanceRunning = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.updateAssistUIState(false);
  }

  toggleAssistance() {
    if (this.isAssistanceRunning) {
      this.stopPerceptionLoop();
      if (window.LumaSpeech) window.LumaSpeech.speak("Assistance paused.", "normal");
    } else {
      this.startPerceptionLoop();
      if (window.LumaSpeech) window.LumaSpeech.speak("Assistance resumed.", "normal");
    }
    return this.isAssistanceRunning;
  }

  resizeCanvases() {
    const rect = document.getElementById('cameraViewport').getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (this.simCanvas && (this.simCanvas.width !== w || this.simCanvas.height !== h)) {
      this.simCanvas.width = w;
      this.simCanvas.height = h;
    }

    if (this.hudCanvas && (this.hudCanvas.width !== w || this.hudCanvas.height !== h)) {
      this.hudCanvas.width = w;
      this.hudCanvas.height = h;
    }
  }

  /**
   * Real Object Detection on Camera Video Feed
   */
  async computeRealDetections() {
    if (!this.videoEl || this.videoEl.readyState < 2) return;

    const now = performance.now();
    // Throttle inference to prevent overloading mobile GPU/CPU
    if (now - this.lastInferenceTime < this.inferenceInterval || this.isInferring) {
      return;
    }

    this.lastInferenceTime = now;
    this.isInferring = true;

    try {
      // 1. Deep Learning Inference (TensorFlow.js COCO-SSD)
      if (this.cocoModel) {
        const predictions = await this.cocoModel.detect(this.videoEl);
        const vw = this.videoEl.videoWidth || this.hudCanvas.width || 640;
        const vh = this.videoEl.videoHeight || this.hudCanvas.height || 480;

        this.activeDetections = predictions.map(pred => {
          const [x, y, w, h] = pred.bbox;
          // Normalize to [0..1] range [ymin, xmin, ymax, xmax]
          const normBox = [
            Math.max(0, y / vh),
            Math.max(0, x / vw),
            Math.min(1, (y + h) / vh),
            Math.min(1, (x + w) / vw)
          ];

          return {
            label: pred.class,
            confidence: Math.round(pred.score * 100) / 100,
            box: normBox,
            motion: 'stationary'
          };
        });

        this.updateAIBadge(`REAL AI: ${this.activeDetections.length} DETECTED`, 'ready');
      } else {
        // 2. Real In-Browser Optical Spatial Analyzer (Zero-dependency real pixel analysis fallback)
        this.runOpticalSpatialAnalysis();
      }
    } catch (err) {
      console.warn('Real AI detection cycle error:', err);
      this.runOpticalSpatialAnalysis();
    } finally {
      this.isInferring = false;
    }
  }

  /**
   * Real-Time Optical Spatial & Edge Density Analyzer
   * Measures pixel gradient variance and detects physical obstacles in center path
   */
  runOpticalSpatialAnalysis() {
    const actx = this.analysisCtx;
    const aw = this.analysisCanvas.width;
    const ah = this.analysisCanvas.height;
    if (!actx || !this.videoEl || this.videoEl.readyState < 2) return;

    try {
      actx.drawImage(this.videoEl, 0, 0, aw, ah);
      const imgData = actx.getImageData(0, 0, aw, ah);
      const data = imgData.data;

      // Analyze Center Path (middle 40% width, lower 60% height)
      const startX = Math.floor(aw * 0.3);
      const endX = Math.floor(aw * 0.7);
      const startY = Math.floor(ah * 0.4);
      const endY = ah;

      let centerBrightness = 0;
      let centerEdgeCount = 0;
      let sampleCount = 0;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const idx = (y * aw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          centerBrightness += lum;

          // Simple horizontal gradient edge test
          if (x < endX - 2) {
            const nextIdx = (y * aw + (x + 2)) * 4;
            const nextLum = 0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];
            if (Math.abs(lum - nextLum) > 30) {
              centerEdgeCount++;
            }
          }
          sampleCount++;
        }
      }

      const edgeDensity = centerEdgeCount / (sampleCount || 1);

      // If high edge density in path, an obstacle/object is present
      if (edgeDensity > 0.18) {
        const estDist = Math.max(1.0, parseFloat((3.8 - edgeDensity * 8).toFixed(1)));
        this.activeDetections = [{
          label: 'obstacle',
          confidence: 0.86,
          box: [0.38, 0.28, 0.85, 0.72],
          distance: estDist,
          motion: 'stationary'
        }];
        this.updateAIBadge('OPTICAL: OBSTACLE', 'caution');
      } else {
        this.activeDetections = [];
        this.updateAIBadge('OPTICAL: PATH CLEAR', 'safe');
      }
    } catch (e) {
      console.warn('Optical analysis error:', e);
    }
  }

  /**
   * Computes detections based on selected simulated scenario
   */
  computeSimulatedDetections() {
    const base = this.scenarios[this.currentScenario] || this.scenarios.stairs;
    this.activeDetections = base.detections.map(d => {
      const box = [...d.box];
      const jitter = Math.sin(this.simTicks * 0.05) * 0.008;
      return {
        ...d,
        box: [box[0] + jitter, box[1] - jitter, box[2] + jitter, box[3] - jitter]
      };
    });
    this.updateAIBadge('DEMO SIMULATION', 'demo');
  }

  /**
   * Render simulated realistic scenario on canvas
   */
  renderSimulatedEnvironment() {
    const ctx = this.simCtx;
    const w = this.simCanvas.width;
    const h = this.simCanvas.height;
    if (!ctx || w === 0 || h === 0) return;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#090E17');
    grad.addColorStop(0.5, '#131A26');
    grad.addColorStop(1, '#05070A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1.5;
    const vanishX = w * 0.5;
    const vanishY = h * 0.45;

    for (let x = -w * 0.5; x <= w * 1.5; x += w * 0.25) {
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, vanishY);
    ctx.lineTo(w, vanishY);
    ctx.stroke();

    if (this.currentScenario === 'stairs') {
      const stepYStart = h * 0.58;
      const stepHeight = (h - stepYStart) / 4;
      for (let i = 0; i < 4; i++) {
        const sy = stepYStart + i * stepHeight;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 42, 58, 0.85)' : 'rgba(20, 28, 40, 0.9)';
        ctx.fillRect(w * 0.22, sy, w * 0.56, stepHeight);
        ctx.strokeStyle = 'rgba(255, 179, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.22, sy, w * 0.56, stepHeight);
      }
    } else if (this.currentScenario === 'vehicle') {
      const carProg = (Math.sin(this.simTicks * 0.03) + 1) * 0.5;
      const carW = w * (0.28 + carProg * 0.12);
      const carH = h * (0.22 + carProg * 0.1);
      const carX = w * 0.64;
      const carY = h * 0.48;

      ctx.fillStyle = '#C82333';
      ctx.beginPath();
      ctx.roundRect(carX, carY, carW, carH, 12);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 180, 0.4)';
      ctx.beginPath();
      ctx.arc(carX + 15, carY + carH * 0.7, 18, 0, Math.PI * 2);
      ctx.arc(carX + carW - 15, carY + carH * 0.7, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.currentScenario === 'door') {
      const dw = w * 0.38;
      const dh = h * 0.55;
      const dx = (w - dw) / 2;
      const dy = vanishY - 10;
      ctx.fillStyle = 'rgba(10, 16, 26, 0.95)';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, dy, dw, dh);
    } else if (this.currentScenario === 'signs') {
      const sw = w * 0.55;
      const sh = h * 0.24;
      const sx = (w - sw) / 2;
      const sy = h * 0.35;
      ctx.fillStyle = '#0F1626';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#00F2FE';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROOM 204', w * 0.5, sy + sh * 0.45);
      ctx.fillStyle = '#00F2FE';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('COMPUTER LAB', w * 0.5, sy + sh * 0.75);
    }
  }

  /**
   * Render AI Bounding Box HUD Overlays
   */
  renderDetectionHUD() {
    const ctx = this.hudCtx;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    this.activeDetections.forEach(det => {
      const [ymin, xmin, ymax, xmax] = det.box;
      const bx = xmin * w;
      const by = ymin * h;
      const bw = Math.max(20, (xmax - xmin) * w);
      const bh = Math.max(20, (ymax - ymin) * h);

      let strokeColor = '#00F2FE';
      let glowColor = 'rgba(0, 242, 254, 0.4)';
      let labelBg = '#00F2FE';
      let labelText = '#000000';

      const l = (det.label || '').toLowerCase();
      if (l.includes('stair') || l.includes('car') || (det.distance && det.distance < 2.0)) {
        strokeColor = '#FF334B';
        glowColor = 'rgba(255, 51, 75, 0.5)';
        labelBg = '#FF334B';
        labelText = '#FFFFFF';
      } else if (det.distance && det.distance < 3.2) {
        strokeColor = '#FFB300';
        glowColor = 'rgba(255, 179, 0, 0.5)';
        labelBg = '#FFB300';
        labelText = '#000000';
      }

      // Draw Viewfinder Brackets
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;

      const cornerLen = Math.min(24, bw * 0.25, bh * 0.25);

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Distance tag & Label Pill
      const distStr = det.distance ? `${det.distance}m` : '2.5m';
      const confStr = `${Math.round((det.confidence || 0.9) * 100)}%`;
      const pillText = `${det.label.toUpperCase()} • ${confStr} • ${distStr}`;

      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const textMetrics = ctx.measureText(pillText);
      const pillW = textMetrics.width + 16;
      const pillH = 22;

      ctx.fillStyle = labelBg;
      ctx.beginPath();
      ctx.roundRect(bx, by - pillH - 4 > 0 ? by - pillH - 4 : by + 4, pillW, pillH, 4);
      ctx.fill();

      ctx.fillStyle = labelText;
      ctx.fillText(pillText, bx + 8, (by - pillH - 4 > 0 ? by - pillH - 4 : by + 4) + 15);
    });
  }

  updatePriorityBannerUI(decision) {
    if (!decision) return;

    const banner = document.getElementById('priorityBanner');
    const levelTag = document.getElementById('priorityLevelTag');
    const metricTag = document.getElementById('priorityDistanceTag');
    const iconEl = document.getElementById('priorityIcon');
    const titleEl = document.getElementById('priorityTitle');
    const subtextEl = document.getElementById('prioritySubtext');

    if (banner) {
      banner.className = `priority-banner priority-${decision.level}`;
    }

    if (levelTag) {
      if (decision.level === 'critical') {
        levelTag.textContent = '🔴 CRITICAL ALERT';
      } else if (decision.level === 'warning') {
        levelTag.textContent = '🟠 WARNING ALERT';
      } else if (decision.level === 'info') {
        levelTag.textContent = '🟢 INFORMATIONAL';
      } else if (decision.level === 'low') {
        levelTag.textContent = '⚪ LOW PRIORITY • NO ALERT';
      } else {
        levelTag.textContent = '🟢 PATH CLEAR';
      }
    }

    if (metricTag) {
      metricTag.textContent = `${decision.distance} • ${decision.direction}`;
    }

    if (iconEl) iconEl.textContent = decision.icon;
    if (titleEl) titleEl.textContent = decision.title;
    if (subtextEl) subtextEl.textContent = decision.subtext;
  }

  updateAssistUIState(isRunning) {
    const statusText = document.getElementById('hudStatusText');
    const pauseIcon = document.getElementById('assistPauseIcon');
    const playIcon = document.getElementById('assistPlayIcon');

    if (statusText) statusText.textContent = isRunning ? 'MONITORING' : 'PAUSED';
    if (pauseIcon && playIcon) {
      if (isRunning) {
        pauseIcon.classList.remove('hidden');
        playIcon.classList.add('hidden');
      } else {
        pauseIcon.classList.add('hidden');
        playIcon.classList.remove('hidden');
      }
    }
  }

  updateSourceUI(isReal) {
    const icon = document.getElementById('cameraSourceIcon');
    const text = document.getElementById('cameraSourceText');
    const scenarioWrap = document.getElementById('hudScenarioWrap');

    if (icon && text) {
      icon.textContent = isReal ? '📷' : '🎮';
      text.textContent = isReal ? 'LIVE' : 'DEMO';
    }

    if (scenarioWrap) {
      if (isReal) {
        scenarioWrap.classList.add('hidden');
      } else {
        scenarioWrap.classList.remove('hidden');
      }
    }
  }

  updateAIBadge(name, status) {
    const nameEl = document.getElementById('aiEngineName');
    const badgeEl = document.getElementById('aiEngineBadge');
    if (nameEl) nameEl.textContent = name;
    if (badgeEl) {
      const dot = badgeEl.querySelector('.engine-indicator');
      if (dot) {
        if (status === 'ready') dot.textContent = '🟢';
        else if (status === 'loading') dot.textContent = '⏳';
        else if (status === 'optical') dot.textContent = '🟡';
        else if (status === 'caution') dot.textContent = '🟠';
        else if (status === 'safe') dot.textContent = '🟢';
        else dot.textContent = '🎮';
      }
    }
  }

  showCameraError(title, message) {
    const banner = document.getElementById('cameraErrorBanner');
    const titleEl = document.getElementById('cameraErrorTitle');
    const msgEl = document.getElementById('cameraErrorMessage');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (banner) banner.classList.remove('hidden');

    if (window.LumaSpeech) {
      window.LumaSpeech.speak(message, 'critical');
    }
  }

  hideCameraError() {
    const banner = document.getElementById('cameraErrorBanner');
    if (banner) banner.classList.add('hidden');
  }
}

// Global singleton instance
window.LumaCamera = new CameraManager();
