// 🔍 EMAIL DIAGNOSTIC TEST
// File: routes/test-email.js
// Add this to your server for debugging

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// ============================================
// ENVIRONMENT VARIABLES CHECK
// ============================================

router.get('/check-env', (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ENVIRONMENT VARIABLES DIAGNOSTIC');
    console.log('='.repeat(60));

    const required = {
        'EMAIL_HOST': process.env.EMAIL_HOST,
        'EMAIL_PORT': process.env.EMAIL_PORT,
        'EMAIL_USER': process.env.EMAIL_USER,
        'EMAIL_PASS': process.env.EMAIL_PASS ? '✓ SET' : '✗ MISSING',
        'EMAIL_FROM': process.env.EMAIL_FROM,
        'EMAIL_SECURE': process.env.EMAIL_SECURE,
        'NODE_ENV': process.env.NODE_ENV
    };

    const result = {};
    for (const [key, value] of Object.entries(required)) {
        result[key] = value;
        console.log(`${key}: ${value}`);
    }

    console.log('='.repeat(60) + '\n');

    res.json({
        success: true,
        environment: result,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// SMTP CONNECTION TEST
// ============================================

router.get('/test-smtp', async (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔗 TESTING SMTP CONNECTION');
    console.log('='.repeat(60));

    try {
        const config = {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        };

        console.log('\nConfiguration:');
        console.log('  Host:', config.host);
        console.log('  Port:', config.port);
        console.log('  Secure:', config.secure);
        console.log('  User:', config.auth.user);
        console.log('  Pass: ***hidden***');

        const transporter = nodemailer.createTransport(config);

        console.log('\n⏳ Verifying connection...');

        await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    console.error('\n❌ SMTP VERIFICATION FAILED');
                    console.error('  Error:', error.message);
                    console.error('  Code:', error.code);
                    console.error('  Command:', error.command);
                    reject(error);
                } else {
                    console.log('\n✅ SMTP CONNECTION SUCCESSFUL');
                    resolve(success);
                }
            });
        });

        console.log('='.repeat(60) + '\n');

        res.json({
            success: true,
            message: 'SMTP connection verified successfully',
            config: {
                host: config.host,
                port: config.port,
                secure: config.secure,
                user: config.auth.user
            }
        });

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            help: 'Check environment variables and SMTP settings'
        });
    }
});

// ============================================
// SEND TEST EMAIL
// ============================================

router.post('/send-test-email', async (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('📧 SENDING TEST EMAIL');
    console.log('='.repeat(60));

    try {
        const { to } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Email address required in body: { to: "email@example.com" }'
            });
        }

        console.log('\nTo:', to);
        console.log('From:', process.env.EMAIL_FROM);

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log('\n⏳ Sending email...');

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: to,
            subject: '✅ Test Email from Render',
            html: `
                <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 8px;">
                        <h1 style="margin: 0;">✅ Success!</h1>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; margin-top: 0;">
                        <p>This test email was sent from your Fairox API on Render.</p>
                        
                        <h3>Test Details:</h3>
                        <ul>
                            <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
                            <li><strong>From:</strong> ${process.env.EMAIL_FROM}</li>
                            <li><strong>To:</strong> ${to}</li>
                            <li><strong>Environment:</strong> ${process.env.NODE_ENV}</li>
                        </ul>
                        
                        <p style="color: #666; font-size: 12px;">If you received this email, your SMTP configuration is working correctly and emails are being sent successfully.</p>
                    </div>
                    <div style="background: #28a745; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; font-size: 12px;">© 2025 Fairox - Modern Business Solutions</p>
                    </div>
                </div>
            `
        });

        console.log('\n✅ EMAIL SENT SUCCESSFULLY');
        console.log('  Message ID:', info.messageId);
        console.log('  Response:', info.response);
        console.log('='.repeat(60) + '\n');

        res.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: info.messageId,
            to: to,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Code:', error.code);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            help: 'Check SMTP credentials and firewall settings'
        });
    }
});

// ============================================
// FULL DIAGNOSTIC REPORT
// ============================================

router.get('/full-diagnostic', async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('📋 FULL EMAIL DIAGNOSTIC REPORT');
    console.log('='.repeat(70));

    const report = {
        timestamp: new Date().toISOString(),
        environment: {},
        smtpTest: {},
        recommendations: []
    };

    // Step 1: Check environment variables
    console.log('\n[STEP 1] Checking environment variables...');
    const envVars = {
        'EMAIL_HOST': process.env.EMAIL_HOST,
        'EMAIL_PORT': process.env.EMAIL_PORT,
        'EMAIL_USER': process.env.EMAIL_USER,
        'EMAIL_FROM': process.env.EMAIL_FROM,
        'NODE_ENV': process.env.NODE_ENV
    };

    for (const [key, value] of Object.entries(envVars)) {
        report.environment[key] = value || '✗ MISSING';
        console.log(`  ${key}: ${value ? '✓' : '✗'}`);
    }

    if (!process.env.EMAIL_PASS) {
        report.recommendations.push('❌ EMAIL_PASS is not set');
    }

    // Step 2: Test SMTP connection
    console.log('\n[STEP 2] Testing SMTP connection...');
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    report.smtpTest = {
                        status: '✗ FAILED',
                        error: error.message,
                        code: error.code
                    };
                    console.log(`  ✗ Connection failed: ${error.message}`);
                    reject(error);
                } else {
                    report.smtpTest = {
                        status: '✓ SUCCESS',
                        message: 'SMTP connection verified'
                    };
                    console.log(`  ✓ Connection successful`);
                    resolve();
                }
            });
        });
    } catch (error) {
        report.smtpTest.error = error.message;
    }

    // Step 3: Provide recommendations
    console.log('\n[STEP 3] Recommendations:');
    if (report.environment.EMAIL_HOST === '✗ MISSING') {
        report.recommendations.push('Set EMAIL_HOST in environment variables');
    }
    if (report.environment.EMAIL_PORT === '✗ MISSING') {
        report.recommendations.push('Set EMAIL_PORT to 587 (Gmail/SendGrid) or 465 (SSL)');
    }
    if (report.environment.EMAIL_USER === '✗ MISSING') {
        report.recommendations.push('Set EMAIL_USER to your email address');
    }
    if (!process.env.EMAIL_PASS) {
        report.recommendations.push('Set EMAIL_PASS (use Gmail App Password, not regular password)');
    }
    if (report.smtpTest.status === '✗ FAILED') {
        report.recommendations.push('Verify credentials are correct');
        report.recommendations.push('Check if 2FA is enabled for Gmail');
        report.recommendations.push('Ensure port 587 is not blocked by firewall');
    }

    report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
    });

    console.log('\n' + '='.repeat(70) + '\n');

    res.json(report);
});

module.exports = router;