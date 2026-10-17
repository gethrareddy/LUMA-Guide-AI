/**
 * LUMA Guide AI — Smart Priority Engine
 * The Core Brain: Implements SEE → UNDERSTAND → PRIORITIZE → GUIDE
 *
 * Implements the 7 Pillars of LUMA Guide AI:
 * 1. 🧠 Decisions over Detections:
 *    Camera → Detection → Context Analysis → Risk/Priority → Guidance
 * 2. 🚨 4-Tier Priority Classification:
 *    🔴 Critical: Vehicle approaching -> Immediate voice alert + danger earcon
 *    🟠 Warning: Stairs ahead -> Warning
 *    🟢 Informational: Door nearby -> Optional information
 *    ⚪ Low: Chair far away -> No alert (silent)
 * 3. 📍 WHAT + WHERE + HOW FAR + HOW IMPORTANT:
 *    Combines entity, bearing, estimated distance, and actionable advice.
 * 4. 👁️ Continuous Environmental Awareness (Passive vs Active Mode):
 *    Passive: Continuously monitors, speaks ONLY when important, stays quiet when safe.
 *    Active: Full conversational answers to "What's around me?", "Is path clear?", "Read this".
 * 5. 🎙️ Voice-First Interaction:
 *    Prioritized natural speech, instant stop/silence controls, zero-touch accessibility.
 * 6. 📖 One System:
 *    Receives fused context from Objects, Text, and Scene.
 * 7. 🔄 Adaptive Situational Intelligence:
 *    Adapts behavior across Normal, Obstacle, Hazard, Doorway, and Sign situations.
 */

class SmartPriorityEngine {
  constructor() {
    this.lastSpokenHazard = null;
    this.lastSpokenTime = 0;
    this.lastSpokenDistance = null;
    this.cooldownMs = 5000; // Do not repeat identical warning within 5 seconds

    // Sensitivity threshold multipliers
    this.sensitivityMultiplier = 1.0;
    this.detectionMode = 'smart'; // 'smart' (context filtered) | 'verbose' (all objects)
    this.operationalMode = 'passive'; // 'passive' (silent when safe) | 'active' (interactive)

    // Silence state (from user "Stop" command)
    this.isSilenced = false;
    this.silenceTimer = null;

    // Hazard weights (higher = more dangerous to visually impaired traveler)
    this.hazardWeights = {
      stairs: 10.0,
      steps: 10.0,
      dropoff: 10.0,
      hole: 10.0,
      car: 9.8,
      truck: 9.8,
      bus: 9.8,
      motorcycle: 9.2,
      bicycle: 8.5,
      vehicle: 9.8,
      barrier: 7.8,
      obstacle: 7.2,
      chair: 6.0,
      table: 5.5,
      person: 5.8,
      pedestrian: 5.8,
      door: 5.0,
      signboard: 4.0,
      sign: 4.0,
      wall: 2.0,
      road: 3.0
    };

    if (window.LumaSettings) {
      window.LumaSettings.subscribe(settings => {
        if (settings.sensitivity === 'high') this.sensitivityMultiplier = 1.25;
        else if (settings.sensitivity === 'low') this.sensitivityMultiplier = 0.8;
        else this.sensitivityMultiplier = 1.0;

        this.detectionMode = settings.detectionMode || 'smart';
        if (settings.operationalMode) {
          this.operationalMode = settings.operationalMode;
        }
      });
    }
  }

  /**
   * Evaluates raw camera detections combined with Context Engine situation and mode
   * @param {Array<Object>} rawDetections Array of detections
   * @param {Object} situation Current situation from Context Engine
   * @param {string} mode 'passive' | 'active'
   */
  evaluateWithContext(rawDetections = [], situation = null, mode = 'passive') {
    this.operationalMode = mode || this.operationalMode;

    if (!rawDetections || rawDetections.length === 0) {
      return this.createClearPathDecision(situation);
    }

    // 1. Enrich detections with distance, bearing, and hazard score
    const enriched = rawDetections.map(det => this.enrichDetection(det));

    // 2. Sort by urgency score descending
    enriched.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // 3. Verbose Mode: announce top object regardless
    if (this.detectionMode === 'verbose') {
      const top = enriched[0];
      return this.formatDecision(top, enriched, situation);
    }

    // 4. Smart Priority:
    const primaryHazard = enriched[0];

    // If highest urgency score is negligible (< 4.2), consider path clear
    if (primaryHazard.urgencyScore < 4.2) {
      return this.createClearPathDecision(situation);
    }

    return this.formatDecision(primaryHazard, enriched, situation);
  }

