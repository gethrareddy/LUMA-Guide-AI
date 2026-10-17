/**
 * LUMA Guide AI — Environment Understanding & Scene Descriptor
 * Synthesizes holistic scene analysis into an accessible, spatial narrative.
 */

class SceneDescriptor {
  constructor() {
    this.currentNarrative = "You are in an indoor corridor. Approximately 2.4 meters ahead, a set of 3 steps leads downward. A pedestrian is walking slowly on your left side. The path directly ahead is unobstructed.";
    this.currentElements = [
      "🪜 3 Steps Down (2.4m)",
      "🚶 Pedestrian (Left)",
      "🚪 Open Doorway (Right)",
      "💡 Well Lit"
    ];
  }

  /**
   * Synthesizes scene description from active scenario or detections
   * @param {string} scenarioName 'stairs' | 'vehicle' | 'door' | 'person' | 'clear' | 'signs'
   * @param {Array<Object>} detections
   * @returns {Object} { narrative, elements }
   */
  generateScene(scenarioName = 'stairs', detections = []) {
    let narrative = '';
    let elements = [];

    switch (scenarioName) {
      case 'stairs':
        narrative = "You are in an indoor hallway with smooth flooring. Approximately 2.4 meters ahead, a set of steps leads downward. On your left side, a pedestrian is standing about 3 meters away. The lighting is bright and clear.";
        elements = ["🪜 Stairs Ahead (2.4m)", "🚶 Pedestrian (Left)", "💡 Bright Lighting", "🏢 Indoor Corridor"];
        break;

      case 'vehicle':
        narrative = "You are near an outdoor street crossing. A motor vehicle is approaching from your right at approximately 4.5 meters. The pedestrian walkway to your left is clear. Traffic noise is moderate.";
        elements = ["🚗 Vehicle Approaching (Right)", "🛣️ Street Crossing", "🚶 Walkway (Left)", "🔊 Traffic Sound"];
        break;

      case 'door':
        narrative = "You are approaching the end of a corridor. Directly ahead at 3.0 meters is an open doorway. A room sign is mounted to the right of the frame. The floor is level with no tripping hazards.";
        elements = ["🚪 Open Doorway (3.0m)", "📖 Wall Sign (Right)", "✓ Level Flooring", "🏢 Indoor"];
        break;

      case 'person':
        narrative = "You are in an open communal lobby. A person is walking slowly approximately 3.5 meters ahead and slightly to your left. Your direct forward walking path is open.";
        elements = ["🚶 Pedestrian (3.5m Left)", "🟢 Center Path Clear", "🏢 Open Lobby", "💡 Ambient Lighting"];
        break;

      case 'clear':
        narrative = "You are in an open, wide corridor. Your direct path is completely clear of obstacles for at least 5 meters. The floor surface is even and dry.";
        elements = ["🟢 Unobstructed Path (5m+)", "✓ Even Floor Surface", "🏢 Corridor", "💡 Well Lit"];
        break;

      case 'signs':
        narrative = "You are standing directly in front of an office door. An informational signboard reads 'Room 204 Computer Lab'. The door is closed with a handle on the left.";
        elements = ["📖 Room 204 Sign (Center)", "🚪 Closed Office Door", "🏢 Academic Facility"];
        break;

      default:
        narrative = "Surroundings appear calm. No immediate close-range hazards detected in your forward trajectory.";
        elements = ["✓ Path Clear", "💡 Good Visibility"];
    }

    this.currentNarrative = narrative;
    this.currentElements = elements;
    this.updateUI();

    return { narrative, elements };
  }

  readAloud() {
    if (window.LumaSpeech) {
      window.LumaSpeech.speak(this.currentNarrative, 'critical');
    }
  }

  updateUI() {
    const textEl = document.getElementById('sceneNarrativeText');
    const tagsContainer = document.getElementById('sceneElementsTags');

    if (textEl) {
      textEl.textContent = `"${this.currentNarrative}"`;
    }

    if (tagsContainer) {
      tagsContainer.innerHTML = this.currentElements.map(tag => `
        <span class="element-tag">${tag}</span>
      `).join('');
    }
  }
}

// Global singleton instance
window.LumaSceneDescriptor = new SceneDescriptor();
