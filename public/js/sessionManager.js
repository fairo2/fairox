// ============================================
// ✅ SESSION TIMEOUT MANAGER - FRONTEND
// File: public/js/sessionManager.js
// Features: Inactivity tracking, Warning modal, Auto-logout
// Updated: Dec 2, 2025
// ============================================

class SessionManager {
  constructor(options = {}) {
    this.INACTIVITY_TIMEOUT = options.timeout || 10 * 60 * 1000; // 10 minutes
    this.WARNING_TIME = options.warningTime || 9 * 60 * 1000;    // 9 minutes
    this.sessionId = options.sessionId || localStorage.getItem('sessionId');
    this.token = options.token || localStorage.getItem('authToken');
    
    this.inactivityTimer = null;
    this.warningShown = false;
    this.lastActivityTime = Date.now();
    
    this.init();
  }

  // ============================================
  // INITIALIZE SESSION MANAGER
  // ============================================
  init() {
    console.log('📊 Session Manager initialized');
    console.log(`   Session ID: ${this.sessionId?.substring(0, 10)}...`);
    console.log(`   Timeout: ${this.INACTIVITY_TIMEOUT / 60000} minutes`);
    
    // Track user activity
    this.trackActivity();
    
    // Start inactivity timer
    this.startInactivityTimer();
    
    // Send heartbeat to server
    this.startHeartbeat();
  }

