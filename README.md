# LUMA Guide AI
### Live User Monitoring & Assistance for Visually Impaired Users

> **"Intelligent assistance for the world around you."**

---

## 1. What Makes LUMA Guide AI Different?

Standard computer vision applications for accessibility often frustrate visually impaired users by simply converting every detected camera object into spoken audio:
> *"Person detected. Chair detected. Table detected. Wall detected. Door detected. Car detected."*

This creates auditory chaos, cognitive fatigue, and dangerously masks urgent hazards. 

**LUMA Guide AI** is built on seven fundamental design pillars:

### 1. 🧠 Decisions Over Detections
Instead of merely listing objects, LUMA follows:
$$\textbf{Camera} \longrightarrow \textbf{Detection} \longrightarrow \textbf{Context Analysis} \longrightarrow \textbf{Risk / Priority} \longrightarrow \textbf{Guidance}$$
- **Standard system:** *"Car detected."*
- **LUMA:** *"Stop. A vehicle is approaching from your right, approximately 3.8 meters away. Please wait."*

### 2. 🚨 4-Tier Priority Classification
LUMA classifies environmental input into four strictly arbitrated urgency levels to eliminate information overload:

| Priority Level | Example Hazard | Voice & Multi-Sensory Response |
| :--- | :--- | :--- |
| 🔴 **Critical** | Approaching vehicle, sudden drop-off / hole | Immediate voice alert, audio priority interrupt, pulsed danger earcon beacon |
| 🟠 **Warning** | Stairs ahead, obstacles directly in walking path | Clear directional warning with distance, slow-down guidance |
| 🟢 **Informational** | Doorway nearby, elevator, signs | Optional / polite notification (spoken once upon transition) |
| ⚪ **Low** | Chair 4m away, distant walls, background items | **NO ALERT (Silent)** — visual HUD only, zero speech clutter |

### 3. 📍 Direction + Distance + Object (WHAT + WHERE + HOW FAR + HOW IMPORTANT)
Rather than abstract labels, every LUMA alert combines:
- **WHAT:** The physical hazard or landmark.
- **WHERE:** Lateral bearing (`LEFT`, `FRONT / CENTER`, `RIGHT`).
- **HOW FAR:** Real-time estimated proximity in meters.
- **HOW IMPORTANT:** Actionable guidance (`"Please wait"`, `"Slow down"`, `"Proceed with caution"`).

### 4. 👁️ Continuous Environmental Awareness (Dual Modes)
- **Passive Mode (Default):** The AI continuously monitors the surrounding environment hands-free and speaks **only** when important warnings or critical hazards occur. During normal walking (*"Path is clear"*), LUMA stays quiet.
- **Active Mode:** The user engages in conversational voice Q&A (*"What's around me?"*, *"Is my path clear?"*, *"Read this"*).

### 5. 🎙️ Voice-First Hands-Free Interaction
Designed from the ground up for blind travelers:
- 100% hands-free voice commands with continuous listening and wake-word support (*"Hey LUMA"* or direct questions).
- Audible acoustic earcons (tactile auditory chimes) confirming recognition, warnings, mode shifts, and silencing.
- Single screen tap anywhere or saying *"Stop"* immediately mutes and silences speech playback.

### 6. 📖 One Unified System Instead of Disconnected Apps
Instead of separate tools for vision, OCR, scene narration, and assistants, LUMA integrates everything:
```
                 LUMA
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
    Objects       Text       Scene
       │           │           │
       └───────────┼───────────┘
                   ↓
             Context Engine
                   ↓
             Priority Engine
                   ↓
             Voice Guidance
```

### 7. 🔄 Adaptive Situational Intelligence
LUMA changes its behavior dynamically depending on the user's situation:
- **Situation 1 — Normal (Clear Path):** *"Path is clear."* LUMA stays quiet in Passive Mode.
- **Situation 2 — Obstacle Ahead:** *"Warning: Obstacle ahead, 2 meters in center path."*
- **Situation 3 — Dangerous Obstacle:** *"Stop. A vehicle is approaching from your right. Please wait."*
- **Situation 4 — Entering a Building:** Transitions toward doorway guidance: *"Door detected ahead, approximately 3 meters away."*
- **Situation 5 — Pointing Toward a Sign:** Recognizes text automatically and asks: *"Text detected: Room 204 Computer Lab. Would you like me to read it?"* Saying *"Yes"* or *"Read"* triggers full OCR playback.

