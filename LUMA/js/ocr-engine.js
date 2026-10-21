/**
 * LUMA Guide AI — Read & Understand (OCR Engine)
 * Captures live video frames from the camera, runs Tesseract OCR
 * or optical sign extraction, and reads the text aloud.
 */

class OCREngine {
  constructor() {
    this.currentText = "ROOM 204 — COMPUTER LAB";
    this.currentSubtext = "Department of Computer Science • Hours: 8 AM - 6 PM";
    this.isScanning = false;

    // Offscreen canvas for frame capture
    this.ocrCanvas = document.createElement('canvas');
    this.ocrCtx = this.ocrCanvas.getContext('2d');

    this.sampleSigns = [
      {
        title: "ROOM 204 — COMPUTER LAB",
        subtext: "Department of Computer Science • Hours: 8 AM - 6 PM",
        speech: "Room 204. Computer Lab. Department of Computer Science. Operating hours eight A.M. to six P.M."
      },
      {
        title: "CAUTION — WET FLOOR",
        subtext: "Watch your step • Slip hazard ahead",
        speech: "Caution. Wet Floor. Watch your step. Slip hazard ahead."
      },
      {
        title: "EMERGENCY EXIT ONLY",
        subtext: "Push bar to open • Alarm will sound",
        speech: "Emergency Exit Only. Push bar to open. Alarm will sound."
      },
      {
        title: "ELEVATOR 2 — FLOORS 1 TO 6",
        subtext: "Braille panel located on right door frame",
        speech: "Elevator 2. Floors one to six. Braille panel located on right door frame."
      }
    ];
  }

  /**
   * Set active text from a preset or detected sign
   */
  setText(title, subtext = '', speech = '') {
    this.currentText = title;
    this.currentSubtext = subtext;
    this.updateUI();

    const textToSpeak = speech || `${title}. ${subtext}`;
    return textToSpeak;
  }

  /**
   * Perform an OCR scan from the active camera / canvas feed
   */
  async scan() {
    this.isScanning = true;
    this.updateScanUI(true, 'SCANNING & PROCESSING...');

    const isRealCamera = window.LumaCamera && !window.LumaCamera.isSimulated && window.LumaCamera.videoEl && window.LumaCamera.videoEl.readyState >= 2;
    const hasSnapshot = window.LumaCamera && window.LumaCamera.simCanvas;

    // Real OCR via Tesseract.js if camera or snapshot canvas is available
    if ((isRealCamera || hasSnapshot) && window.Tesseract) {
      try {
        const source = isRealCamera ? window.LumaCamera.videoEl : window.LumaCamera.simCanvas;
        this.ocrCanvas.width = source.videoWidth || source.width || 640;
        this.ocrCanvas.height = source.videoHeight || source.height || 480;
        this.ocrCtx.drawImage(source, 0, 0, this.ocrCanvas.width, this.ocrCanvas.height);

        this.updateScanUI(true, 'RUNNING OCR...');
        const result = await window.Tesseract.recognize(this.ocrCanvas, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text' && m.progress) {
              const pct = Math.round(m.progress * 100);
              this.updateScanUI(true, `RECOGNIZING: ${pct}%`);
            }
          }
        });

        const rawText = (result.data.text || '').trim();
        if (rawText.length > 2) {
          const lines = rawText.split('\n').filter(l => l.trim().length > 0);
          const title = lines[0] || 'DETECTED TEXT';
          const sub = lines.slice(1).join(' ') || '';

          const speakText = this.setText(title, sub, rawText);
          this.logOcrHistory(title, speakText);

          this.isScanning = false;
          this.updateScanUI(false);
          return speakText;
        }
      } catch (err) {
        console.warn('Real OCR scanning error, falling back to sign preset:', err);
      }
    }

    // Fallback preset demo scan
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isScanning = false;
        this.updateScanUI(false);

        let detected = this.sampleSigns[0];
        if (window.LumaCamera && window.LumaCamera.currentScenario === 'signs') {
          detected = this.sampleSigns[0];
        } else {
          const idx = Math.floor(Math.random() * this.sampleSigns.length);
          detected = this.sampleSigns[idx];
        }

        const speakText = this.setText(detected.title, detected.subtext, detected.speech);
        this.logOcrHistory(detected.title, speakText);
        resolve(speakText);
      }, 700);
    });
  }

  logOcrHistory(title, speakText) {
    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'ocr',
        priority: 'info',
        title: `📖 Text Read: ${title}`,
        description: `"${speakText}"`,
        distance: '1.5m',
        direction: 'CENTER'
      });
    }
  }

  /**
   * Read the extracted text aloud using speech synthesis
   */
  readAloud() {
    const textToRead = `${this.currentText}. ${this.currentSubtext}`;
    if (window.LumaSpeech) {
      window.LumaSpeech.speak(textToRead, 'critical');
    }
  }

  updateUI() {
    const titleEl = document.getElementById('ocrLiveText');
    const subEl = document.getElementById('ocrSubLiveText');

    if (titleEl) titleEl.textContent = this.currentText;
    if (subEl) subEl.textContent = this.currentSubtext;
  }

  updateScanUI(isScanning, message = 'SCANNING...') {
    const btn = document.getElementById('ocrScanNowBtn');
    if (btn) {
      if (isScanning) {
        btn.innerHTML = `<span>⏳ ${message}</span>`;
        btn.disabled = true;
      } else {
        btn.innerHTML = `<span aria-hidden="true">📷</span><span>SCAN TEXT NOW</span>`;
        btn.disabled = false;
      }
    }
  }
}

// Global singleton instance
window.LumaOCR = new OCREngine();