  // ============================================
  // TRACK USER ACTIVITY (Reset timer on activity)
  // ============================================
  trackActivity() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimer(), true);
    });
    
    console.log('✅ Activity tracking enabled');
  }

  // ============================================
  // RESET INACTIVITY TIMER
  // ============================================
  resetTimer() {
    const now = Date.now();
    
    // Only reset if enough time has passed (prevent rapid resets)
    if (now - this.lastActivityTime < 1000) return;
    
    this.lastActivityTime = now;
    this.warningShown = false;
    
    // Hide warning modal if shown
    this.hideWarningModal();
    
    // Clear existing timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    // Start new timer
    this.startInactivityTimer();
    
    console.log('⏱️ Timer reset - User activity detected');
  }

  // ============================================
  // START INACTIVITY TIMER
  // ============================================
  startInactivityTimer() {
    this.inactivityTimer = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      // Show warning at 9 minutes
      if (timeSinceLastActivity >= this.WARNING_TIME && !this.warningShown) {
        this.showWarningModal();
        this.warningShown = true;
        console.log('⚠️ Inactivity warning shown');
      }
      
      // Auto-logout at 10 minutes
      if (timeSinceLastActivity >= this.INACTIVITY_TIMEOUT) {
        this.sessionExpired();
      } else {
        // Continue checking
        this.startInactivityTimer();
      }
    }, 1000); // Check every second
  }

  // ============================================
  // SHOW WARNING MODAL
  // ============================================
  showWarningModal() {
    const modal = document.getElementById('sessionWarningModal');
    if (!modal) {
      this.createWarningModal();
    } else {
      modal.style.display = 'flex';
    }
    
    // Start countdown display
    this.startCountdown();
  }

  // ============================================
  // HIDE WARNING MODAL
  // ============================================
  hideWarningModal() {
    const modal = document.getElementById('sessionWarningModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // ============================================
  // CREATE WARNING MODAL HTML
  // ============================================
  createWarningModal() {
    const modalHTML = `
      <div id="sessionWarningModal" class="session-modal-overlay">
        <div class="session-modal-content">
          <div class="session-modal-header">
            <h2>Session Inactivity Warning</h2>
          </div>
          
          <div class="session-modal-body">
            <p class="warning-message">
              Your session is about to expire due to inactivity.
            </p>
            
            <div class="countdown-container">
              <p class="countdown-label">Time remaining:</p>
              <div class="countdown-timer">
                <span id="countdownMinutes">01</span>:<span id="countdownSeconds">00</span>
              </div>
            </div>
            
            <p class="info-text">
              To continue your session, click <strong>"Stay Active"</strong> below.
              Otherwise, you will be automatically logged out.
            </p>
          </div>
          
          <div class="session-modal-footer">
            <button id="stayActiveBtn" class="btn-stay-active">
              Stay Active
            </button>
            <button id="logoutBtn" class="btn-logout">
              Logout Now
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    document.getElementById('stayActiveBtn').addEventListener('click', () => {
      this.resetTimer();
      console.log('✅ User chose to stay active');
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
      console.log('👋 User chose to logout');
    });
  }

  // ============================================
  // COUNTDOWN DISPLAY
  // ============================================
  startCountdown() {
    const countdownInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      const remaining = Math.max(0, this.INACTIVITY_TIMEOUT - timeSinceLastActivity);
      
      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      const minutesEl = document.getElementById('countdownMinutes');
      const secondsEl = document.getElementById('countdownSeconds');
      
      if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
      
      // Stop countdown if session expired or hidden
      if (remaining === 0 || !document.getElementById('sessionWarningModal')?.style?.display === 'flex') {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  // ============================================
  // SESSION EXPIRED - AUTO LOGOUT
  // ============================================
  sessionExpired() {
    console.log('❌ Session expired due to inactivity');
    
    this.hideWarningModal();
    this.showSessionExpiredModal();
    this.logout();
  }

  // ============================================
  // SHOW SESSION EXPIRED MODAL
  // ============================================
  showSessionExpiredModal() {
    const expiredHTML = `
      <div id="sessionExpiredModal" class="session-modal-overlay">
        <div class="session-modal-content session-expired">
          <div class="session-modal-header error">
            <h2>Session Expired</h2>
          </div>
          
          <div class="session-modal-body">
            <p class="error-message">
              Your session has expired due to inactivity.
            </p>
            <p class="info-text">
              For security reasons, you have been automatically logged out.
              Please login again to continue.
            </p>
          </div>
          
          <div class="session-modal-footer">
            <button id="redirectLoginBtn" class="btn-primary">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', expiredHTML);
    
    document.getElementById('redirectLoginBtn').addEventListener('click', () => {
      window.location.href = '/login';
    });
  }

  // ============================================
  // SEND HEARTBEAT TO SERVER
  // ============================================
  startHeartbeat() {
    setInterval(() => {
      if (!this.token || !this.sessionId) return;
      
      // Send heartbeat to server
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-Session-ID': this.sessionId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          lastActivity: Date.now()
        })
      }).catch(error => {
        console.log('Heartbeat failed:', error.message);
      });
    }, 30000); // Send every 30 seconds
  }

  // ============================================
  // LOGOUT FUNCTION
  // ============================================
  logout() {
    console.log('🔐 Logging out...');
    
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    
    // Call server logout endpoint
    if (this.token && this.sessionId) {
      fetch('/api/auth/logout', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-Session-ID': this.sessionId
        }
      }).finally(() => {
        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      });
    } else {
      window.location.href = '/login';
    }
  }

  // ============================================
  // GET REMAINING TIME (in seconds)
  // ============================================
  getRemainingTime() {
    const timeSinceLastActivity = Date.now() - this.lastActivityTime;
    const remaining = Math.max(0, this.INACTIVITY_TIMEOUT - timeSinceLastActivity);
    return Math.ceil(remaining / 1000);
  }

  // ============================================
  // DESTROY SESSION MANAGER
  // ============================================
  destroy() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    console.log('🧹 Session Manager destroyed');
  }
}

// ============================================
// INITIALIZE ON DOCUMENT READY
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Get session data from localStorage or data attributes
  const token = localStorage.getItem('authToken');
  const sessionId = localStorage.getItem('sessionId') || document.documentElement.getAttribute('data-session-id');
  
  if (token && sessionId) {
    window.sessionManager = new SessionManager({
      token: token,
      sessionId: sessionId,
      timeout: 10 * 60 * 1000,      // 10 minutes
      warningTime: 9 * 60 * 1000    // 9 minutes
    });
  } else {
    console.log('⚠️ No active session found');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.sessionManager) {
    window.sessionManager.destroy();
  }
});