  /**
   * Legacy evaluation pipeline for backward compatibility
   */
  evaluate(rawDetections = []) {
    const sit = window.LumaContextEngine ? window.LumaContextEngine.classifySituation(rawDetections) : null;
    const mode = window.LumaContextEngine ? window.LumaContextEngine.mode : this.operationalMode;
    return this.evaluateWithContext(rawDetections, sit, mode);
  }

  /**
   * Calculate distance, direction, and urgency score for an entity
   */
  enrichDetection(det) {
    const [ymin, xmin, ymax, xmax] = det.box || [0.2, 0.2, 0.8, 0.8];
    const width = Math.max(0.01, xmax - xmin);
    const height = Math.max(0.01, ymax - ymin);
    const centerX = (xmin + xmax) / 2;
    const bottomY = ymax;

    // Estimate Distance in meters:
    let estimatedDistance = 3.5;
    if (det.distance !== undefined) {
      estimatedDistance = det.distance;
    } else {
      // Heuristic model: distance = focalConstant / bboxHeight
      const dist = (0.75 / height) * (1.2 - bottomY * 0.3);
      estimatedDistance = Math.max(0.8, Math.min(10.0, parseFloat(dist.toFixed(1))));
    }

    // Determine Direction: LEFT, FRONT / CENTER, RIGHT
    let direction = 'FRONT';
    if (centerX < 0.38) {
      direction = 'LEFT';
    } else if (centerX > 0.62) {
      direction = 'RIGHT';
    } else {
      direction = 'FRONT';
    }

    // Urgency calculation:
    const labelKey = (det.label || '').toLowerCase();
    const baseWeight = this.hazardWeights[labelKey] || 4.0;

    // Multiplier for being directly in center path
    const directionMultiplier = (direction === 'FRONT') ? 1.7 : 1.0;

    // Proximity multiplier
    let distanceMultiplier = 1.0;
    if (estimatedDistance < 1.8) {
      distanceMultiplier = 2.4;
    } else if (estimatedDistance < 3.2) {
      distanceMultiplier = 1.6;
    } else if (estimatedDistance < 5.0) {
      distanceMultiplier = 1.0;
    } else {
      distanceMultiplier = 0.5;
    }

    // Approaching motion multiplier
    const motionMultiplier = (det.motion === 'approaching') ? 1.7 : 1.0;

    const urgencyScore = baseWeight * directionMultiplier * distanceMultiplier * motionMultiplier * (det.confidence || 0.9) * this.sensitivityMultiplier;

    return {
      ...det,
      distance: estimatedDistance,
      direction,
      urgencyScore
    };
  }

