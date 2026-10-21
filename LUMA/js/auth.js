/**
 * LUMA Guide AI — User Authentication & Profile Manager
 * Handles Login, Sign Up, Profile Persistence (localStorage),
 * Guest access, and accessible voice notifications.
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.listeners = [];

    this.loadSession();
  }

  loadSession() {
    try {
      const saved = localStorage.getItem('luma_user_session');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  saveSession() {
    try {
      if (this.currentUser) {
        localStorage.setItem('luma_user_session', JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem('luma_user_session');
      }
    } catch (e) {}
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  notify() {
    this.listeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) {}
    });
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  getUser() {
    return this.currentUser;
  }

  /**
   * Log In with credentials
   */
  login(emailOrUsername, password, remember = true) {
    const username = emailOrUsername.trim();
    if (!username || !password) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    // Determine display name
    let name = username.split('@')[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);

    this.currentUser = {
      id: 'usr_' + Date.now(),
      name: name,
      email: username.includes('@') ? username : `${username}@luma.guide`,
      role: 'Traveler',
      preference: 'voice',
      createdAt: Date.now()
    };

    if (remember) {
      this.saveSession();
    } else {
      this.notify();
    }

    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(`Welcome back, ${name}. Logged in successfully.`, 'critical');
    }

    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'voice',
        priority: 'info',
        title: `👤 Logged In: ${name}`,
        description: `Active session started for ${this.currentUser.email}`
      });
    }

    return { success: true, user: this.currentUser };
  }

  /**
   * Quick demo 1-tap login for testing
   */
  quickDemoLogin() {
    return this.login('demo@luma.guide', 'demo123', true);
  }

  /**
   * Sign Up new account
   */
  signup(fullName, email, password, preference = 'voice') {
    const name = fullName.trim();
    const mail = email.trim();

    if (!name || !mail || !password) {
      return { success: false, message: 'Please complete all required fields.' };
    }

    if (password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters.' };
    }

    this.currentUser = {
      id: 'usr_' + Date.now(),
      name: name,
      email: mail,
      role: 'Registered Traveler',
      preference: preference,
      createdAt: Date.now()
    };

    this.saveSession();

    // Apply preferred mode
    if (preference === 'contrast') {
      document.body.classList.add('high-contrast');
      if (window.LumaSettings) window.LumaSettings.set('highContrast', true);
    }

    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('ack');
      window.LumaSpeech.speak(`Account created successfully. Welcome to LUMA, ${name}.`, 'critical');
    }

    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'voice',
        priority: 'info',
        title: `👤 Account Created: ${name}`,
        description: `New traveler profile created with ${preference} mode preference.`
      });
    }

    return { success: true, user: this.currentUser };
  }

  /**
   * Log Out current user
   */
  logout() {
    const prevName = this.currentUser ? this.currentUser.name : 'User';
    this.currentUser = null;
    this.saveSession();

    if (window.LumaSpeech) {
      window.LumaSpeech.playEarcon('stop');
      window.LumaSpeech.speak(`Logged out. You are now in Guest Mode.`, 'normal');
    }

    if (window.LumaHistory) {
      window.LumaHistory.log({
        type: 'voice',
        priority: 'info',
        title: `👤 Logged Out`,
        description: `${prevName} signed out. Returned to Guest Mode.`
      });
    }

    return { success: true };
  }
}

// Global Singleton
window.LumaAuth = new AuthManager();
