// ============================================
// ✅ SESSION TIMEOUT MANAGER - FRONTEND (FIXED)
// File: public/js/sessionManager.js
// Features: Inactivity tracking, Warning modal, Auto-logout
// Updated: Dec 3, 2025 - PRODUCTION READY
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
    
    console.log('🔍 SessionManager Constructor Debug:');
    console.log('   Token:', this.token ? this.token.substring(0, 20) + '...' : 'NULL');
    console.log('   SessionId:', this.sessionId ? this.sessionId.substring(0, 20) + '...' : 'NULL');
    
    // ✅ FIX: Only init if we have valid session data
    if (this.token && this.sessionId) {
      this.init();
    } else {
      console.warn('⚠️  SessionManager: Cannot initialize - missing token or sessionId');
    }
  }


  // ============================================
  // INITIALIZE SESSION MANAGER
  // ============================================
  init() {
    console.log('📊 Session Manager initialized');
    console.log(`   Session ID: ${this.sessionId?.substring(0, 10)}...`);
    console.log(`   Token: ${this.token?.substring(0, 10)}...`);
    console.log(`   Timeout: ${this.INACTIVITY_TIMEOUT / 60000} minutes`);
    console.log(`   Warning: ${this.WARNING_TIME / 60000} minutes`);
    
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
    
    console.log('⏱️  Timer reset - User activity detected');
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
        console.log('⚠️  Inactivity warning shown');
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
    let modal = document.getElementById('sessionWarningModal');
    if (!modal) {
      this.createWarningModal();
      modal = document.getElementById('sessionWarningModal');
    }
    
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ Warning modal displayed');
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
      console.log('✅ Warning modal hidden');
    }
  }


  // ============================================
  // CREATE WARNING MODAL HTML
  // ============================================
  createWarningModal() {
    const modalHTML = `
      <div id="sessionWarningModal" class="session-modal-overlay" style="display: none;">
        <div class="session-modal-content">
          <div class="session-modal-header">
            <h2>⏱️  Session Inactivity Warning</h2>
          </div>
          
          <div class="session-modal-body">
            <p class="warning-message">
              Your session is about to expire due to inactivity.
            </p>
            
            <div class="countdown-container">
              <p class="countdown-label">Time remaining:</p>
              <div class="countdown-timer" style="font-size: 48px; font-weight: bold; text-align: center; color: #e74c3c;">
                <span id="countdownMinutes">01</span>:<span id="countdownSeconds">00</span>
              </div>
            </div>
            
            <p class="info-text">
              To continue your session, click <strong>"Stay Active"</strong> below.
              Otherwise, you will be automatically logged out for security reasons.
            </p>
          </div>
          
          <div class="session-modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="stayActiveBtn" class="btn-stay-active" style="padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer;">
              ✓ Stay Active
            </button>
            <button id="logoutBtn" class="btn-logout" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
              ✕ Logout Now
            </button>
          </div>
        </div>
      </div>
      
      <style>
        .session-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        }
        
        .session-modal-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 90%;
          padding: 0;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .session-modal-header {
          background: #f39c12;
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
          text-align: center;
        }
        
        .session-modal-header h2 {
          margin: 0;
          font-size: 22px;
        }
        
        .session-modal-body {
          padding: 30px 20px;
          text-align: center;
        }
        
        .warning-message {
          font-size: 16px;
          color: #333;
          margin: 0 0 20px 0;
        }
        
        .countdown-container {
          margin: 30px 0;
        }
        
        .countdown-label {
          font-size: 14px;
          color: #666;
          margin: 0 0 10px 0;
        }
        
        .countdown-timer {
          font-family: 'Courier New', monospace;
          font-size: 48px;
          font-weight: bold;
          color: #e74c3c;
          letter-spacing: 5px;
        }
        
        .info-text {
          font-size: 14px;
          color: #666;
          line-height: 1.6;
          margin: 20px 0 0 0;
        }
        
        .session-modal-footer {
          padding: 20px;
          border-top: 1px solid #eee;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        
        .btn-stay-active,
        .btn-logout {
          padding: 12px 24px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        
        .btn-stay-active {
          background: #27ae60;
          color: white;
        }
        
        .btn-stay-active:hover {
          background: #229954;
          transform: translateY(-2px);
        }
        
        .btn-logout {
          background: #e74c3c;
          color: white;
        }
        
        .btn-logout:hover {
          background: #c0392b;
          transform: translateY(-2px);
        }
      </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    setTimeout(() => {
      const stayBtn = document.getElementById('stayActiveBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      
      if (stayBtn) {
        stayBtn.addEventListener('click', () => {
          this.resetTimer();
          console.log('✅ User chose to stay active');
        });
      }
      
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this.logout();
          console.log('👋 User chose to logout');
        });
      }
    }, 100);
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
      const modal = document.getElementById('sessionWarningModal');
      
      if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
      
      // Stop countdown if session expired or modal hidden
      if (remaining === 0 || !modal || modal.style.display !== 'flex') {
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
    
    // Logout after showing message
    setTimeout(() => {
      this.logout();
    }, 2000);
  }


  // ============================================
  // SHOW SESSION EXPIRED MODAL
  // ============================================
  showSessionExpiredModal() {
    const expiredHTML = `
      <div id="sessionExpiredModal" class="session-modal-overlay" style="display: flex;">
        <div class="session-modal-content session-expired">
          <div class="session-modal-header error" style="background: #e74c3c;">
            <h2>⏱️  Session Expired</h2>
          </div>
          
          <div class="session-modal-body">
            <p class="error-message" style="color: #e74c3c; font-weight: bold; font-size: 16px;">
              Your session has expired due to inactivity.
            </p>
            <p class="info-text">
              For security reasons, you have been automatically logged out.
              <br>
              Please login again to continue.
            </p>
          </div>
          
          <div class="session-modal-footer">
            <button id="redirectLoginBtn" class="btn-primary" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
              🔐 Go to Login
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', expiredHTML);
    
    setTimeout(() => {
      const redirectBtn = document.getElementById('redirectLoginBtn');
      if (redirectBtn) {
        redirectBtn.addEventListener('click', () => {
          window.location.href = '/admin.html';
        });
      }
    }, 100);
  }


  // ============================================
  // SEND HEARTBEAT TO SERVER
  // ============================================
  startHeartbeat() {
    if (!this.token || !this.sessionId) {
      console.warn('⚠️  Heartbeat: Missing token or sessionId');
      return;
    }
    
    setInterval(() => {
      fetch('/api/health', {
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
        // Silently fail for heartbeat (server might not have endpoint yet)
        console.log('ℹ️  Heartbeat skipped (endpoint not available yet)');
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('sessionId');
    localStorage.removeItem('isAdmin');  // ✅ Add this
    console.log('✅ Cleared session storage');
    
    // Call server logout endpoint
    if (this.token && this.sessionId) {
      fetch('/logout', {  // ✅ Matches server.js route
  method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-Session-ID': this.sessionId
        }
      }).finally(() => {
        // Redirect to login
        console.log('✅ Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/admin.html';
        }, 500);
      });
    } else {
      // No token/session, redirect immediately
      window.location.href = '/admin.html';
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
// STATIC METHOD: CREATE FROM LOGIN RESPONSE
// ✅ USE THIS AFTER SUCCESSFUL LOGIN
// ============================================
SessionManager.createFromLoginResponse = function(response) {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 Creating SessionManager from login response');
  console.log('='.repeat(60));
  
  if (!response.token || !response.sessionId) {
    console.error('❌ Invalid response - missing token or sessionId');
    console.error('Response:', response);
    return null;
  }
  
  // Save to both localStorage and sessionStorage
  localStorage.setItem('authToken', response.token);
  localStorage.setItem('sessionId', response.sessionId);
  sessionStorage.setItem('token', response.token);
  sessionStorage.setItem('sessionId', response.sessionId);
  
  // Save user info if provided
  if (response.admin) {
    localStorage.setItem('user', JSON.stringify(response.admin));
    localStorage.setItem('isAdmin', 'true');
  } else if (response.user) {
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('isAdmin', 'false');
  }
  
  console.log('✅ Credentials saved to storage');
  console.log('   Token:', response.token.substring(0, 20) + '...');
  console.log('   SessionId:', response.sessionId.substring(0, 20) + '...');
  
  // Create and initialize SessionManager
  const manager = new SessionManager({
    token: response.token,
    sessionId: response.sessionId,
    timeout: 10 * 60 * 1000,
    warningTime: 9 * 60 * 1000
  });
  
  window.sessionManager = manager;
  
  console.log('✅ SessionManager created and initialized\n');
  
  return manager;
};


// ============================================
// INITIALIZE ON DOCUMENT READY
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('\n' + '='.repeat(60));
  console.log('📄 DOM Loaded - Checking for existing session...');
  console.log('='.repeat(60));
  
  // Get session data from storage
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
  
  console.log('Checking storage:');
  console.log('   localStorage.authToken:', token ? token.substring(0, 20) + '...' : 'NULL');
  console.log('   localStorage.sessionId:', sessionId ? sessionId.substring(0, 20) + '...' : 'NULL');
  
  if (token && sessionId) {
    console.log('✅ Session found - Initializing SessionManager\n');
    window.sessionManager = new SessionManager({
      token: token,
      sessionId: sessionId,
      timeout: 10 * 60 * 1000,
      warningTime: 9 * 60 * 1000
    });
  } else {
    console.log('⚠️  No active session found - User must login\n');
  }
});


// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.sessionManager) {
    window.sessionManager.destroy();
  }
});