// ⚠️ CONFIGURATION - UPDATE THIS URL
// For local: http://localhost:5000/api
// For production: https://api.fairox.co.in/api
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.fairox.co.in/api'
  : 'http://localhost:5000/api';

// ✅ Configuration Constants
const CONFIG = {
  API_URL: API_URL,
  TOKEN_EXPIRY_WARNING: 5 * 60 * 1000, // 5 minutes before expiry
  REQUEST_TIMEOUT: 30000, // 30 seconds
  FORM_DEBOUNCE_TIME: 500 // 500ms
};

// ✅ Utility: Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ✅ Utility: Debounce function
function debounce(func, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// ✅ Utility: Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = CONFIG.REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection.');
    }
    throw error;
  }
}

// ✅ Utility: Show loading state
function setLoading(element, isLoading, loadingText = ' Loading...') {
  if (isLoading) {
    element.disabled = true;
    element.dataset.originalText = element.innerHTML;
    element.innerHTML = loadingText;
  } else {
    element.disabled = false;
    element.innerHTML = element.dataset.originalText || 'Submit';
  }
}

// ✅ Utility: Show message
function showMessage(messageEl, text, type = 'error', duration = 5000) {
  messageEl.textContent = text;
  messageEl.className = `form-message ${type}`;
  messageEl.style.display = 'block';
  
  if (duration > 0) {
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, duration);
  }
}

// ✅ Utility: Log errors (for debugging)
function logError(context, error) {
  console.error(`[${context}]`, error);
  // In production, send to error tracking service (e.g., Sentry)
  // sendToErrorTracking({ context, error });
}

// ✅ Check authentication status on load
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    verifyToken(token);
  }
  initializeEventListeners();
});

// ✅ Initialize all event listeners (prevent duplicates)
function initializeEventListeners() {
  // Navigation scroll effect
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }
  
  // Close mobile menu on link click
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navLinks) navLinks.classList.remove('active');
    });
  });
  
  // Modal functionality
  const authModal = document.getElementById('authModal');
  const loginBtn = document.getElementById('loginBtn');
  const modalClose = document.getElementById('modalClose');
  
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (authModal) authModal.classList.add('active');
    });
  }
  
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      if (authModal) authModal.classList.remove('active');
    });
  }
  
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        authModal.classList.remove('active');
      }
    });
  }
  
  // Auth tabs
  const authTabs = document.querySelectorAll('.auth-tab');
  authTabs.forEach(tab => {
    tab.addEventListener('click', handleAuthTabClick);
  });
  
  // Form submissions
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
  
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }
  
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  
  const dashboardLogout = document.getElementById('dashboardLogout');
  if (dashboardLogout) {
    dashboardLogout.addEventListener('click', logout);
  }
}

// ✅ Handle scroll events (passive listener for performance)
function handleScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
  
  // Update active nav link
  updateActiveNavLink();
}