  /**
   * Formats a priority decision into actionable guidance combining:
   * WHAT + WHERE + HOW FAR + HOW IMPORTANT
   *
   * 4 Priority Tiers:
   * 🔴 Critical: Vehicle approaching, drop-off -> Immediate voice alert
   * 🟠 Warning: Stairs ahead, obstacle in walking path -> Warning
   * 🟢 Informational: Door nearby, signs -> Optional info
   * ⚪ Low: Chair far away, distant walls -> NO ALERT (Silent)
   */
  formatDecision(primary, allEnriched, situation = null) {
    const label = (primary.label || 'Obstacle').toLowerCase();
    const dist = primary.distance;
    const dir = primary.direction;
    const score = primary.urgencyScore;
    const isApproaching = primary.motion === 'approaching';

    let level = 'info';
    let icon = 'ℹ️';
    let title = '';
    let subtext = '';
    let speakText = '';
    let shouldSpeak = true;

    // =========================================================================
    // 🔴 TIER 1: CRITICAL PRIORITY (Immediate hazard / stop guidance)
    // =========================================================================
    if (label.includes('car') || label.includes('vehicle') || label.includes('truck') || label.includes('bus')) {
      level = 'critical';
      icon = '🚗';
      title = `Vehicle approaching`;
      subtext = `${isApproaching ? 'Approaching' : 'Vehicle'} • ${dist}m to your ${dir.toLowerCase()}. Stop and wait.`;
      // WHAT + WHERE + HOW FAR + HOW IMPORTANT
      speakText = isApproaching
        ? `Stop. A vehicle is approaching from your ${dir.toLowerCase()}, approximately ${dist} meters away. Please wait.`
        : `Vehicle ${dist} meters to your ${dir.toLowerCase()}. Exercise caution.`;
    }
    else if (label.includes('drop') || label.includes('hole')) {
      level = 'critical';
      icon = '⚠️';
      title = `Drop-off / Hole detected`;
      subtext = `Critical drop hazard ${dist}m directly ahead. Stop immediately.`;
      speakText = `Stop immediately. Drop-off detected directly ahead, approximately ${dist} meters away.`;
    }
    else if (score >= 13 || (dist < 1.6 && dir === 'FRONT')) {
      level = 'critical';
      icon = '🛑';
      title = `Obstacle immediately ahead`;
      subtext = `${primary.label} at ${dist}m in direct path. Stop.`;
      speakText = `Stop. ${primary.label} directly in your path, approximately ${dist} meters away.`;
    }
    // =========================================================================
    // 🟠 TIER 2: WARNING PRIORITY (Stairs, obstacles in path 1.8m - 3.5m)
    // =========================================================================
    else if (label.includes('stairs') || label.includes('step')) {
      level = 'warning';
      icon = '🪜';
      title = `Stairs ahead`;
      subtext = `Distance: ${dist}m • Direction: ${dir}. Slow down.`;
      speakText = `Warning: Stairs detected ahead, approximately ${dist} meters away. Please slow down.`;
    }
    else if (score >= 7.0 || (dist <= 3.2 && dir === 'FRONT')) {
      level = 'warning';
      icon = '⚠️';
      title = `Obstacle ahead`;
      subtext = `${primary.label} detected ${dist}m ahead in ${dir.toLowerCase()} path.`;
      speakText = `Warning: ${primary.label} ahead, approximately ${dist} meters away on your ${dir.toLowerCase()}.`;
    }
    // =========================================================================
    // 🟢 TIER 3: INFORMATIONAL PRIORITY (Door nearby, room sign, landmark)
    // =========================================================================
    else if (label.includes('door')) {
      level = 'info';
      icon = '🚪';
      title = `Door detected`;
      subtext = `Door located ${dist}m ahead • ${dir}.`;
      speakText = `Door detected ahead, approximately ${dist} meters away.`;
    }
    else if (label.includes('person') || label.includes('pedestrian')) {
      level = 'info';
      icon = '🚶';
      title = `Pedestrian nearby`;
      subtext = `Person walking ${dist}m away on your ${dir.toLowerCase()}.`;
      speakText = `Pedestrian observed, approximately ${dist} meters on your ${dir.toLowerCase()}.`;
    }
    // =========================================================================
    // ⚪ TIER 4: LOW PRIORITY (Chair far away, distant objects, walls)
    // PREVENTS INFORMATION OVERLOAD — NO ALERT!
    // =========================================================================
    else if (dist > 3.2 || score < 5.5 || label.includes('wall') || label.includes('floor') || label.includes('road')) {
      level = 'low';
      icon = '⚪';
      title = `${primary.label} distant`;
      subtext = `${primary.label} is ${dist}m away (${dir}). No alert needed.`;
      speakText = ''; // Silent! A blind user does not need to hear about every object.
      shouldSpeak = false;
    }
    else {
      level = 'info';
      icon = 'ℹ️';
      title = `${primary.label} observed`;
      subtext = `${dist}m • ${dir}`;
      speakText = `${primary.label} observed, ${dist} meters on your ${dir.toLowerCase()}.`;
    }

    const decision = {
      level,
      icon,
      title,
      subtext,
      distance: `${dist}m`,
      direction: dir,
      speakText,
      shouldSpeak,
      primaryItem: primary,
      allDetections: allEnriched,
      situation: situation ? situation.key : null
    };

    this.processVoiceGuidance(decision);
    return decision;
  }