---

## 2. Architecture & File Structure

```
LUMA/
├── index.html               # Accessible mobile-first SPA markup (all 9 screens)
├── server.rb                # Zero-dependency local Wi-Fi hosting server
├── css/
│   └── style.css            # OLED dark theme, luminous glow accents, WCAG AAA mode
└── js/
    ├── settings.js          # Persistent preferences manager (localStorage)
    ├── audio-sonar.js       # Web Audio API proximity acoustic radar synthesizer
    ├── speech.js            # Prioritized SpeechSynthesis & tactical earcon engine
    ├── context-engine.js    # The Conductor: Fuses Objects + Text + Scene, manages Dual Modes
    ├── voice-commander.js   # Continuous speech recognition & blind voice command router
    ├── history.js           # Event audit log manager & timeline renderer
    ├── priority-engine.js   # The Brain: Context-aware 4-tier hazard evaluation & phrasing
    ├── ocr-engine.js        # Sign & document reader with read-aloud playback
    ├── scene-descriptor.js  # Holistic environmental narrative engine
    ├── camera.js            # Camera WebRTC manager & interactive simulator HUD
    └── app.js               # Main application controller, shortcuts & navigation
```

---

## 3. Hands-Free Voice Commands Reference

| Voice Command | Action / Response |
| :--- | :--- |
| **"Start" / "Camera on"** | Launches live camera / simulation assistance |
| **"Stop" / "Silence" / "Be quiet"** | Immediately halts all voice speech and silences guidance |
| **"Resume" / "Continue"** | Resumes spoken voice guidance |
| **"Passive Mode"** | Enables silent monitoring mode (alerts only on hazards) |
| **"Active Mode"** | Enables interactive conversational mode |
| **"What is in front of me?" / "What is ahead?"** | Contextually analyzes path and speaks distance/bearing to obstacles |
| **"Is my path clear?" / "Can I walk?"** | Announces whether direct forward path is clear or obstructed |
| **"What's around me?" / "Describe surroundings"** | Speaks holistic scene layout, room type, and ambient lighting |
| **"Read this" / "Read sign" / "Scan"** | Extracts visible text from signs or labels and reads aloud |
| **"Yes" / "Read" / "Sure"** | Confirms reading when LUMA asks *"Text detected. Would you like me to read it?"* |
| **"Where is the door?"** | Locates nearest doorway and announces distance and side |
| **"Are there stairs nearby?"** | Detects steps or drop-offs and announces safety distance |
| **"Status"** | Reports operational mode, camera state, and situation |
| **"Repeat" / "Say again"** | Replays the last spoken guidance alert |
| **"Simulate [car / stairs / door / sign / clear]"** | Switches scenario in demo simulation mode |
| **"Help"** | Reads aloud the full audio voice command menu |
| **"Emergency" / "SOS"** | Triggers accessible 5-second emergency beacon |

---

## 4. Keyboard Shortcuts for Quick Testing & Accessibility

- **`Spacebar`**: Open and activate "Ask LUMA" voice assistant.
- **`P`**: Toggle between **Passive Mode** and **Active Mode**.
- **`S`**: **STOP** voice speech immediately.
- **`R`**: **Repeat** last spoken guidance alert.
- **`H`**: Read aloud voice command **Help** list.
- **`C`**: Toggle **High Contrast Mode** (WCAG AAA pure black & yellow).
- **`M`**: Mute / Unmute Sonar acoustic proximity radar.
- **`Escape`**: Return to Live Assistance or dismiss open modal.

---

## 5. How to Run & Test

### Option A: Local Web Server (Recommended for Mobile Device Testing)
Run the bundled Ruby server script from the terminal:
```bash
ruby server.rb 8080
```
Then open:
- On your computer: `http://localhost:8080`
- On your smartphone (connected to the same Wi-Fi): `http://<YOUR_LOCAL_IP>:8080`
- For real camera access on mobile devices, use HTTPS: `ruby server.rb --ssl`

### Option B: Direct Browser Launch
Simply double-click or open `index.html` directly in any modern browser (Chrome, Safari, Edge, Firefox).