// ✅ Update active nav link on scroll
function updateActiveNavLink() {
  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.pageYOffset;
  
  sections.forEach(section => {
    const sectionHeight = section.offsetHeight;
    const sectionTop = section.offsetTop - 100;
    const sectionId = section.getAttribute('id');
    
    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

// ✅ Handle auth tab click
function handleAuthTabClick(e) {
  const target = e.target.dataset.tab;
  const authTabs = document.querySelectorAll('.auth-tab');
  const authForms = document.querySelectorAll('.auth-form');
  
  authTabs.forEach(t => t.classList.remove('active'));
  authForms.forEach(f => f.classList.remove('active'));
  
  e.target.classList.add('active');
  const targetForm = document.getElementById(`${target}Form`);
  if (targetForm) {
    targetForm.classList.add('active');
  }
}

// ✅ Handle login form submission
async function handleLoginSubmit(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const messageEl = document.getElementById('loginMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  
  // ✅ Validation
  if (!email || !password) {
    showMessage(messageEl, 'Please fill in all fields.', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage(messageEl, 'Please enter a valid email address.', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage(messageEl, 'Password must be at least 6 characters.', 'error');
    return;
  }
  
  setLoading(submitBtn, true, ' Logging in...');
  
  try {
    const response = await fetchWithTimeout(`${CONFIG.API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      showMessage(messageEl, 'Login successful! Redirecting...', 'success', 1500);
      
      setTimeout(() => {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('active');
        showDashboard(data.user);
      }, 1500);
    } else {
      if (data.pending) {
        showMessage(messageEl, '⏳ ' + (data.message || 'Account pending approval'), 'warning', 0);
      } else {
        showMessage(messageEl, data.message || 'Login failed. Please try again.', 'error');
      }
    }
  } catch (error) {
    logError('Login', error);
    showMessage(messageEl, error.message || 'Network error. Please check your connection.', 'error');
  } finally {
    setLoading(submitBtn, false, 'Login');
  }
}

// ✅ Handle register form submission
async function handleRegisterSubmit(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('registerName');
  const emailInput = document.getElementById('registerEmail');
  const passwordInput = document.getElementById('registerPassword');
  const confirmPasswordInput = document.getElementById('registerConfirmPassword');
  const messageEl = document.getElementById('registerMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  const name = nameInput?.value?.trim() || '';
  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const confirmPassword = confirmPasswordInput?.value || '';
  
  // ✅ Validation
  if (!name || !email || !password || !confirmPassword) {
    showMessage(messageEl, 'Please fill in all fields.', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage(messageEl, 'Please enter a valid email address.', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage(messageEl, 'Password must be at least 6 characters.', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showMessage(messageEl, 'Passwords do not match.', 'error');
    return;
  }
  
  if (name.length < 2) {
    showMessage(messageEl, 'Name must be at least 2 characters.', 'error');
    return;
  }
  
  setLoading(submitBtn, true, ' Creating account...');
  
  try {
    const response = await fetchWithTimeout(`${CONFIG.API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      const message = data.pending
        ? 'Registration successful! Your account is pending admin approval. You will receive an email once approved.'
        : 'Registration successful! Please login.';
      
      showMessage(messageEl, message, 'success', 3000);
      
      setTimeout(() => {
        if (!data.pending) {
          // Switch to login tab and prefill email
          const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
          if (loginTab) loginTab.click();
          const loginEmail = document.getElementById('loginEmail');
          if (loginEmail) loginEmail.value = email;
        }
        e.target.reset();
      }, 3000);
    } else {
      showMessage(messageEl, data.message || 'Registration failed. Please try again.', 'error');
    }
  } catch (error) {
    logError('Register', error);
    showMessage(messageEl, error.message || 'Network error. Please check your connection.', 'error');
  } finally {
    setLoading(submitBtn, false, 'Register');
  }
}

// ✅ Handle contact form submission
async function handleContactSubmit(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('contactName');
  const emailInput = document.getElementById('contactEmail');
  const phoneInput = document.getElementById('contactPhone');
  const subjectInput = document.getElementById('contactSubject');
  const messageInput = document.getElementById('contactMessage');
  const messageEl = document.getElementById('contactMessageDiv');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  const name = nameInput?.value?.trim() || '';
  const email = emailInput?.value?.trim() || '';
  const phone = phoneInput?.value?.trim() || '';
  const subject = subjectInput?.value?.trim() || '';
  const message = messageInput?.value?.trim() || '';
  
  // ✅ Validation
  if (!name || !email || !subject || !message) {
    showMessage(messageEl, 'Please fill in all required fields.', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage(messageEl, 'Please enter a valid email address.', 'error');
    return;
  }
  
  setLoading(submitBtn, true, ' Sending...');
  
  try {
    const response = await fetchWithTimeout(`${CONFIG.API_URL}/auth/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, phone, subject, message })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage(messageEl, data.message || 'Message sent successfully!', 'success', 5000);
      e.target.reset();
    } else {
      showMessage(messageEl, data.message || 'Failed to send message. Please try again.', 'error');
    }
  } catch (error) {
    logError('Contact', error);
    showMessage(messageEl, error.message || 'Network error. Please check your connection.', 'error');
  } finally {
    setLoading(submitBtn, false, 'Send Message');
  }
}

// ✅ Verify token
async function verifyToken(token) {
  try {
    const response = await fetchWithTimeout(`${CONFIG.API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showDashboard(data.user);
    } else {
      // Token invalid or expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  } catch (error) {
    logError('Token verification', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

// ✅ Show dashboard
function showDashboard(user) {
  const userNameEl = document.getElementById('userName');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const dashboardEl = document.getElementById('dashboard');
  
  if (userNameEl) userNameEl.textContent = user.name || 'User';
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'block';
  
  // Hide main sections
  document.querySelectorAll('.hero, .features, .contact').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show dashboard
  if (dashboardEl) dashboardEl.classList.add('active');
}

// ✅ Logout functionality
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const dashboardEl = document.getElementById('dashboard');
  
  if (loginBtn) loginBtn.style.display = 'block';
  if (logoutBtn) logoutBtn.style.display = 'none';
  
  // Show main sections
  document.querySelectorAll('.hero, .features, .contact').forEach(section => {
    section.style.display = '';
  });
  
  // Hide dashboard
  if (dashboardEl) dashboardEl.classList.remove('active');
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