  /**
   * Creates Clear Path Decision
   * Situation 1 (Normal): "Path is clear." LUMA stays quiet in Passive Mode!
   */
  createClearPathDecision(situation = null) {
    const decision = {
      level: 'safe',
      icon: '🟢',
      title: 'Path is clear',
      subtext: 'No hazardous obstacles detected in direct path.',
      distance: '5.0m+',
      direction: 'FRONT',
      speakText: 'Path is clear.',
      shouldSpeak: false, // In Passive Mode, stay quiet!
      primaryItem: null,
      allDetections: [],
      situation: situation ? situation.key : 'normal'
    };

    this.processVoiceGuidance(decision);
    return decision;
  }

  silence(durationMs = 8000) {
    this.isSilenced = true;
    clearTimeout(this.silenceTimer);
    if (durationMs > 0) {
      this.silenceTimer = setTimeout(() => {
        this.isSilenced = false;
      }, durationMs);
    }
  }

  unsilence() {
    this.isSilenced = false;
    clearTimeout(this.silenceTimer);
  }

  /**
   * Evaluates debouncing and speaks voice guidance based on priority & operational mode
   */
  processVoiceGuidance(decision) {
    const now = Date.now();
    const hazardKey = `${decision.level}_${decision.title}`;
    const distValue = parseFloat(decision.distance) || 5;

    // 1. Sonar Proximity Acoustic Radar: always update frequency
    if (window.LumaSonar) {
      window.LumaSonar.updateDistance(distValue, decision.level);
    }

    // 2. ⚪ TIER 4: LOW PRIORITY — NEVER SPEAK! (Prevents cognitive overload)
    if (decision.level === 'low' || !decision.shouldSpeak && decision.level !== 'critical' && decision.level !== 'warning') {
      return;
    }

    // 3. User commanded STOP/SILENCE: do NOT speak unless immediate CRITICAL safety emergency!
    if (this.isSilenced && decision.level !== 'critical') {
      return;
    }

    // 4. PASSIVE MODE BEHAVIOR (Pillar 4):
    // In Passive Mode, LUMA monitors continuously and speaks ONLY when something important happens:
    // - Situation 1 (Normal / Safe): LUMA stays quiet! (Does not speak "Path is clear" continuously)
    // - Tier 3 (Informational): Only speaks once upon initial discovery, never loops.
    // - Tier 2 (Warning) & Tier 1 (Critical): Speaks alerts immediately with debouncing.
    if (this.operationalMode === 'passive') {
      if (decision.level === 'safe') {
        // Safe / Clear path: Stays quiet!
        return;
      }
      if (decision.level === 'info' && this.lastSpokenHazard === hazardKey) {
        // Informational: do not repeat
        return;
      }
    }

    const isNewHazard = this.lastSpokenHazard !== hazardKey;
    const isCooldownElapsed = (now - this.lastSpokenTime) > this.cooldownMs;
    const isCriticalEscalation = decision.level === 'critical' && (isNewHazard || (this.lastSpokenDistance - distValue > 0.8));

    // For Safe or Info: ONLY speak on initial transition (isNewHazard)
    if ((decision.level === 'safe' || decision.level === 'info') && !isNewHazard) {
      return;
    }

    if (isNewHazard || isCooldownElapsed || isCriticalEscalation) {
      this.lastSpokenHazard = hazardKey;
      this.lastSpokenTime = now;
      this.lastSpokenDistance = distValue;

      // Play tactical audio earcon before voice
      if (window.LumaSpeech) {
        if (decision.level === 'critical') {
          window.LumaSpeech.playEarcon('danger');
        } else if (decision.level === 'warning') {
          window.LumaSpeech.playEarcon('warning');
        }

        // Deliver synthesized guidance
        if (decision.speakText) {
          window.LumaSpeech.speak(decision.speakText, decision.level);
        }
      }

      // Log in history audit trail
      if (decision.level === 'critical' || decision.level === 'warning' || decision.level === 'info') {
        if (window.LumaHistory) {
          window.LumaHistory.log({
            type: 'hazard',
            priority: decision.level,
            title: `${decision.icon} ${decision.title}`,
            description: `"${decision.speakText}"`,
            distance: decision.distance,
            direction: decision.direction
          });
        }
      }
    }
  }

