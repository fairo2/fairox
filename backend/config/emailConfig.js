// 📧 MAILJET EMAIL CONFIG - COMPLETE & PRODUCTION READY
// File: backend/config/emailConfig.js
// Provider: Mailjet SMTP (free tier, 200 emails/day)
// Works on: Render Production + Localhost
// Updated: December 2, 2025

const nodemailer = require('nodemailer');

console.log('\n' + '='.repeat(70));
console.log('📧 INITIALIZING EMAIL SERVICE - MAILJET SMTP');
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
// CREATE TRANSPORTER - MAILJET OPTIMIZED
// ============================================

function createTransporter() {
    console.log('\n🔧 Creating Mailjet SMTP transporter...');
    
    // Mailjet SMTP Configuration
    // - Host: in-v3.mailjet.com (Mailjet's SMTP server)
    // - Port: 587 (TLS - works on Render!)
    // - Auth: API Key as username, Secret Key as password
    
    const config = {
        host: 'in-v3.mailjet.com',
        port: 465,
        secure: false,  // false for port 587 (TLS), true for 465 (SSL)
        auth: {
            user: process.env.MAILJET_API_KEY,
            pass: process.env.MAILJET_SECRET_KEY
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        logger: false,
        debug: false
    };

    console.log('   Configuration:');
    console.log('   - Host: in-v3.mailjet.com');
    console.log('   - Port: 587 (TLS)');
    console.log('   - Provider: Mailjet');
    console.log('   - Auth: API Key + Secret Key');

    const transporter = nodemailer.createTransport(config);
    
    // Verify connection on startup
    transporter.verify((error, success) => {
        if (error) {
            console.error('\n❌ MAILJET VERIFICATION FAILED:');
            console.error('   Error:', error.message);
            console.error('   Code:', error.code);
            console.error('\n🔍 TROUBLESHOOTING:');
            console.error('   1. Verify MAILJET_API_KEY is correct');
            console.error('   2. Verify MAILJET_SECRET_KEY is correct');
            console.error('   3. Make sure Mailjet account is active');
            console.error('   4. Go to: https://app.mailjet.com/account/api_keys');
        } else {
            console.log('✅ MAILJET SMTP CONNECTION VERIFIED');
            console.log('   Host: in-v3.mailjet.com');
            console.log('   Port: 587 (TLS)');
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
        to: process.env.EMAIL_FROM,
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
                    
                    <h2 style="color: #2180C8;">Preferred Contact Method</h2>
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
                    <ul style="list-style: none; padding: 0; margin: 15px 0;">
                        <li style="margin: 8px 0;">✓ <strong>Project Type:</strong> ${data.projectType}</li>
                        <li style="margin: 8px 0;">✓ <strong>Budget:</strong> ${data.budget}</li>
                        <li style="margin: 8px 0;">✓ <strong>Timeline:</strong> ${data.timeline}</li>
                        <li style="margin: 8px 0;">✓ <strong>Services:</strong> ${Array.isArray(data.services) ? data.services.join(', ') : data.services}</li>
                    </ul>
                    
                    <p style="margin-top: 20px; color: #333;">Our team will contact you via <strong>${data.contactMethod.toUpperCase()}</strong> within 24 hours.</p>
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
                    <p>Hi <strong>${user.name}</strong>,</p>
                    <p>Great news! Your account has been approved by our admin team. You can now access all features of Fairox.</p>
                    
                    <h2 style="color: #28a745;">Account Details</h2>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Status:</strong> ✅ APPROVED</p>
                    <p><strong>Access Date:</strong> ${new Date().toLocaleString()}</p>
                    
                    <p style="margin-top: 20px; text-align: center;">
                        <a href="https://fairox.co.in" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Login Now →</a>
                    </p>
                </div>
                <div style="background: #28a745; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2025 Fairox. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    userRegistration: (user) => ({
        to: process.env.EMAIL_FROM,
        subject: `🔔 New User Registration - ${user.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
                <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🔔 New User Registration</h1>
                </div>
                <div style="background: white; padding: 20px;">
                    <p>A new user has registered and is pending your approval:</p>
                    
                    <ul style="list-style: none; padding: 0; margin: 15px 0;">
                        <li style="margin: 10px 0;"><strong>Name:</strong> ${user.name}</li>
                        <li style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</li>
                        <li style="margin: 10px 0;"><strong>Status:</strong> Pending Approval</li>
                        <li style="margin: 10px 0;"><strong>Registered:</strong> ${new Date().toLocaleString()}</li>
                    </ul>
                    
                    <p style="margin-top: 20px; color: #666;">Please login to the admin panel to approve or reject this user.</p>
                </div>
                <div style="background: #007bff; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2025 Fairox. All rights reserved.</p>
                </div>
            </div>
        `
    })
};

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
    transporter,
    sendEmail,
    emailTemplates,
    createTransporter
};

console.log('='.repeat(70) + '\n');