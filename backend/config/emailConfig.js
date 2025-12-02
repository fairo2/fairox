// 📧 FIXED EMAIL CONFIG - PORT 465 SSL VERSION
// File: config/emailConfig.js
// Issue: Render blocks port 587, use 465 instead
// Works on: Render Production + Localhost

const nodemailer = require('nodemailer');

console.log('\n' + '='.repeat(60));
console.log('📧 INITIALIZING EMAIL SERVICE');
console.log('='.repeat(60));

// ============================================
// ENVIRONMENT VARIABLES CHECK
// ============================================

const requiredEnvVars = [
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_FROM'
];

console.log('\n✅ CHECKING ENVIRONMENT VARIABLES:');
let missingVars = [];
requiredEnvVars.forEach(variable => {
    if (process.env[variable]) {
        const value = process.env[variable];
        const masked = variable.includes('PASS') 
            ? '*'.repeat(value.length) 
            : value;
        console.log(`   ✓ ${variable}: ${masked}`);
    } else {
        console.log(`   ✗ ${variable}: MISSING ❌`);
        missingVars.push(variable);
    }
});

if (missingVars.length > 0) {
    console.error(`\n❌ MISSING ENVIRONMENT VARIABLES: ${missingVars.join(', ')}`);
    console.error('Please add these to your Render environment variables!');
}

// ============================================
// CREATE TRANSPORTER - RENDER OPTIMIZED
// ============================================

function createTransporter() {
    console.log('\n🔧 Creating email transporter...');
    
    // ⚠️ CRITICAL FIX FOR RENDER:
    // - Port 587 (TLS) is BLOCKED on Render
    // - Use port 465 (SSL) instead
    // - This is the standard Gmail SSL port
    
    const config = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true', // ✅ Set to true for port 465
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        // Add timeout for Render connections
        connectionTimeout: 10000,
        socketTimeout: 10000
    };

    console.log('   Configuration:');
    console.log('   - Host:', config.host);
    console.log('   - Port:', config.port);
    console.log('   - Secure (SSL):', config.secure);
    console.log('   - User:', config.auth.user);

    const transporter = nodemailer.createTransport(config);
    
    // Verify connection
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ SMTP VERIFICATION FAILED:');
            console.error('   Error:', error.message);
            console.error('   Code:', error.code);
            
            if (error.code === 'ETIMEDOUT') {
                console.error('\n🔍 PORT TIMEOUT DETECTED:');
                console.error('   Render likely blocks port 587');
                console.error('   ✅ Solution: Set EMAIL_PORT=465 and EMAIL_SECURE=true');
            }
            
            console.error('\n🔍 TROUBLESHOOTING:');
            console.error('   1. Set EMAIL_PORT=465 (SSL) not 587 (TLS)');
            console.error('   2. Set EMAIL_SECURE=true for port 465');
            console.error('   3. Gmail users: Use 16-char App Password');
            console.error('   4. Verify Gmail account has 2FA enabled');
            console.error('   5. Check if SMTP port is blocked by firewall');
        } else {
            console.log('✅ SMTP CONNECTION VERIFIED');
            console.log('   Host:', process.env.EMAIL_HOST);
            console.log('   Port:', process.env.EMAIL_PORT, '(SSL)');
            console.log('   User:', process.env.EMAIL_USER);
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
        console.log('   Response:', info.response);
        
        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ FAILED TO SEND EMAIL:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);
        
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const emailTemplates = {
    consultationReceived: (data) => ({
        to: process.env.EMAIL_FROM, // Send to admin
        subject: `🎯 New Consultation Inquiry from ${data.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2180C8 0%, #1A6AA0 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">📋 New Consultation Request</h1>
                </div>
                <div style="background: white; padding: 20px;">
                    <h2 style="color: #2180C8;">Client Information</h2>
                    <p><strong>Name:</strong> ${data.name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
                    <p><strong>Phone:</strong> <a href="tel:${data.phone}">${data.phone}</a></p>
                    <p><strong>City:</strong> ${data.city}</p>
                    
                    <h2 style="color: #2180C8;">Project Details</h2>
                    <p><strong>Type:</strong> ${data.projectType}</p>
                    <p><strong>Budget:</strong> ${data.budget}</p>
                    <p><strong>Timeline:</strong> ${data.timeline}</p>
                    <p><strong>Services:</strong> ${Array.isArray(data.services) ? data.services.join(', ') : data.services}</p>
                    
                    <h2 style="color: #2180C8;">Description</h2>
                    <p>${data.description.replace(/\n/g, '<br>')}</p>
                    
                    <h2 style="color: #2180C8;">Preferred Contact</h2>
                    <p><strong>${data.contactMethod.toUpperCase()}</strong></p>
                </div>
                <div style="background: #2180C8; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">Received: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `
    }),

    consultationConfirmation: (data) => ({
        to: data.email,
        subject: '✅ We Received Your Consultation Request - Fairox',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2180C8 0%, #1A6AA0 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🏢 Thank You - Fairox</h1>
                </div>
                <div style="background: white; padding: 20px;">
                    <p>Hi <strong>${data.name}</strong>,</p>
                    <p>Thank you for reaching out to Fairox! We've received your consultation request and will review it shortly.</p>
                    
                    <h2 style="color: #2180C8;">Your Request Summary</h2>
                    <ul style="list-style: none; padding: 0;">
                        <li>✓ Project: ${data.projectType}</li>
                        <li>✓ Budget: ${data.budget}</li>
                        <li>✓ Timeline: ${data.timeline}</li>
                        <li>✓ Services: ${Array.isArray(data.services) ? data.services.join(', ') : data.services}</li>
                    </ul>
                    
                    <p style="margin-top: 20px;">Our team will contact you via <strong>${data.contactMethod.toUpperCase()}</strong> within 24 hours.</p>
                </div>
                <div style="background: #2180C8; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2025 Fairox. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    approvalEmail: (user) => ({
        to: user.email,
        subject: '✅ Your Fairox Account Has Been Approved!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🎉 Welcome to Fairox!</h1>
                </div>
                <div style="background: white; padding: 20px;">
                    <p>Hi ${user.name},</p>
                    <p>Great news! Your account has been approved by our admin team. You can now access all features of Fairox.</p>
                    
                    <h2 style="color: #28a745;">Account Details</h2>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Status:</strong> ✅ APPROVED</p>
                    
                    <p style="margin-top: 20px;">
                        <a href="https://fairox.co.in" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Login Now →</a>
                    </p>
                </div>
                <div style="background: #28a745; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2025 Fairox. All rights reserved.</p>
                </div>
            </div>
        `
    })
};

// ============================================
// EXPORT
// ============================================

module.exports = {
    transporter,
    sendEmail,
    emailTemplates,
    createTransporter
};

console.log('='.repeat(60) + '\n');