  /**
   * Active Mode: Directly answers user questions based on current context
   * Supports WHAT + WHERE + HOW FAR + HOW IMPORTANT
   * @param {string} question e.g. "What is in front of me?", "Is path clear?"
   * @param {Object} currentDecision Active decision state
   * @returns {string} Response text
   */
  answerUserQuestion(question = '', currentDecision = null) {
    const q = (question || '').toLowerCase();

    // Check if Context Engine has active sign or doorway
    const context = window.LumaContextEngine;
    const situation = context ? context.currentSituation : 'normal';

    if (!currentDecision || !currentDecision.primaryItem) {
      if (q.includes('path') || q.includes('clear') || q.includes('walk')) {
        return "The path is clear. There are no hazardous obstacles in front of you for at least 5 meters.";
      }
      if (q.includes('around') || q.includes('surround') || q.includes('environment')) {
        return "Surroundings appear clear and unobstructed. No immediate hazards detected in your field of view.";
      }
      if (q.includes('stair') || q.includes('step')) {
        return "No stairs or steps are detected in your immediate field of view.";
      }
      if (q.includes('door') || q.includes('entrance')) {
        return "No doors are currently detected ahead.";
      }
      return "Your direct path is clear. Safe to proceed.";
    }

    const item = currentDecision.primaryItem;
    const label = item.label || 'obstacle';
    const dist = item.distance;
    const dir = (item.direction || 'FRONT').toLowerCase();

    // "Is my path clear?" / "Can I walk?"
    if (q.includes('path') || q.includes('clear') || q.includes('walk')) {
      if (dir === 'front' && dist < 3.0) {
        return `Caution: your direct path is not clear. There is a ${label} approximately ${dist} meters directly in front of you.`;
      }
      return `The center path is mostly clear. There is a ${label} approximately ${dist} meters to your ${dir}.`;
    }

    // "What is ahead?" / "What is in front of me?"
    if (q.includes('ahead') || q.includes('front') || q.includes('what is') || q.includes('what do you see')) {
      if (label.includes('stair') || label.includes('step')) {
        return `The path is mostly clear, but there are stairs approximately ${dist} meters ahead. Please proceed carefully.`;
      }
      if (label.includes('car') || label.includes('vehicle')) {
        return `Warning: A vehicle is approximately ${dist} meters away to your ${dir}. Stop and wait.`;
      }
      return `A ${label} is approximately ${dist} meters ahead and slightly to your ${dir}.`;
    }

    // "What's around me?" / "Describe surroundings"
    if (q.includes('around') || q.includes('surround')) {
      if (window.LumaSceneDescriptor && window.LumaSceneDescriptor.currentNarrative) {
        return window.LumaSceneDescriptor.currentNarrative;
      }
      return `Around you, I observe a ${label} approximately ${dist} meters to your ${dir}. The surrounding area is illuminated.`;
    }

    // "Are there stairs nearby?"
    if (q.includes('stair') || q.includes('step')) {
      if (label.includes('stair') || label.includes('step')) {
        return `Yes. Stairs are detected approximately ${dist} meters ahead. Please slow down and proceed with caution.`;
      }
      return "No stairs are detected in your immediate field of view.";
    }

    // "Where is the door?"
    if (q.includes('door') || q.includes('entrance') || q.includes('exit')) {
      if (label.includes('door')) {
        return `A door is detected approximately ${dist} meters ahead on your ${dir}.`;
      }
      return "No doors are currently visible in your immediate path.";
    }

    // Fallback answer
    return `In your field of view, I detect a ${label} approximately ${dist} meters away to your ${dir}.`;
  }
}

// Global singleton instance
window.LumaPriorityEngine = new SmartPriorityEngine();
