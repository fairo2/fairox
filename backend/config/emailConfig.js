// 📧 MAILJET EMAIL CONFIG - PORT 2525 ALTERNATIVE
// File: config/emailConfig.js
// Provider: Mailjet SMTP (free tier, 200 emails/day)
// Works on: Render Production (Port 2525 often open)
// Updated: December 2, 2025

const nodemailer = require('nodemailer');

console.log('\n' + '='.repeat(70));
console.log('📧 INITIALIZING EMAIL SERVICE - MAILJET SMTP (PORT 2525)');
console.log('='.repeat(70));

// ============================================
// ENVIRONMENT VARIABLES CHECK
// ============================================

const requiredEnvVars = [
    'MAILJET_API_KEY',
    'MAILJET_SECRET_KEY',
    'EMAIL_FROM'
];

console.log('\n✅ CHECKING REQUIRED ENVIRONMENT VARIABLES:');
let missingVars = [];
requiredEnvVars.forEach(variable => {
    if (process.env[variable]) {
        const value = process.env[variable];
        const masked = variable.includes('KEY') || variable.includes('SECRET')
            ? '*'.repeat(Math.min(value.length, 12)) + '...'
            : value;
        console.log(`   ✓ ${variable}: ${masked}`);
    } else {
        console.log(`   ✗ ${variable}: MISSING ❌`);
        missingVars.push(variable);
    }
});

if (missingVars.length > 0) {
    console.error(`\n❌ MISSING ENVIRONMENT VARIABLES: ${missingVars.join(', ')}`);
    console.error('   Please add these to your Render environment variables!');
    console.error('   Go to: Render Dashboard → Your Service → Environment Tab\n');
}

// ============================================
// CREATE TRANSPORTER - PORT 2525
// ============================================

function createTransporter() {
    console.log('\n🔧 Creating Mailjet SMTP transporter (Port 2525)...');
    
    // ⚠️ RENDER FIREWALL BYPASS STRATEGY:
    // - Port 587 (TLS) -> Blocked
    // - Port 465 (SSL) -> Blocked
    // - Port 2525 (Alternative) -> OFTEN OPEN
    
    const config = {
        host: 'in-v3.mailjet.com',
        port: 2525,      // ✅ Trying Port 2525 as alternative
        secure: false,   // False for 2525 (starttls)
        auth: {
            user: process.env.MAILJET_API_KEY,
            pass: process.env.MAILJET_SECRET_KEY
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false // Helpful for some strict firewalls
        },
        connectionTimeout: 20000, // Increased timeout
        socketTimeout: 20000
    };

    console.log('   Configuration:');
    console.log('   - Host: in-v3.mailjet.com');
    console.log('   - Port: 2525 (Alternative)');
    console.log('   - Secure: false (STARTTLS)');

    const transporter = nodemailer.createTransport(config);
    
    // Verify connection on startup
    transporter.verify((error, success) => {
        if (error) {
            console.error('\n❌ MAILJET VERIFICATION FAILED (PORT 2525):');
            console.error('   Error:', error.message);
            console.error('   Code:', error.code);
            
            if (error.code === 'ETIMEDOUT') {
                console.error('\n🚨 ALL PORTS BLOCKED BY RENDER (Free Tier Limitation)');
                console.error('   Solution: Switch to Mailjet API (HTTP) instead of SMTP');
            }
        } else {
            console.log('✅ MAILJET SMTP CONNECTION VERIFIED (PORT 2525)');
            console.log('   Host: in-v3.mailjet.com');
            console.log('   Port: 2525');
            console.log('   Status: Ready to send emails\n');
        }
    });

    return transporter;
}

const transporter = createTransporter();

// ============================================
// SEND EMAIL FUNCTION
// ============================================

async function sendEmail(to, subject, html) {
    try {
        console.log('\n📤 SENDING EMAIL:');
        console.log('   To:', to);
        console.log('   Subject:', subject);
        console.log('   From:', process.env.EMAIL_FROM);

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: to,
            subject: subject,
            html: html,
            replyTo: process.env.EMAIL_FROM
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ EMAIL SENT SUCCESSFULLY');
        console.log('   Message ID:', info.messageId);
        
        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ FAILED TO SEND EMAIL:');
        console.error('   Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const emailTemplates = {
    consultationReceived: (data) => ({
        to: process.env.EMAIL_FROM,
        subject: `🎯 New Consultation Inquiry from ${data.name}`,
        html: `
            <h1>New Consultation Request</h1>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>City:</strong> ${data.city}</p>
            <p><strong>Project:</strong> ${data.projectType}</p>
            <p><strong>Budget:</strong> ${data.budget}</p>
            <p><strong>Timeline:</strong> ${data.timeline}</p>
            <p><strong>Description:</strong> ${data.description}</p>
        `
    }),
    // ... other templates (kept simple for this file)
    consultationConfirmation: (data) => ({
        to: data.email,
        subject: '✅ We Received Your Consultation Request',
        html: `<p>Hi ${data.name}, we received your request and will contact you soon.</p>`
    }),
    approvalEmail: (user) => ({
        to: user.email,
        subject: '✅ Account Approved',
        html: `<p>Hi ${user.name}, your account is approved.</p>`
    }),
    userRegistration: (user) => ({
        to: process.env.EMAIL_FROM,
        subject: `🔔 New User Registration: ${user.name}`,
        html: `<p>New user pending approval: ${user.name} (${user.email})</p>`
    })
};

module.exports = {
    transporter,
    sendEmail,
    emailTemplates,
    createTransporter
};