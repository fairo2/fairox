// ⚠️ CONFIGURATION - UPDATE THIS URL
// For local: http://localhost:5000/api
// For production: https://fairox.co.in/api
const API_URL = 'https://fairox-backend.onrender.com/api';

// Check authentication status on load
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        verifyToken(token);
    }
});

// Navigation scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// Active link on scroll
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
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
});

// Modal functionality
const authModal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const modalClose = document.getElementById('modalClose');

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authModal.classList.add('active');
});

modalClose.addEventListener('click', () => {
    authModal.classList.remove('active');
});

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.remove('active');
    }
});

// Auth tabs
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        authTabs.forEach(t => t.classList.remove('active'));
        authForms.forEach(f => f.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${target}Form`).classList.add('active');
    });
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('loginMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = ' Logging in...';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
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
            
            messageEl.textContent = 'Login successful! Redirecting...';
            messageEl.className = 'form-message success';
            messageEl.style.display = 'block';
            
            setTimeout(() => {
                authModal.classList.remove('active');
                showDashboard(data.user);
            }, 1500);
        } else {
            if (data.pending) {
                messageEl.textContent = '⏳ ' + data.message;
                messageEl.className = 'form-message';
                messageEl.style.background = 'rgba(255, 193, 7, 0.2)';
                messageEl.style.borderColor = 'rgba(255, 193, 7, 0.5)';
                messageEl.style.color = '#ff9800';
            } else {
                messageEl.textContent = data.message || 'Login failed. Please try again.';
                messageEl.className = 'form-message error';
            }
            messageEl.style.display = 'block';
        }
    } catch (error) {
        messageEl.textContent = 'Network error. Please check your connection.';
        messageEl.className = 'form-message error';
        messageEl.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

// Register form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const messageEl = document.getElementById('registerMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (password !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match!';
        messageEl.className = 'form-message error';
        messageEl.style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters!';
        messageEl.className = 'form-message error';
        messageEl.style.display = 'block';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = ' Creating account...';
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.pending) {
                messageEl.textContent = 'Registration successful! Your account is pending admin approval. You will receive an email once approved.';
            } else {
                messageEl.textContent = 'Registration successful! Please login.';
            }
            messageEl.className = 'form-message success';
            messageEl.style.display = 'block';
            
            setTimeout(() => {
                if (!data.pending) {
                    document.querySelector('.auth-tab[data-tab="login"]').click();
                    document.getElementById('loginEmail').value = email;
                }
                e.target.reset();
            }, 3000);
        } else {
            messageEl.textContent = data.message || 'Registration failed. Please try again.';
            messageEl.className = 'form-message error';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        messageEl.textContent = 'Network error. Please check your connection.';
        messageEl.className = 'form-message error';
        messageEl.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
    }
});

// Contact form submission
document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const phone = document.getElementById('contactPhone').value;
    const subject = document.getElementById('contactSubject').value;
    const message = document.getElementById('contactMessage').value;
    const messageEl = document.getElementById('contactMessageDiv');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = ' Sending...';
    
    try {
        const response = await fetch(`${API_URL}/auth/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, phone, subject, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageEl.textContent = data.message;
            messageEl.className = 'form-message success';
            messageEl.style.display = 'block';
            e.target.reset();
        } else {
            messageEl.textContent = data.message || 'Failed to send message. Please try again.';
            messageEl.className = 'form-message error';
            messageEl.style.display = 'block';
        }
    } catch (error) {
        messageEl.textContent = 'Network error. Please check your connection.';
        messageEl.className = 'form-message error';
        messageEl.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
    }
});

// Verify token
async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showDashboard(data.user);
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}

// Show dashboard
function showDashboard(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    
    // Hide main sections
    document.querySelectorAll('.hero, .features, .contact').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show dashboard
    document.getElementById('dashboard').classList.add('active');
}

// Logout functionality
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    
    // Show main sections
    document.querySelectorAll('.hero, .features, .contact').forEach(section => {
        section.style.display = '';
    });
    
    // Hide dashboard
    document.getElementById('dashboard').classList.remove('active');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

document.getElementById('dashboardLogout').addEventListener('click', logout);